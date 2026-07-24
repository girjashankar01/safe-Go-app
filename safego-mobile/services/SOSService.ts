import { AppState, AppStateStatus } from 'react-native';
import { getSettings } from './SettingsService';
import { triggerSOS as apiTriggerSOS, uploadSOSAudio } from '../lib/api';
import { getTrip, hasActiveTrip } from '../lib/tripState';
import AudioRecordingService from './AudioRecordingService';
import FileService from './FileService';
import SOSPayloadBuilder from './SOSPayloadBuilder';
import LocationService from './LocationService';
import EmergencyAlarmService from './EmergencyAlarmService';
import ProfileService from './ProfileService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SOSState = 
  | 'IDLE' 
  | 'ACTIVATION_IN_PROGRESS' 
  | 'ACTIVATION_CANCELLED' 
  | 'COUNTDOWN' 
  | 'RECORDING' 
  | 'UPLOADING' 
  | 'SENDING' 
  | 'ACTIVE' 
  | 'FAILED' 
  | 'CANCELLED';

export interface SOSStateObj {
  status: SOSState;
  activationProgress: number;
  countdown: number;
  recordingTimeLeft: number;
  errorMsg: string;
  currentTrigger: string | null;
  startedAt: number | null;
}

type Listener = (state: SOSStateObj) => void;

class SOSService {
  private status: SOSState = 'IDLE';
  private activationProgress: number = 0;
  private countdown: number = 0;
  private recordingTimeLeft: number = 0;
  private errorMsg: string = '';
  private currentTrigger: string | null = null;
  private startedAt: number | null = null;
  
  private listeners: Set<Listener> = new Set();
  
  private activationTimer: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private recordingTimer: NodeJS.Timeout | null = null;
  
  // Recovery payload state
  private pendingPayload: any = null;
  private pendingRecordingUri: string | null = null;
  private pendingDuration: number = 0;

  constructor() {
    AppState.addEventListener('change', this.handleAppStateChange.bind(this));
    this.restore();
  }

  private handleAppStateChange(nextAppState: AppStateStatus) {
    if (nextAppState === 'active') {
      // In case we want to trigger a refresh on foregrounding, we can notify.
      this.notify();
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l(this.getState()));
    this.persist();
  }

  public getState(): SOSStateObj {
    return {
      status: this.status,
      activationProgress: this.activationProgress,
      countdown: this.countdown,
      recordingTimeLeft: this.recordingTimeLeft,
      errorMsg: this.errorMsg,
      currentTrigger: this.currentTrigger,
      startedAt: this.startedAt,
    };
  }

  private async persist() {
    try {
      const stateToSave = {
        status: this.status,
        currentTrigger: this.currentTrigger,
        startedAt: this.startedAt,
      };
      await AsyncStorage.setItem('sos_state', JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Failed to persist SOS state', e);
    }
  }

  public async restore() {
    try {
      const saved = await AsyncStorage.getItem('sos_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        const validInProgressStates = ['RECORDING', 'UPLOADING', 'SENDING', 'ACTIVE'];
        if (validInProgressStates.includes(parsed.status)) {
          this.status = parsed.status as SOSState;
          this.currentTrigger = parsed.currentTrigger;
          this.startedAt = parsed.startedAt;
          this.notify();
        } else {
          // Reset invalid restored states
          this.resetToIdle();
        }
      }
    } catch (e) {
      console.warn('Failed to restore SOS state', e);
    }
  }

  private resetToIdle() {
    this.clearAllTimers();
    this.status = 'IDLE';
    this.activationProgress = 0;
    this.countdown = 0;
    this.recordingTimeLeft = 0;
    this.errorMsg = '';
    this.currentTrigger = null;
    this.startedAt = null;
    this.pendingPayload = null;
    this.pendingRecordingUri = null;
    this.notify();
  }

  private clearAllTimers() {
    if (this.activationTimer) clearInterval(this.activationTimer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.recordingTimer) clearInterval(this.recordingTimer);
    this.activationTimer = null;
    this.countdownTimer = null;
    this.recordingTimer = null;
  }

  private async triggerAlarmIfNeeded(stage: 'immediately' | 'after_upload' | 'after_sent') {
    const settings = await getSettings();
    
    // Avoid iOS audio driver clash by not playing alarm while recording starts
    if (stage === 'immediately' && settings.recordAudio) {
      console.warn('[SOSService] Skipping immediate alarm because audio recording is enabled (prevents OS audio clash).');
      return;
    }

    if (settings.emergencyAlarmEnabled && settings.emergencyAlarmTrigger === stage) {
      EmergencyAlarmService.start();
    }
  }

  public async triggerManualSOS() {
    // Ignore duplicate requests while an SOS is already in progress
    if (this.status !== 'IDLE' && this.status !== 'ACTIVATION_CANCELLED' && this.status !== 'CANCELLED' && this.status !== 'FAILED') {
      return;
    }

    if (!hasActiveTrip()) {
      this.errorMsg = 'Start a trip before sending an SOS.';
      this.status = 'FAILED';
      this.notify();
      return;
    }

    this.resetToIdle();
    this.currentTrigger = 'manual-sos';
    this.startCountdown();
  }

  public cancelActivation() {
    // Kept for API compatibility if needed
    this.status = 'IDLE';
    this.notify();
  }

  public cancelSOS() {
    // Allows cancelling from Countdown or FAILED states
    if (this.status === 'COUNTDOWN' || this.status === 'FAILED') {
      this.clearAllTimers();
      this.status = 'CANCELLED';
      this.notify();

      setTimeout(() => {
        this.resetToIdle();
      }, 1000);
    }
  }

  private async startCountdown() {
    this.status = 'COUNTDOWN';
    this.notify();

    const settings = await getSettings();
    const configuredCountdown = settings.sosCountdown ?? 5;

    if (configuredCountdown > 0) {
      this.countdown = configuredCountdown;
      this.notify();

      this.countdownTimer = setInterval(() => {
        this.countdown -= 1;
        this.notify();

        if (this.countdown <= 0) {
          if (this.countdownTimer) clearInterval(this.countdownTimer);
          this.executeSOS();
        }
      }, 1000);
    } else {
      this.executeSOS();
    }
  }

  private async executeSOS() {
    this.startedAt = Date.now();
    this.status = 'SENDING';
    this.notify();
    
    const trip = getTrip();
    if (!trip || !trip.tripId) {
      this.errorMsg = 'Start a trip before sending an SOS.';
      this.status = 'FAILED';
      this.notify();
      return;
    }

    const settings = await getSettings();
    await this.triggerAlarmIfNeeded('immediately');

    try {
      const locDetails = await LocationService.getCurrentLocationDetails();
      const latitude = locDetails ? locDetails.latitude : 0;
      const longitude = locDetails ? locDetails.longitude : 0;
      const locationName = locDetails ? locDetails.locationName : null;

      const identity = ProfileService.getIdentitySnapshot();

      const payloadBuilder = new SOSPayloadBuilder()
        .setTripInfo(trip.tripId)
        .setLocation(latitude, longitude, locationName)
        .setTriggerType(this.currentTrigger || 'Unknown')
        .setIdentity(identity);

      this.pendingPayload = payloadBuilder; // save for retry

      if (settings.recordAudio) {
        this.status = 'RECORDING';
        const durationSeconds = settings.audioRecordingDuration ?? 15;
        this.recordingTimeLeft = durationSeconds;
        this.notify();
        
        this.recordingTimer = setInterval(() => {
          this.recordingTimeLeft -= 1;
          this.notify();
        }, 1000);
        
        const recordResult = await AudioRecordingService.recordAudio({ 
          durationSeconds,
          onRecordingComplete: () => {
            if (this.recordingTimer) clearInterval(this.recordingTimer);
            this.status = 'UPLOADING';
            this.notify();
          } 
        });

        console.log('[SOS TRACE] 01 - Recording completed. recordResult:', recordResult);
        if (recordResult && recordResult.uri) {
          this.pendingRecordingUri = recordResult.uri;
          this.pendingDuration = recordResult.duration;
          console.log('[SOS TRACE] 02 - Transition -> UPLOADING, calling uploadRecording');
          await this.uploadRecording();
          console.log('[SOS TRACE] XX - Returned from uploadRecording');
        } else {
          // Recording failed to yield URI, continue without it but log issue
          console.warn('[SOSService] Recording completed but no URI returned.');
          console.log('[SOS TRACE] 02b - No URI, calling sendAlert');
          await this.sendAlert();
        }
      } else {
        await this.triggerAlarmIfNeeded('after_upload');
        await this.sendAlert();
      }
    } catch (e: any) {
      this.handleError(e);
    }
  }

  private async uploadRecording() {
    console.log('[SOS TRACE] 03 - uploadRecording entered');
    this.status = 'UPLOADING';
    this.notify();

    if (!this.pendingRecordingUri || !this.pendingPayload) {
      console.log('[SOS TRACE] 04 - Missing pendingRecordingUri or payload, calling sendAlert');
      await this.sendAlert();
      return;
    }

    const trip = getTrip();
    if (!trip || !trip.tripId) {
      this.errorMsg = 'No active trip for upload.';
      this.status = 'FAILED';
      this.notify();
      return;
    }
    
    try {
      console.log('[SOS TRACE] 05 - Getting file metadata started');
      const fileMeta = await FileService.getFileMetadata(this.pendingRecordingUri);
      console.log('[SOS TRACE] 06 - Getting file metadata finished. size:', fileMeta?.size);
      
      const mimeType = 'audio/m4a';
      
      const formData = new FormData();
      formData.append('audio', {
        uri: this.pendingRecordingUri,
        name: 'sos.m4a',
        type: mimeType,
      } as any);
      formData.append('tripId', trip.tripId);
      
      console.log('[SOS TRACE] 07 - Upload started. uri:', this.pendingRecordingUri);
      const uploadRes = await uploadSOSAudio(formData);
      console.log('[SOS TRACE] 08 - Upload completed. res:', uploadRes);
      
      if (uploadRes && uploadRes.success && uploadRes.publicUrl) {
        console.log('[SOS TRACE] 09 - Updating payload with audio info');
        this.pendingPayload.setAudioUrl(uploadRes.publicUrl);
        this.pendingPayload.setAudioMetadata(this.pendingDuration, fileMeta.size, mimeType);
        
        console.log('[SOS TRACE] 10 - Triggering alarm if needed after_upload');
        await this.triggerAlarmIfNeeded('after_upload');
        
        console.log('[SOS TRACE] 11 - Transition -> SENDING, calling sendAlert');
        await this.sendAlert();
      } else {
        throw new Error('Upload response indicated failure');
      }
    } catch (uploadError: any) {
      console.error('[SOS TRACE] stage: Upload, error:', uploadError?.message, '\nstack trace:', uploadError?.stack, '\ninput data:', this.pendingRecordingUri);
      this.errorMsg = 'Failed to upload audio recording.';
      this.status = 'FAILED';
      this.notify();
    }
  }

  private async sendAlert() {
    console.log('[SOS TRACE] 12 - sendAlert entered');
    this.status = 'SENDING';
    this.notify();
    
    try {
      console.log('[SOS TRACE] 13 - Building payload');
      const finalPayload = this.pendingPayload.build();
      
      console.log('[SOS TRACE] 14 - Calling backend with payload:', finalPayload);
      await apiTriggerSOS(finalPayload);
      console.log('[SOS TRACE] 15 - Backend responded');
      
      console.log('[SOS TRACE] 16 - Triggering alarm if needed after_sent');
      await this.triggerAlarmIfNeeded('after_sent');
      
      console.log('[SOS TRACE] 17 - Transition -> ACTIVE');
      this.status = 'ACTIVE';
      this.notify();
    } catch (e: any) {
      console.error('[SOS TRACE] stage: BackendTrigger, error:', e?.message, '\nstack trace:', e?.stack, '\ninput data: pendingPayload');
      this.handleError(e);
    }
  }

  public retryRecording() {
    // Retry goes back to RECORDING stage if that's what failed. 
    // Usually it fails at UPLOADING. Let's retry from upload.
    if (this.status === 'FAILED') {
      if (this.pendingRecordingUri) {
        this.uploadRecording();
      } else {
        this.executeSOS();
      }
    }
  }

  public sendSOSAnyway() {
    // Skip recording/upload and just send the alert
    if (this.status === 'FAILED') {
      this.sendAlert();
    }
  }

  private handleError(e: any) {
    this.status = 'FAILED';
    const status = e?.response?.status;
    const serverMsg = e?.response?.data?.error || '';
    
    if (status === 401) this.errorMsg = 'Please log in again.';
    else if (status === 404) this.errorMsg = 'Trip not found.';
    else if (status === 409) this.errorMsg = serverMsg || 'Conflict updating SOS.';
    else if (status >= 500) this.errorMsg = 'Server error. Please try again.';
    else this.errorMsg = 'Network or system error occurred.';
    
    this.notify();
  }
}

export default new SOSService();
