import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;

// Auth tokens — issued on register/login, sent in Authorization header
export const signAuth = (userId, email) =>
  jwt.sign({ userId, email, type: 'auth' }, SECRET, { expiresIn: '30d' });

export const verifyAuth = (token) => {
  const payload = jwt.verify(token, SECRET);
  if (payload.type !== 'auth') throw new Error('Not an auth token');
  return payload;
};

// Tracking tokens — embedded in the public /track/:token link and
// in the Socket.io watch:trip payload. Same secret, different payload shape,
// so verifyAuth() can never accidentally succeed on a tracking token and vice versa
// (no userId in this payload -> requireAuth middleware will reject it safely).
export const signTracking = (tripId) =>
  jwt.sign({ tripId, type: 'tracking' }, SECRET, { expiresIn: '7d' });

export const verifyTracking = (token) => {
  const payload = jwt.verify(token, SECRET);
  if (payload.type !== 'tracking') throw new Error('Not a tracking token');
  return payload;
};
