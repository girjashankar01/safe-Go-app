import { AudioModule, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';

/**
 * Helper to upload with a strict timeout.
 */
function uploadWithTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Upload timed out'));
    }, ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Record audio and upload to Supabase.
 * @param {string} tripId
 * @param {number} durationSeconds
 * @returns {Promise<string | undefined>} publicUrl or undefined on failure
 */
export async function recordAndUpload({ tripId, durationSeconds }) {
  let recording = null;
  let localUri = null;

  try {
    // 1. Request Permission
    const { status } = await requestRecordingPermissionsAsync();
    if (status !== 'granted') {
      console.log('[AudioService] Microphone permission not granted');
      return undefined;
    }

    // 2. Setup Audio Mode
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    // 3. Start Recording
    console.log('[AudioService] Starting recording...');
    recording = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
    await recording.prepareToRecordAsync();
    recording.record();

    // 4. Wait for duration
    await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));

    // 5. Stop Recording
    console.log('[AudioService] Stopping recording...');
    await recording.stop();
    localUri = recording.uri;

    if (!localUri) {
      console.warn('[AudioService] No local URI obtained');
      return undefined;
    }

    // 6. Read to Blob
    const response = await fetch(localUri);
    const blob = await response.blob();

    // 7. Upload to Supabase (10s timeout)
    const timestamp = Date.now();
    const filename = `sos-${tripId}-${timestamp}.m4a`;

    console.log(`[AudioService] Uploading ${filename}...`);
    const uploadPromise = supabase.storage
      .from('audio-clips')
      .upload(filename, blob, {
        contentType: 'audio/m4a',
      });

    const { data, error } = await uploadWithTimeout(uploadPromise, 10000);

    if (error || !data) {
      console.error('[AudioService] Supabase upload failed:', error?.message);
      return undefined;
    }

    // 8. Get Public URL
    const { data: urlData } = supabase.storage
      .from('audio-clips')
      .getPublicUrl(filename);

    if (!urlData?.publicUrl) {
      console.error('[AudioService] Failed to obtain public URL');
      return undefined;
    }

    console.log('[AudioService] Upload successful:', urlData.publicUrl);
    return urlData.publicUrl;

  } catch (error) {
    console.error('[AudioService] Exception in pipeline:', error.message);
    return undefined;
  } finally {
    // Cleanup
    try {
      if (recording && recording.isRecording) {
        await recording.stop();
      }
      if (localUri) {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
        console.log('[AudioService] Cleaned up local file');
      }
    } catch (cleanupError) {
      console.error('[AudioService] Cleanup error:', cleanupError.message);
    }
  }
}
