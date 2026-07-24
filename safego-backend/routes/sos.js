import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { triggerSOS } from '../utils/triggerSOS.js';
import supabase from '../config/supabase.js';
import { buildAudioStoragePath } from '../utils/storagePath.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const r = Router();

// POST /sos/trigger
// Body: {tripId, lat, lng, triggerType, audioClipUrl?}
r.post('/trigger', requireAuth, async (req, res) => {
  const { tripId, lat, lng, triggerType, audioClipUrl, identitySnapshot } = req.body;
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
      identitySnapshot,
      io: req.app.get('io'),
    });
    res.json({ success: true, sosId, priority });
  } catch (e) {
    if (e.message === 'Forbidden') return res.status(403).json({ error: 'Not your trip' });
    console.error('SOS trigger error:', e.message);
    res.status(500).json({ error: 'Failed to trigger SOS' });
  }
});

// POST /sos/audio
r.post('/audio', requireAuth, (req, res, next) => {
  console.log("[SOS Audio] Request received");
  console.log("[SOS Audio] Headers:", req.headers["content-type"]);

  upload.single('audio')(req, res, async (err) => {
    if (err) {
      console.error("[SOS Audio] Multer Error:", err);
      return next(err);
    }

    console.log("[SOS Audio] Body:", req.body);
    console.log("[SOS Audio] File:", req.file);
    console.log("[SOS Audio] MIME:", req.file?.mimetype);
    console.log("[SOS Audio] Size:", req.file?.size);
    console.log("[SOS Audio] Original Name:", req.file?.originalname);
    
    if (!req.file) {
      console.error("[SOS Audio] Rejection Reason: Missing file");
      return res.status(400).json({ error: 'Missing audio file' });
    }
    
    const validMimes = [
      "audio/x-m4a",
      "audio/m4a",
      "audio/mp4",
      "audio/mp4a-latm"
    ];
    if (!validMimes.includes(req.file.mimetype)) {
      console.error(`[SOS Audio] Rejection Reason: Invalid MIME type (${req.file.mimetype})`);
      return res.status(400).json({ error: 'Invalid audio format. Allowed types: ' + validMimes.join(', ') });
    }

    const tripId = req.body.tripId;
    if (!tripId) {
      console.error("[SOS Audio] Rejection Reason: Missing tripId");
      return res.status(400).json({ error: 'Missing tripId' });
    }

    try {
    console.log('[SOS Audio] Upload started');
    const filename = buildAudioStoragePath({ 
      userId: req.user.userId, 
      type: 'sos', 
      extension: 'm4a' 
    });

    const { data, error } = await supabase.storage
      .from('audio-clips')
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('[SOS Audio] Upload failed:\n', error);
      return res.status(500).json({ error: 'Failed to upload audio' });
    }
    
    console.log('[SOS Audio] Upload success');

    const { data: urlData } = supabase.storage
      .from('audio-clips')
      .getPublicUrl(filename);

    if (!urlData || !urlData.publicUrl) {
      console.error('[SOS Audio] Failed to get public URL');
      return res.status(500).json({ error: 'Failed to get public URL' });
    }

    console.log('[SOS Audio] Public URL generated');
    
    res.json({
      success: true,
      path: filename,
      publicUrl: urlData.publicUrl,
    });
  } catch (error) {
    console.error('[SOS Audio] Upload error:\n', error);
    res.status(500).json({ error: 'Internal server error during upload' });
  }
  });
});

// Add error handler for multer specifically on this router
r.use((err, req, res, next) => {
  console.error("[SOS Audio] Error handler caught:", err);
  res.status(500).json({ error: err.message });
});

export default r;
