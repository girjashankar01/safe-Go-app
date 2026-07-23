import { AudioModule, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Record audio.
 * @param {number} durationSeconds
 * @param {Function} onRecordingComplete
 * @returns {Promise<string | undefined>} localUri or undefined on failure
 */
export async function recordAudio({ durationSeconds, onRecordingComplete }) {
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
    
    if (onRecordingComplete) onRecordingComplete();

    if (!localUri) {
      console.warn('[AudioService] No local URI obtained');
      return undefined;
    }

    console.log('[AudioService] Recording complete');
    console.log('[AudioService] URI:\n' + localUri);
    
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
      console.error('[AudioService] File does not exist');
      return undefined;
    }

    return localUri;
  } catch (error) {
    console.error('[AudioService] Exception in pipeline:\n', error);
    return undefined;
  } finally {
    try {
      if (recording && recording.isRecording) {
        await recording.stop();
      }
    } catch (cleanupError) {
      console.error('[AudioService] Cleanup error:', cleanupError.message);
    }
  }
}
