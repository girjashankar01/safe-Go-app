// Haversine distance between two lat/lng points, in meters
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// True if current position is more than thresholdMeters from every point
// on the route polyline (i.e. user has wandered off the planned path)
export function isDeviating(currentLat, currentLng, routePolyline, thresholdMeters = 200) {
  if (!Array.isArray(routePolyline) || routePolyline.length === 0) return false;

  let minDist = Infinity;
  for (const point of routePolyline) {
    const d = haversineDistance(currentLat, currentLng, point.lat, point.lng);
    if (d < minDist) minDist = d;
    if (minDist <= thresholdMeters) return false; // early exit, no need to scan further
  }
  return minDist > thresholdMeters;
}
