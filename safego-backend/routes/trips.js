import { Router } from 'express';
import axios from 'axios';
import { requireAuth } from '../middleware/auth.js';
import db from '../config/supabase.js';
import { signTracking } from '../utils/jwt.js';
import { sendTripStartEmail } from '../utils/email.js';

const r = Router();

// GET /trips/active
// Returns the authenticated user's current open trip, or hasActiveTrip:false.
r.get('/active', requireAuth, async (req, res) => {
  try {
    const { data: trip, error } = await db
      .from('trips')
      .select('id, tracking_token, created_at, status')
      .eq('user_id', req.user.userId)
      .not('status', 'eq', 'ended')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    if (!trip) return res.json({ hasActiveTrip: false });

    return res.json({
      hasActiveTrip: true,
      trip: {
        id:            trip.id,
        trackingToken: trip.tracking_token,
        startedAt:     trip.created_at,
        status:        trip.status,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /trips/start
// Body: {originLat, originLng, destinationLat?, destinationLng?, destinationName?}
r.post('/start', requireAuth, async (req, res) => {
  const uid = req.user.userId;
  const { originLat, originLng, destinationLat, destinationLng, destinationName } = req.body;

  if (originLat == null || originLng == null)
    return res.status(400).json({ error: 'originLat and originLng are required' });

  // Guard: a user may only have one active trip at a time.
  // Statuses that represent a still-open trip: anything that is not 'ended'.
  // We deliberately include 'sos' here — an SOS trip is still open.
  try {
    const { data: existing } = await db
      .from('trips')
      .select('id, status')
      .eq('user_id', uid)
      .not('status', 'eq', 'ended')
      .limit(1)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        error: 'You already have an active trip. End it before starting a new one.',
        existingTripId: existing.id,
      });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

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
  // count is null when Supabase RLS silently blocked the update, or 0 when the
  // row genuinely was not found. Both cases mean nothing was updated.
  if (!count) return res.status(404).json({ error: 'Trip not found or already ended' });
  res.json({ success: true });
});

// GET /trips
// Returns all trips belonging to the authenticated user, ordered by newest first.
r.get('/', requireAuth, async (req, res) => {
  try {
    const { data: trips, error } = await db
      .from('trips')
      .select('id, status, started_at, ended_at, origin_lat, origin_lng, destination_name')
      .eq('user_id', req.user.userId)
      .order('started_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const formatted = (trips || []).map(trip => ({
      id: trip.id,
      status: trip.status,
      startedAt: trip.started_at,
      endedAt: trip.ended_at,
      originLat: trip.origin_lat,
      originLng: trip.origin_lng,
      destinationName: trip.destination_name,
    }));

    res.json(formatted);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /trips/:id
// Returns detailed information about a specific trip belonging to the authenticated user.
r.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: trip, error } = await db
      .from('trips')
      .select('id, status, started_at, ended_at, origin_lat, origin_lng, destination_lat, destination_lng, destination_name, tracking_token')
      .eq('id', req.params.id)
      .eq('user_id', req.user.userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Trip not found' });
      return res.status(500).json({ error: error.message });
    }

    let durationSeconds = null;
    if (trip.started_at && trip.ended_at) {
      durationSeconds = Math.floor((new Date(trip.ended_at).getTime() - new Date(trip.started_at).getTime()) / 1000);
    }

    res.json({
      id: trip.id,
      status: trip.status,
      startedAt: trip.started_at,
      endedAt: trip.ended_at,
      originLat: trip.origin_lat,
      originLng: trip.origin_lng,
      destinationLat: trip.destination_lat,
      destinationLng: trip.destination_lng,
      destinationName: trip.destination_name,
      trackingToken: trip.tracking_token,
      durationSeconds: durationSeconds,
      hasSOS: trip.status === 'sos'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default r;
