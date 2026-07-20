import db from '../config/supabase.js';
import { isDeviating } from '../utils/deviation.js';
import { updateStopDetection, startCheckin, cancelAutoSos } from '../utils/stopDetection.js';

// tripId -> route_polyline, cached so we don't hit Supabase on every 5s GPS tick
const polylineCache = new Map();

async function getPolyline(tripId) {
  if (polylineCache.has(tripId)) return polylineCache.get(tripId);
  const { data: trip } = await db.from('trips').select('route_polyline').eq('id', tripId).single();
  const polyline = trip?.route_polyline || null;
  polylineCache.set(tripId, polyline);
  return polyline;
}

export default function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('trip:join', ({ tripId, role }) => {
      if (role === 'police') {
        socket.join('police-room');
        console.log(`Socket ${socket.id} joined police-room`);
      } else {
        socket.join(`trip-${tripId}`);
        console.log(`Socket ${socket.id} joined trip-${tripId} as ${role}`);
      }
    });

    socket.on('location:update', async (data) => {
      // ── Phase 2.5: foreground tracking verification ───────────────────────
      // Payload shape: { latitude, longitude, accuracy, timestamp }
      // No tripId — log only, no DB write, no broadcast.
      if (data.latitude != null && data.longitude != null && !data.tripId) {
        console.log('=========================');
        console.log('LOCATION UPDATE RECEIVED');
        console.log('Latitude: ', data.latitude);
        console.log('Longitude:', data.longitude);
        console.log('Accuracy: ', data.accuracy ?? '—');
        console.log('Timestamp:', data.timestamp);
        console.log('=========================');
        return; // stop here — do not proceed to trip logic
      }

      // ── Existing trip-based location handling (Phase 3+) ──────────────────
      const { tripId, userId, lat, lng, speed, accuracy, timestamp } = data;
      if (!tripId || lat == null || lng == null) return;

      try {
        await db.from('location_points').insert({
          trip_id: tripId,
          lat,
          lng,
          speed: speed ?? null,
          accuracy: accuracy ?? null,
          recorded_at: timestamp || new Date().toISOString(),
        });
      } catch (e) {
        console.error('location_points insert failed:', e.message);
      }

      io.to('police-room').emit('location:fan-out', data);
      io.to(`trip-${tripId}`).emit('location:fan-out', data);

      const polyline = await getPolyline(tripId);
      if (polyline && isDeviating(lat, lng, polyline, 200)) {
        startCheckin(tripId, userId, lat, lng, io, 'route-deviation');
      }

      if (typeof speed === 'number') {
        updateStopDetection(tripId, speed, lat, lng, io, userId);
      }
    });

    socket.on('checkin:response', ({ tripId }) => {
      cancelAutoSos(tripId);
      io.to(`trip-${tripId}`).emit('checkin:confirmed', { tripId });
    });

    // SOS fired client-side via socket (in addition to the REST /sos/trigger path)
    socket.on('sos:broadcast', (sosData) => {
      io.to('police-room').emit('sos:alert', sosData);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}

// Trip ends or is deleted -> stop serving a stale cached polyline for that id.
// Call this from routes/trips.js if you want the cache invalidated on /end
// (not strictly required — a stale polyline is harmless since deviation checks
// stop mattering once the trip's socket room goes quiet).
export function invalidatePolylineCache(tripId) {
  polylineCache.delete(tripId);
}
