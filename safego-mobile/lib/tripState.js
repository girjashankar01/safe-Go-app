import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage key ──────────────────────────────────────────────────────────────

const TRIP_KEY = 'safego_active_trip';

// ─── In-memory state ──────────────────────────────────────────────────────────
// Mirrors what is persisted in AsyncStorage so callers can read synchronously
// after the first restore() call.

let _state = {
  tripId:        null,
  trackingToken: null,
  userId:        null,
  isTripActive:  false,
  startedAt:     null,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Restore persisted trip state from AsyncStorage.
 * Call once on app start (before rendering TripScreen).
 * Safe to call multiple times — subsequent calls re-sync from storage.
 */
export const restoreTrip = async () => {
  try {
    const raw = await AsyncStorage.getItem(TRIP_KEY);
    if (raw) {
      _state = JSON.parse(raw);
    }
  } catch {
    // Corrupt storage — start fresh; don't crash the app.
    _state = emptyState();
  }
};

/**
 * Store a new active trip.
 * @param {{ tripId, trackingToken, userId, startedAt? }} trip
 */
export const setTrip = async ({ tripId, trackingToken, userId, startedAt }) => {
  _state = {
    tripId,
    trackingToken,
    userId:       userId ?? null,
    isTripActive: true,
    startedAt:    startedAt ?? new Date().toISOString(),
  };
  await _persist();
};

/**
 * Clear all trip state (call after a successful /trips/:id/end response).
 */
export const clearTrip = async () => {
  _state = emptyState();
  await AsyncStorage.removeItem(TRIP_KEY);
};

/**
 * Returns the current in-memory trip state object.
 * Always call restoreTrip() once before relying on this in UI.
 */
export const getTrip = () => ({ ..._state });

/**
 * Returns true if a trip is currently active.
 */
export const hasActiveTrip = () => _state.isTripActive === true;

// ─── Private helpers ──────────────────────────────────────────────────────────

function emptyState() {
  return {
    tripId:        null,
    trackingToken: null,
    userId:        null,
    isTripActive:  false,
    startedAt:     null,
  };
}

async function _persist() {
  try {
    await AsyncStorage.setItem(TRIP_KEY, JSON.stringify(_state));
  } catch (e) {
    console.warn('[TripState] Failed to persist trip state:', e.message);
  }
}
