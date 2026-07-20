import { Router } from 'express';
import axios from 'axios';
import { requireAuth } from '../middleware/auth.js';
import db from '../config/supabase.js';
import { signTracking } from '../utils/jwt.js';
import { sendTripStartEmail } from '../utils/email.js';

const r = Router();

// POST /trips/start
// Body: {originLat, originLng, destinationLat?, destinationLng?, destinationName?}
r.post('/start', requireAuth, async (req, res) => {
  const uid = req.user.userId;
  const { originLat, originLng, destinationLat, destinationLng, destinationName } = req.body;

  if (originLat == null || originLng == null)
    return res.status(400).json({ error: 'originLat and originLng are required' });

  try {
    let routePolyline = null;

    if (destinationLat != null && destinationLng != null) {
      try {
        const url = `http://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destinationLng},${destinationLat}?overview=full&geometries=geojson`;
        const { data } = await axios.get(url, { timeout: 8000 });
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (coords) routePolyline = coords.map(([lng, lat]) => ({ lat, lng }));
      } catch (e) {
        // OSRM is a public best-effort server — don't block trip creation on it.
        // Deviation detection just won't run for this trip until it's retried.
        console.warn('OSRM route fetch failed, starting trip without polyline:', e.message);
      }
    }

    const { data: trip, error } = await db
      .from('trips')
      .insert({
        user_id: uid,
        origin_lat: originLat,
        origin_lng: originLng,
        destination_lat: destinationLat ?? null,
        destination_lng: destinationLng ?? null,
        destination_name: destinationName ?? null,
        route_polyline: routePolyline,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Tracking token depends on the trip's own id, so it can only be generated
    // after the insert above returns the new row.
    const trackingToken = signTracking(trip.id);
    const { error: updateErr } = await db
      .from('trips')
      .update({ tracking_token: trackingToken })
      .eq('id', trip.id);
    if (updateErr) return res.status(400).json({ error: updateErr.message });

    // Notify emergency contacts — best-effort, don't fail trip creation over it
    const { data: user } = await db.from('users').select('name').eq('id', uid).single();
    const { data: contacts } = await db.from('emergency_contacts').select('*').eq('user_id', uid);
    const trackingLink = `${process.env.DASHBOARD_URL}/track/${trackingToken}`;

    if (contacts?.length) {
      sendTripStartEmail({ contacts, userName: user?.name || 'A SafeGo user', trackingLink }).catch((e) =>
        console.error('Trip-start email failed:', e.message)
      );
    }

    res.status(201).json({ tripId: trip.id, trackingToken, routePolyline });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /trips/:id/end
r.post('/:id/end', requireAuth, async (req, res) => {
  const { error, count } = await db
    .from('trips')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('user_id', req.user.userId) // ownership check
    .select('id', { count: 'exact' });

  if (error) return res.status(400).json({ error: error.message });
  if (count === 0) return res.status(404).json({ error: 'Trip not found' });
  res.json({ success: true });
});

export default r;
