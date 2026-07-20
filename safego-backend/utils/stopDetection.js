import { triggerSOS } from './triggerSOS.js';

const SPEED_THRESHOLD_KMH = 5;
const STOP_DURATION_MS = 3 * 60 * 1000; // 3 min stationary before we prompt
const CHECKIN_WINDOW_MS = 90 * 1000; // 90s to respond before auto-SOS fires

// tripId -> { stoppedSince, checkInSent, lastLat, lastLng, userId }
const tripStates = new Map();
// tripId -> setTimeout handle for the pending auto-SOS (shared by stop-detection AND route-deviation)
const autoSosTimers = new Map();

// Starts a check-in prompt + 90s auto-SOS countdown for a trip.
// Shared helper — called both from here (stop detection) and from
// socket/handlers.js (route deviation), since only one check-in should
// ever be "in flight" per trip and checkin:response must cancel either source.
export function startCheckin(tripId, userId, lat, lng, io, reason) {
  if (autoSosTimers.has(tripId)) return; // one already pending, don't stack another

  io.to(`trip-${tripId}`).emit('checkin:prompt', {
    message:
      reason === 'route-deviation'
        ? 'You seem to have deviated from your route. Are you okay?'
        : 'You seem to have stopped moving. Are you okay?',
    responseWindowMs: CHECKIN_WINDOW_MS,
    reason,
  });

  const timer = setTimeout(async () => {
    autoSosTimers.delete(tripId);
    try {
      await triggerSOS({
        tripId,
        userId,
        lat,
        lng,
        triggerType: reason === 'route-deviation' ? 'route-deviation' : 'auto-stop',
        io,
      });
    } catch (e) {
      console.error(`Auto-SOS failed for trip ${tripId}:`, e.message);
    }
  }, CHECKIN_WINDOW_MS);

  autoSosTimers.set(tripId, timer);
}

export function updateStopDetection(tripId, speed, lat, lng, io, userId) {
  if (speed >= SPEED_THRESHOLD_KMH) {
    tripStates.delete(tripId);
    return; // moving normally — no stop in progress
  }

  let state = tripStates.get(tripId);
  if (!state) {
    tripStates.set(tripId, { stoppedSince: Date.now(), checkInSent: false, lastLat: lat, lastLng: lng, userId });
    return;
  }

  state.lastLat = lat;
  state.lastLng = lng;

  const stoppedFor = Date.now() - state.stoppedSince;
  if (stoppedFor >= STOP_DURATION_MS && !state.checkInSent) {
    state.checkInSent = true;
    startCheckin(tripId, userId, lat, lng, io, 'auto-stop');
  }
}

// Cancels whatever check-in/auto-SOS is pending for a trip (either source)
export function cancelAutoSos(tripId) {
  if (autoSosTimers.has(tripId)) {
    clearTimeout(autoSosTimers.get(tripId));
    autoSosTimers.delete(tripId);
  }
  const state = tripStates.get(tripId);
  if (state) state.checkInSent = false; // allow a future stop to re-trigger a prompt
}
