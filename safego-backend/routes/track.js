import db from '../config/supabase.js';
import { verifyTracking } from '../utils/jwt.js';

// GET /track/:token — public, no Authorization header required.
// Mounted directly in index.js (not a Router) since it's a single route.
export default async function trackHandler(req, res) {
  let tripId;
  try {
    ({ tripId } = verifyTracking(req.params.token));
  } catch {
    return res.status(401).json({ error: 'Invalid or expired tracking link' });
  }

  const { data: trip, error } = await db
    .from('trips')
    .select('*, users(name, phone, avatar_url, blood_group, medical_conditions, allergies, medications)')
    .eq('id', tripId)
    .single();

  if (error || !trip) return res.status(404).json({ error: 'Trip not found' });

  const { data: lastPoint } = await db
    .from('location_points')
    .select('lat, lng, recorded_at')
    .eq('trip_id', tripId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
    
  const { data: sosEvent } = await db
    .from('sos_events')
    .select('*')
    .eq('trip_id', tripId)
    .order('fired_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  res.json({
    trip,
    users: {
      name: trip.users.name,
      phone: trip.users.phone,
      avatar_url: trip.users.avatar_url
    },
    identity: {
      personal: { bloodGroup: trip.users.blood_group },
      medical: { 
        medicalConditions: trip.users.medical_conditions,
        allergies: trip.users.allergies,
        medications: trip.users.medications
      }
    },
    location: lastPoint || { lat: trip.destination_lat, lng: trip.destination_lng },
    sosEvent: sosEvent ? {
      triggerType: sosEvent.trigger_type,
      priorityLevel: sosEvent.priority_level,
      audioClipUrl: sosEvent.audio_clip_url
    } : null
  });
}
