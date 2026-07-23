import { AudioModule, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

export type RecordingState = 'Idle' | 'Preparing' | 'Recording' | 'Uploading' | 'Finished';

class AudioRecordingService {
  private state: RecordingState = 'Idle';
  private recording: any = null;

  public getState(): RecordingState {
    return this.state;
  }

  public isRecordingActive(): boolean {
    return this.state === 'Preparing' || this.state === 'Recording';
  }

  /**
   * Record audio for a specific duration.
   * @param durationSeconds 
   * @param onRecordingComplete callback triggered when recording completes
   * @returns localUri or undefined on failure
   */
  public async recordAudio(options: { 
    durationSeconds: number; 
    onRecordingComplete?: () => void 
  }): Promise<string | undefined> {
    const { durationSeconds, onRecordingComplete } = options;
    
    if (this.state !== 'Idle' && this.state !== 'Finished') {
      console.warn('[AudioRecordingService] Cannot start recording while state is', this.state);
      return undefined;
    }

    this.state = 'Preparing';
    let localUri = null;

    try {
      // 1. Request Permission
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        console.log('[AudioRecordingService] Microphone permission not granted');
        this.state = 'Idle';
        return undefined;
      }

      // 2. Setup Audio Mode
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // 3. Start Recording
      console.log('[AudioRecordingService] Starting recording...');
      this.recording = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await this.recording.prepareToRecordAsync();
      this.recording.record();
      this.state = 'Recording';

      // 4. Wait for duration
      await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));

      // 5. Stop Recording
      console.log('[AudioRecordingService] Stopping recording...');
      if (this.state === 'Recording') {
        await this.recording.stop();
        localUri = this.recording.uri;
      }
      
      this.state = 'Finished';
      if (onRecordingComplete) onRecordingComplete();

      if (!localUri) {
        console.warn('[AudioRecordingService] No local URI obtained');
        return undefined;
      }

      console.log('[AudioRecordingService] Recording complete');
      console.log('[AudioRecordingService] URI:\n' + localUri);
      
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (!fileInfo.exists) {
        console.error('[AudioRecordingService] File does not exist');
        return undefined;
      }

      return localUri;
    } catch (error) {
      console.error('[AudioRecordingService] Exception in pipeline:\n', error);
      this.state = 'Idle';
      return undefined;
    } finally {
      try {
        if (this.recording && this.recording.isRecording) {
          await this.recording.stop();
        }
      } catch (cleanupError: any) {
        console.error('[AudioRecordingService] Cleanup error:', cleanupError.message);
      }
    }
  }

  public async stopRecordingEarly() {
    if (this.state === 'Recording' && this.recording) {
      console.log('[AudioRecordingService] Stopping recording early...');
      try {
        await this.recording.stop();
        this.state = 'Finished';
      } catch (e: any) {
        console.error('[AudioRecordingService] Error stopping early:', e.message);
      }
    }
  }
}

export default new AudioRecordingService();
