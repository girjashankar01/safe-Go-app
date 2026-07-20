// Test script for socket/handlers.js — run separately from the server.
// Usage: node socket-test.js <tripId> <userId>
//   npm install socket.io-client --save-dev   (in safego-backend, one-time)
//
// What it does:
// 1. Connects a "police" viewer socket, joins police-room
// 2. Connects a "user" broadcaster socket, joins trip-<tripId>
// 3. Sends a normal location update -> police socket should see location:fan-out
// 4. Sends a location far off any route polyline -> should trigger checkin:prompt
//    (route-deviation check runs on every update, no wait needed)
// 5. Sends checkin:response -> should trigger checkin:confirmed
//
// Stop-detection (3min stopped + 90s no-response = auto-SOS) is NOT exercised
// here since it needs real wall-clock time. To test it, temporarily lower
// STOP_DURATION_MS and CHECKIN_WINDOW_MS in utils/stopDetection.js, run this
// script sending speed:0 repeatedly, then revert the constants after.

import { io as ioClient } from 'socket.io-client';

const [, , tripId, userId] = process.argv;
if (!tripId || !userId) {
  console.error('Usage: node socket-test.js <tripId> <userId>');
  process.exit(1);
}

const URL = 'http://localhost:3000';

const police = ioClient(URL);
const user = ioClient(URL);

police.on('connect', () => {
  console.log('[police] connected, joining police-room');
  police.emit('trip:join', { tripId, role: 'police' });
});

police.on('location:fan-out', (data) => {
  console.log('[police] received location:fan-out:', data);
});

police.on('sos:alert', (data) => {
  console.log('[police] received sos:alert:', data);
});

user.on('connect', () => {
  console.log('[user] connected, joining trip room');
  user.emit('trip:join', { tripId, role: 'user' });

  setTimeout(() => {
    console.log('[user] sending normal location update (Bangalore center)');
    user.emit('location:update', {
      tripId, userId, lat: 12.9716, lng: 77.5946, speed: 20, accuracy: 10,
      timestamp: new Date().toISOString(),
    });
  }, 1000);

  setTimeout(() => {
    console.log('[user] sending FAR OFF location — should trigger route-deviation checkin:prompt');
    user.emit('location:update', {
      tripId, userId, lat: 13.5, lng: 78.5, speed: 20, accuracy: 10,
      timestamp: new Date().toISOString(),
    });
  }, 2000);
});

user.on('checkin:prompt', (data) => {
  console.log('[user] received checkin:prompt:', data);
  console.log('[user] responding to check-in...');
  user.emit('checkin:response', { tripId });
});

user.on('checkin:confirmed', (data) => {
  console.log('[user] received checkin:confirmed:', data);
  console.log('Test complete. Ctrl+C to exit.');
});
