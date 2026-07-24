import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../config/supabase.js';

const r = Router();

// GET /emergency-history
// Returns paginated history for the authenticated user, newest first.
r.get('/', requireAuth, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const { data, error } = await db
      .from('sos_events')
      .select('id, fired_at, trigger_type, status, priority_level, priority_score, location_name, recording_duration, recording_size, audio_clip_url, trip_id')
      .eq('user_id', req.user.userId)
      .order('fired_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[EmergencyHistory] Error fetching history:', error.message);
      return res.status(500).json({ error: 'Failed to fetch history' });
    }

    // Mask audio_clip_url with has_recording boolean
    const maskedData = data.map(event => {
      const hasRecording = !!event.audio_clip_url;
      delete event.audio_clip_url;
      return { ...event, has_recording: hasRecording };
    });

    res.json(maskedData);
  } catch (error) {
    console.error('[EmergencyHistory] Internal error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /emergency-history/:id
// Returns complete incident information.
r.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await db
      .from('sos_events')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    if (data.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const hasRecording = !!data.audio_clip_url;
    delete data.audio_clip_url;
    
    res.json({ ...data, has_recording: hasRecording });
  } catch (error) {
    console.error('[EmergencyHistory] Internal error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /emergency-history/:id/audio
// Generates signed URL for audio clip
r.get('/:id/audio', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Verify ownership
    const { data, error } = await db
      .from('sos_events')
      .select('user_id, audio_clip_url')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    if (data.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!data.audio_clip_url) {
      return res.status(404).json({ error: 'No audio recording for this incident' });
    }

    // 2. Extract path from public URL
    // Public URL format: .../object/public/audio-clips/{path}
    const bucketAndPath = data.audio_clip_url.split('/object/public/audio-clips/')[1];
    let pathInBucket = bucketAndPath;
    if (!pathInBucket) {
      // Maybe it was stored as just the filename directly in some older version?
      pathInBucket = data.audio_clip_url;
    }

    // 3. Generate signed URL (expires in 60 seconds)
    const expiresIn = 60;
    const { data: signedData, error: signedError } = await db.storage
      .from('audio-clips')
      .createSignedUrl(pathInBucket, expiresIn);

    if (signedError || !signedData) {
      console.error('[EmergencyHistory] Error generating signed URL:', signedError);
      return res.status(500).json({ error: 'Failed to generate signed URL' });
    }

    res.json({
      signedUrl: signedData.signedUrl,
      expires_in: expiresIn
    });
  } catch (error) {
    console.error('[EmergencyHistory] Internal error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default r;
