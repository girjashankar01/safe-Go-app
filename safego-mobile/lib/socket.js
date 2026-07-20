import { io } from 'socket.io-client';

// Singleton socket instance. autoConnect: false — phases 2+ handle connect/disconnect.
const socket = io(process.env.EXPO_PUBLIC_BACKEND_URL, {
  transports: ['websocket'],
  autoConnect: false,
});

export default socket;
