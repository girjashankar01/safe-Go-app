import db from '../config/supabase.js';
import { computePriorityScore } from './priorityScore.js';
import { findNearestStation } from './nearestStation.js';
import { haversineDistance } from './deviation.js';
import { sendSOSEmail } from './email.js';

const DASHBOARD_URL = process.env.DASHBOARD_URL;

export async function triggerSOS({ tripId, userId, lat, lng, triggerType, audioClipUrl, identitySnapshot, io }) {
  const { data: trip, error: tripErr } = await db
    .from('trips')
    .select('*, users(name, email, emergency_contacts(*))')
    .eq('id', tripId)
    .single();

  if (tripErr || !trip) throw new Error('Trip not found');
  if (trip.user_id !== userId) throw new Error('Forbidden');

  // Danger zone check — is this position inside any known high-risk radius?
  const { data: zones } = await db.from('danger_zones').select('lat,lng,radius_meters');
  const inDangerZone = (zones || []).some(
    (z) => haversineDistance(lat, lng, z.lat, z.lng) <= z.radius_meters
  );

  const priority = computePriorityScore({
    triggerType,
    timeOfDay: new Date().toISOString(),
    inDangerZone,
    speed: 0,
  });

  const { station } = await findNearestStation(lat, lng, db);

  let sosEvent;
  const { data: event1, error: sosErr1 } = await db
    .from('sos_events')
    .insert({
      trip_id: tripId,
      user_id: userId,
      lat,
      lng,
      trigger_type: triggerType,
      priority_level: priority.level,
      priority_score: priority.score,
      audio_clip_url: audioClipUrl || null,
      nearest_station_id: station?.id || null,
      identity_snapshot: identitySnapshot ? identitySnapshot.snapshot : null,
      profile_version: identitySnapshot ? identitySnapshot.version : null,
      profile_updated_at: identitySnapshot ? identitySnapshot.updatedAt : null,
    })
    .select()
    .single();

  if (sosErr1) {
    if (sosErr1.message.includes('identity_snapshot')) {
      console.warn('[SOS] Schema missing snapshot columns. Falling back to old schema.');
      const { data: event2, error: sosErr2 } = await db
        .from('sos_events')
        .insert({
          trip_id: tripId,
          user_id: userId,
          lat,
          lng,
          trigger_type: triggerType,
          priority_level: priority.level,
          priority_score: priority.score,
          audio_clip_url: audioClipUrl || null,
          nearest_station_id: station?.id || null,
        })
        .select()
        .single();
        
      if (sosErr2) throw new Error(sosErr2.message);
      sosEvent = event2;
    } else {
      throw new Error(sosErr1.message);
    }
  } else {
    sosEvent = event1;
  }

  await db.from('trips').update({ status: 'sos' }).eq('id', tripId);

  const contacts = trip.users?.emergency_contacts || [];
  const trackingLink = `${DASHBOARD_URL}/track/${trip.tracking_token}`;

  let emailResults = [];
  if (contacts.length) {
    emailResults = await sendSOSEmail({
      contacts,
      userName: trip.users.name,
      lat,
      lng,
      triggerType,
      priorityLevel: priority.level,
      trackingLink,
      audioClipUrl,
      nearestStation: station,
      identitySnapshot: identitySnapshot ? identitySnapshot.snapshot : null,
    });
  } else {
    console.warn(`SOS fired for trip ${tripId} but user has no emergency contacts configured`);
  }

  io.to('police-room').emit('sos:alert', {
    sosId: sosEvent.id,
    tripId,
    userId,
    lat,
    lng,
    triggerType,
    priorityLevel: priority.level,
    priorityScore: priority.score,
    nearestStation: station,
    firedAt: sosEvent.fired_at,
  });

  return { sosId: sosEvent.id, priority, emailResults };
}
