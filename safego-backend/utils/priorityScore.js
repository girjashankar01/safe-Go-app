const TRIGGER_WEIGHTS = {
  'manual-sos': 40,
  'missed-checkin': 25,
  'auto-stop': 20,
  'route-deviation': 20,
};

// timeOfDay: ISO string. Returns the score bump for hour-of-day risk.
function timeWeight(timeOfDay) {
  const hour = new Date(timeOfDay).getHours();
  if (hour >= 22 || hour < 6) return 30; // late night
  if (hour >= 18 && hour < 22) return 15; // evening
  return 0;
}

export function computePriorityScore({ triggerType, timeOfDay, inDangerZone, speed }) {
  let score = TRIGGER_WEIGHTS[triggerType] ?? 0;
  score += timeWeight(timeOfDay);
  if (inDangerZone) score += 20;
  if (typeof speed === 'number' && speed < 2) score += 10;

  let level;
  if (score >= 70) level = 'CRITICAL';
  else if (score >= 40) level = 'HIGH';
  else level = 'MEDIUM';

  return { score, level };
}
