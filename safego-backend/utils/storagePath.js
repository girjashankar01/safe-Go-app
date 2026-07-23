import crypto from 'crypto';

/**
 * Generates a clean, collision-free, production-grade storage path for audio uploads.
 * 
 * Hierarchy: user_<userId>/YYYY/MM/
 * Filename:  <type>_YYYYMMDD_HHmmss_<hexSuffix>.<extension>
 * 
 * Example:   user_12/2026/07/sos_20260724_184211_ab12cd.m4a
 * 
 * @param {Object} options
 * @param {string|number} options.userId - The ID of the user uploading the file
 * @param {string} [options.type='sos'] - The type of recording (e.g., 'sos', 'check-in', 'evidence')
 * @param {string} [options.extension='m4a'] - The file extension
 * @returns {string} The full storage path
 */
export function buildAudioStoragePath({ userId, type = 'sos', extension = 'm4a' }) {
  if (!userId) {
    throw new Error('userId is required to build a storage path');
  }

  const now = new Date();
  
  // Extract UTC components (2-digit padding)
  const YYYY = now.getUTCFullYear();
  const MM = String(now.getUTCMonth() + 1).padStart(2, '0');
  const DD = String(now.getUTCDate()).padStart(2, '0');
  
  const HH = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');

  // 6-character random hex suffix to prevent collisions within the same second
  const hexSuffix = crypto.randomBytes(3).toString('hex');

  // Construct components
  const folderPath = `user_${userId}/${YYYY}/${MM}`;
  const filename = `${type}_${YYYY}${MM}${DD}_${HH}${mm}${ss}_${hexSuffix}.${extension}`;

  return `${folderPath}/${filename}`;
}
