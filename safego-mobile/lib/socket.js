import { io } from 'socket.io-client';

// ─── Singleton ────────────────────────────────────────────────────────────────
// One socket instance for the entire app lifetime.
// autoConnect: false — connection is managed explicitly via connectSocket().

const socket = io(process.env.EXPO_PUBLIC_BACKEND_URL, {
  transports: ['websocket'],
  autoConnect: false,
});

// ─── Dev logging ──────────────────────────────────────────────────────────────
// These listeners are registered once and never removed.
// They only log — they do not emit any application events.

socket.on('connect', () => {
  console.log('[Socket] Connected  id:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('[Socket] Disconnected  reason:', reason);
});

socket.on('connect_error', (err) => {
  console.log('[Socket] Connection error:', err.message);
});

socket.io.on('reconnect_attempt', (attempt) => {
  console.log('[Socket] Reconnecting… attempt', attempt);
});

socket.io.on('reconnect', (attempt) => {
  console.log('[Socket] Reconnected after', attempt, 'attempt(s)');
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Connect the socket. Call after a successful login / auto-login.
 * Safe to call if already connected — socket.io ignores duplicate calls.
 */
export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

/**
 * Disconnect the socket. Call on logout.
 * Passing true disables automatic reconnection until connectSocket() is called again.
 */
export const disconnectSocket = () => {
  socket.disconnect();
};

/**
 * Returns the shared socket instance.
 * Use this to attach/remove listeners inside components.
 */
export const getSocket = () => socket;

export default socket;
