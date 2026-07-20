import { haversineDistance } from './deviation.js';

export async function findNearestStation(lat, lng, supabase) {
  const { data: stations, error } = await supabase.from('police_stations').select('*');
  if (error || !stations?.length) return { station: null, distanceMeters: null };

  let nearest = null;
  let minDist = Infinity;
  for (const s of stations) {
    const d = haversineDistance(lat, lng, s.lat, s.lng);
    if (d < minDist) {
      minDist = d;
      nearest = s;
    }
  }
  return { station: nearest, distanceMeters: minDist };
}
