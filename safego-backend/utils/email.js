import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM;

export async function sendSOSEmail({
  contacts, userName, userPhone, lat, lng, triggerType, priorityLevel, trackingLink, audioClipUrl, nearestStation, identitySnapshot,
}) {
  const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
  const priorityColor = { CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#ca8a04' }[priorityLevel] || '#dc2626';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
      <!-- Banner -->
      <div style="background-color: ${priorityColor}; color: white; padding: 16px; border-radius: 8px 8px 0 0; text-align: center;">
        <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 1px;">SOS ALERT &mdash; ${priorityLevel}</h2>
      </div>
      
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; background-color: #ffffff;">
        <p style="font-size: 16px; margin-top: 0;"><strong>${userName}</strong> needs help.</p>
        <p style="color: #4b5563; font-size: 14px; margin-bottom: 24px;">Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>

        <!-- Big Action Buttons -->
        <div style="margin-bottom: 32px;">
          <a href="${trackingLink}" style="display: block; width: 100%; background-color: ${priorityColor}; color: white; padding: 14px 0; text-align: center; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; margin-bottom: 12px; box-sizing: border-box;">View Live Location</a>
          
          ${nearestStation && nearestStation.phone ? `
            <a href="tel:${nearestStation.phone.replace(/[^\d+]/g, '')}" style="display: block; width: 100%; background-color: #f3f4f6; color: #111827; padding: 14px 0; text-align: center; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; margin-bottom: 12px; box-sizing: border-box; border: 1px solid #e5e7eb;">Call ${nearestStation.name}</a>
          ` : ''}

          ${userPhone ? `
            <a href="tel:${userPhone.replace(/[^\d+]/g, '')}" style="display: block; width: 100%; background-color: #f3f4f6; color: #111827; padding: 14px 0; text-align: center; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-sizing: border-box; border: 1px solid #e5e7eb;">Call ${userName}</a>
          ` : ''}
        </div>

        <!-- Alert Details -->
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; border: 1px solid #f3f4f6; margin-bottom: 24px;">
          <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 14px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px;">Alert Details</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #4b5563; width: 40%;">Trigger Type</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${triggerType}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #4b5563;">Coordinates</td>
              <td style="padding: 8px 0; font-weight: 500;"><a href="${mapsLink}" style="color: #2563eb; text-decoration: none;">Map View</a></td>
            </tr>
          </table>
        </div>

        <!-- Medical Information -->
        ${identitySnapshot && (identitySnapshot?.personal?.bloodGroup || identitySnapshot?.medical?.medicalConditions || identitySnapshot?.medical?.allergies || identitySnapshot?.medical?.medications) ? `
        <div style="background-color: #fff1f2; padding: 16px; border-radius: 6px; border: 1px solid #ffe4e6; margin-bottom: 24px;">
          <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 14px; text-transform: uppercase; color: #9f1239; letter-spacing: 0.5px;">Medical Information</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            ${identitySnapshot?.personal?.bloodGroup ? `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #fecdd3; color: #881337; width: 40%;">Blood Group</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #fecdd3; font-weight: 600; color: #881337;">${identitySnapshot.personal.bloodGroup}</td>
            </tr>` : ''}
            ${identitySnapshot?.medical?.medicalConditions ? `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #fecdd3; color: #881337;">Conditions</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #fecdd3; font-weight: 500; color: #881337;">${identitySnapshot.medical.medicalConditions}</td>
            </tr>` : ''}
            ${identitySnapshot?.medical?.allergies ? `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #fecdd3; color: #881337;">Allergies</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #fecdd3; font-weight: 500; color: #881337;">${identitySnapshot.medical.allergies}</td>
            </tr>` : ''}
            ${identitySnapshot?.medical?.medications ? `
            <tr>
              <td style="padding: 8px 0; color: #881337;">Medications</td>
              <td style="padding: 8px 0; font-weight: 500; color: #881337;">${identitySnapshot.medical.medications}</td>
            </tr>` : ''}
          </table>
        </div>
        ` : ''}

        <!-- Audio Recording -->
        ${audioClipUrl ? `
        <div style="background-color: #f0fdf4; padding: 16px; border-radius: 6px; border: 1px solid #dcfce7; margin-bottom: 24px;">
          <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 14px; text-transform: uppercase; color: #166534; letter-spacing: 0.5px;">Audio Recording</h3>
          <a href="${audioClipUrl}" style="display: inline-block; background-color: #16a34a; color: white; padding: 10px 16px; text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 14px;">Listen to Recording</a>
        </div>
        ` : ''}

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Automated alert &mdash; do not reply.
        </p>
      </div>
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
