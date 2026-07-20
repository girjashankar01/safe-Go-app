import { verifyAuth } from '../utils/jwt.js';

export const requireAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = verifyAuth(auth.split(' ')[1]);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
