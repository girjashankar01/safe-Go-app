import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/supabase.js';
import { signAuth } from '../utils/jwt.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();

// POST /auth/register
// Body: {name, phone, email, password, blood_group?, emergencyContacts?: [{name,phone,email}]}
r.post('/register', async (req, res) => {
  const { name, email, phone, password, blood_group, emergencyContacts } = req.body;
  if (!name || !email || !phone || !password)
    return res.status(400).json({ error: 'Missing fields' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const { data: user, error } = await db
      .from('users')
      .insert({ name, email, phone, password_hash: hash, blood_group })
      .select('id,name,email,phone')
      .single();

    if (error) return res.status(400).json({ error: error.message });

    if (Array.isArray(emergencyContacts) && emergencyContacts.length) {
      const rows = emergencyContacts.map(c => ({ ...c, user_id: user.id }));
      const { error: cErr } = await db.from('emergency_contacts').insert(rows);
      // Don't fail registration over contacts — user can add them later via /auth/contacts.
      // But surface it so the client knows to prompt a retry.
      if (cErr) console.error('emergency_contacts insert failed:', cErr.message);
    }

    res.status(201).json({ token: signAuth(user.id, user.email), user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /auth/login
r.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Missing credentials' });

  try {
    const { data: user } = await db
      .from('users').select('*').eq('email', email).single();

    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const { password_hash, ...safe } = user;
    res.json({ token: signAuth(user.id, user.email), user: safe });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /auth/me
r.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('users')
    .select('id,name,email,phone,blood_group,avatar_url,medical_conditions,allergies,medications,preferred_name,date_of_birth')
    .eq('id', req.user.userId)
    .single();
  if (error) return res.status(404).json({ error: 'User not found' });
  res.json(data);
});

// GET /auth/contacts
r.get('/contacts', requireAuth, async (req, res) => {
  const { data, error } = await db
    .from('emergency_contacts')
    .select('*')
    .eq('user_id', req.user.userId);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /auth/contacts
r.post('/contacts', requireAuth, async (req, res) => {
  const { name, phone, email } = req.body;
  if (!name || !phone || !email)
    return res.status(400).json({ error: 'Name, phone, and email required' });

  // Enforce maximum of 3 contacts per user.
  const { count, error: countErr } = await db
    .from('emergency_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.userId);
  if (countErr) return res.status(400).json({ error: countErr.message });
  if (count >= 3)
    return res.status(400).json({ error: 'Maximum of 3 emergency contacts allowed' });

  const { data, error } = await db
    .from('emergency_contacts')
    .insert({ user_id: req.user.userId, name, phone, email })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /auth/contacts/:id
r.put('/contacts/:id', requireAuth, async (req, res) => {
  const { name, phone, email } = req.body;
  if (!name || !phone || !email)
    return res.status(400).json({ error: 'Name, phone, and email required' });

  const { data, error, count } = await db
    .from('emergency_contacts')
    .update({ name, phone, email })
    .eq('id', req.params.id)
    .eq('user_id', req.user.userId) // ownership check
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Contact not found' });
  res.json(data);
});

// DELETE /auth/contacts/:id
r.delete('/contacts/:id', requireAuth, async (req, res) => {
  const { error } = await db
    .from('emergency_contacts')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.userId); // ownership check — can't delete someone else's contact

  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// POST /auth/avatar
r.post('/avatar', requireAuth, async (req, res) => {
  const { base64, fileExt } = req.body;
  if (!base64) return res.status(400).json({ error: 'Missing image data' });
  
  try {
    const buffer = Buffer.from(base64, 'base64');
    const ext = fileExt || 'jpg';
    const filePath = `${req.user.userId}/avatar.${ext}`;
    const contentType = `image/${ext === 'png' ? 'png' : 'jpeg'}`;
    
    // Upload using service key (bypasses RLS)
    const { error: uploadError } = await db.storage.from('avatars').upload(filePath, buffer, {
      upsert: true,
      contentType
    });
    
    if (uploadError) throw uploadError;
    
    const { data: { publicUrl } } = db.storage.from('avatars').getPublicUrl(filePath);
    const timestampedUrl = `${publicUrl}?t=${Date.now()}`;
    
    await db.from('users').update({ avatar_url: timestampedUrl }).eq('id', req.user.userId);
    
    res.json({ avatarUrl: timestampedUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /auth/profile
r.post('/profile', requireAuth, async (req, res) => {
  const { 
    name, preferred_name, date_of_birth, blood_group, 
    medical_conditions, allergies, medications 
  } = req.body;
  
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (preferred_name !== undefined) updates.preferred_name = preferred_name;
  if (date_of_birth !== undefined) updates.date_of_birth = date_of_birth;
  if (blood_group !== undefined) updates.blood_group = blood_group;
  if (medical_conditions !== undefined) updates.medical_conditions = medical_conditions;
  if (allergies !== undefined) updates.allergies = allergies;
  if (medications !== undefined) updates.medications = medications;
  
  try {
    const { data, error } = await db
      .from('users')
      .update(updates)
      .eq('id', req.user.userId)
      .select('id,name,email,phone,blood_group,avatar_url,medical_conditions,allergies,medications,preferred_name,date_of_birth')
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default r;
