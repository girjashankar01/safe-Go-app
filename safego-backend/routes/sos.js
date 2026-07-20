import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { triggerSOS } from '../utils/triggerSOS.js';

const r = Router();

// POST /sos/trigger
// Body: {tripId, lat, lng, triggerType, audioClipUrl?}
r.post('/trigger', requireAuth, async (req, res) => {
  const { tripId, lat, lng, triggerType, audioClipUrl } = req.body;
  if (!tripId || lat == null || lng == null || !triggerType)
    return res.status(400).json({ error: 'Missing tripId, lat, lng, or triggerType' });

  try {
    const { sosId, priority } = await triggerSOS({
      tripId,
      userId: req.user.userId,
      lat,
      lng,
      triggerType,
      audioClipUrl,
      io: req.app.get('io'),
    });
    res.json({ success: true, sosId, priority });
  } catch (e) {
    if (e.message === 'Forbidden') return res.status(403).json({ error: 'Not your trip' });
    console.error('SOS trigger error:', e.message);
    res.status(500).json({ error: 'Failed to trigger SOS' });
  }
});

export default r;
