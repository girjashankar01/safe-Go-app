import { Audio } from 'expo-av';
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
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('[AudioService] Microphone permission not granted');
      return undefined;
    }

    // 2. Setup Audio Mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    // 3. Start Recording
    console.log('[AudioService] Starting recording...');
    const { recording: newRecording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recording = newRecording;

    // 4. Wait for duration
    await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));

    // 5. Stop Recording
    console.log('[AudioService] Stopping recording...');
    await recording.stopAndUnloadAsync();
    localUri = recording.getURI();

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
      if (recording) {
        const status = await recording.getStatusAsync();
        if (status.isRecording) {
          await recording.stopAndUnloadAsync();
        }
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
