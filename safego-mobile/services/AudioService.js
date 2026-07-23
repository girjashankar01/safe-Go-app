import { AudioModule, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';
import { decode } from 'base64-arraybuffer';

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
export async function recordAndUpload({ tripId, durationSeconds, onRecordingComplete }) {
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
    // 5. Stop Recording
    console.log('[AudioService] Stopping recording...');
    await recording.stop();
    localUri = recording.uri;
    
    if (onRecordingComplete) onRecordingComplete();

    if (!localUri) {
      console.warn('[AudioService] No local URI obtained');
      return undefined;
    }

    console.log('[AudioService] Recording complete');
    console.log('[AudioService] URI:\n' + localUri);
    
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    console.log('[AudioService] Exists:\n' + fileInfo.exists);
    if (!fileInfo.exists) {
      console.error('[AudioService] File does not exist, aborting upload');
      return undefined;
    }
    console.log('[AudioService] Size:\n' + fileInfo.size + ' bytes');

    // 6. Read to ArrayBuffer
    console.log('[AudioService] Reading local file...');
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    console.log('[AudioService] Base64 conversion complete');
    
    console.log('[AudioService] Creating ArrayBuffer...');
    const arrayBuffer = decode(base64);

    // 7. Upload to Supabase (10s timeout)
    const timestamp = Date.now();
    const filename = `sos-${tripId}-${timestamp}.m4a`;

    console.log(`[AudioService] Upload started...`);
    const uploadPromise = supabase.storage
      .from('audio-clips')
      .upload(filename, arrayBuffer, {
        contentType: 'audio/m4a',
      });

    const { data, error } = await uploadWithTimeout(uploadPromise, 10000);

    if (error) {
      console.error('[AudioService] Upload error:\n', error);
      console.error('[AudioService] Upload failed');
      return undefined;
    }
    
    if (!data) {
      console.error('[AudioService] Upload error: No data returned');
      console.error('[AudioService] Upload failed');
      return undefined;
    }
    
    console.log('[AudioService] Upload response:\n', JSON.stringify(data));
    console.log('[AudioService] Upload success');

    // 8. Get Public URL
    const { data: urlData } = supabase.storage
      .from('audio-clips')
      .getPublicUrl(filename);

    if (!urlData?.publicUrl) {
      console.error('[AudioService] Failed to obtain public URL');
      return undefined;
    }

    console.log('[AudioService] Generated public URL');
    console.log('[AudioService] Public URL:\n' + urlData.publicUrl);
    
    console.log('[AudioService] Returning URL');
    return urlData.publicUrl;

  } catch (error) {
    console.error('[AudioService] Exception in pipeline:\n', error);
    console.error('[AudioService] Stack trace:\n', error.stack);
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
