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
    .select('status, destination_lat, destination_lng, destination_name')
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

  res.json({
    status: trip.status,
    destination: {
      lat: trip.destination_lat,
      lng: trip.destination_lng,
      name: trip.destination_name,
    },
    lastLocation: lastPoint || null,
  });
}
