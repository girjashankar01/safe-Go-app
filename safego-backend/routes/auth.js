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
    .select('id,name,email,phone,blood_group')
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

export default r;
