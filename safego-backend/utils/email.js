import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM;

export async function sendSOSEmail({
  contacts, userName, lat, lng, triggerType, priorityLevel, trackingLink, audioClipUrl, nearestStation,
}) {
  const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
  const priorityColor = { CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#ca8a04' }[priorityLevel] || '#dc2626';

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:${priorityColor};">🚨 SafeGo SOS Alert — ${priorityLevel}</h2>
      <p><strong>${userName}</strong> has triggered an SOS alert.</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Time</strong></td>
            <td style="padding:8px;border:1px solid #ddd;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Trigger Type</strong></td>
            <td style="padding:8px;border:1px solid #ddd;">${triggerType}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Priority</strong></td>
            <td style="padding:8px;border:1px solid #ddd;">${priorityLevel}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Location</strong></td>
            <td style="padding:8px;border:1px solid #ddd;"><a href="${mapsLink}">Open in Google Maps</a></td></tr>
        ${nearestStation ? `<tr><td style="padding:8px;border:1px solid #ddd;"><strong>Nearest Police Station</strong></td>
            <td style="padding:8px;border:1px solid #ddd;">${nearestStation.name} — ${nearestStation.phone || 'N/A'}</td></tr>` : ''}
      </table>
      <p><a href="${trackingLink}" style="background:${priorityColor};color:white;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;margin-top:12px;">Live Tracking Link</a></p>
      ${audioClipUrl ? `
      <p>🎤 Audio Recording</p>
      <p><a href="${audioClipUrl}">Listen Recording</a></p>
      <p><a href="${audioClipUrl}" style="color:#666;font-size:12px;">${audioClipUrl.split('/').pop()}</a></p>
      ` : ''}
      <p style="color:#666;font-size:12px;">This is an automated alert from SafeGo. Do not reply to this email.</p>
    </div>
  `;

  // Resend free tier has no batch-send — fire sequentially so one bad address
  // doesn't rely on Promise.all's fail-fast behavior silently dropping the rest
  const results = [];
  for (const contact of contacts) {
    try {
      await resend.emails.send({
        from: FROM,
        to: contact.email,
        subject: `🚨 [${priorityLevel}] SOS Alert — ${userName} needs help`,
        html,
      });
      results.push({ email: contact.email, sent: true });
    } catch (e) {
      console.error(`SOS email failed for ${contact.email}:`, e.message);
      results.push({ email: contact.email, sent: false, error: e.message });
    }
  }
  return results;
}

export async function sendTripStartEmail({ contacts, userName, trackingLink }) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <p><strong>${userName}</strong> has started a trip on SafeGo.</p>
      <p><a href="${trackingLink}" style="background:#16a34a;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;">Track their journey</a></p>
      <p style="color:#666;font-size:12px;">This is an automated notification from SafeGo. Do not reply to this email.</p>
    </div>
  `;

  const results = [];
  for (const contact of contacts) {
    try {
      await resend.emails.send({
        from: FROM,
        to: contact.email,
        subject: `${userName} has started a trip`,
        html,
      });
      results.push({ email: contact.email, sent: true });
    } catch (e) {
      console.error(`Trip-start email failed for ${contact.email}:`, e.message);
      results.push({ email: contact.email, sent: false, error: e.message });
    }
  }
  return results;
}
