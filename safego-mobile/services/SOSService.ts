import { getSettings } from './SettingsService';
import { triggerSOS as apiTriggerSOS, uploadSOSAudio } from '../lib/api';
import { getTrip, hasActiveTrip } from '../lib/tripState';
import AudioRecordingService from './AudioRecordingService';
import * as Location from 'expo-location';
import EmergencyAlarmService from './EmergencyAlarmService';
import ProfileService from './ProfileService';

export type SOSState = 'idle' | 'countdown' | 'recording' | 'uploading' | 'sending' | 'success' | 'cooldown' | 'error';

export interface SOSStateObj {
  status: SOSState;
  countdown: number;
  recordingTimeLeft: number;
  cooldownRemaining: number;
  errorMsg: string;
}

type Listener = (state: SOSStateObj) => void;

class SOSService {
  private status: SOSState = 'idle';
  private countdown: number = 0;
  private recordingTimeLeft: number = 0;
  private cooldownRemaining: number = 0;
  private errorMsg: string = '';
  
  private listeners: Set<Listener> = new Set();
  
  private countdownTimer: NodeJS.Timeout | null = null;
  private recordingTimer: NodeJS.Timeout | null = null;
  private cooldownTimer: NodeJS.Timeout | null = null;
  
  private currentTriggerType: string = 'manual';

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l(this.getState()));
  }

  public getState(): SOSStateObj {
    return {
      status: this.status,
      countdown: this.countdown,
      recordingTimeLeft: this.recordingTimeLeft,
      cooldownRemaining: this.cooldownRemaining,
      errorMsg: this.errorMsg,
    };
  }

  private async getLatestLocation() {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return { latitude: null, longitude: null };

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude:  loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
    } catch {
      return { latitude: null, longitude: null };
    }
  }

  private async triggerAlarmIfNeeded(stage: 'immediately' | 'after_upload' | 'after_sent') {
    const settings = await getSettings();
    if (settings.emergencyAlarmEnabled && settings.emergencyAlarmTrigger === stage) {
      EmergencyAlarmService.start();
    }
  }

  public async startSOS(triggerType: string = 'manual') {
    if (this.status !== 'idle' && this.status !== 'error') return;
    
    console.log('[SOSService] startSOS called. hasActiveTrip:', hasActiveTrip());
    if (!hasActiveTrip()) {
      console.log('[SOSService] Error: No active trip in hasActiveTrip()');
      this.errorMsg = 'Start a trip before sending an SOS.';
      this.status = 'error';
      this.notify();
      return;
    }

    this.currentTriggerType = triggerType;
    this.errorMsg = '';
    
    const settings = await getSettings();
    const configuredCountdown = settings.sosCountdown ?? 5;
    
    if (configuredCountdown > 0 && triggerType === 'manual') {
      this.countdown = configuredCountdown;
      this.status = 'countdown';
      this.notify();
      
      this.countdownTimer = setInterval(() => {
        this.countdown -= 1;
        if (this.countdown <= 0) {
          if (this.countdownTimer) clearInterval(this.countdownTimer);
          this.executeSOS();
        } else {
          this.notify();
        }
      }, 1000);
    } else {
      // Instant SOS
      this.executeSOS();
    }
  }

  public cancelSOS() {
    if (this.status === 'countdown') {
      if (this.countdownTimer) clearInterval(this.countdownTimer);
      this.status = 'idle';
      this.countdown = 0;
      this.notify();
    }
  }

  public resetError() {
    if (this.status === 'error') {
      this.status = 'idle';
      this.errorMsg = '';
      this.notify();
    }
  }

  private async executeSOS() {
    this.status = 'sending'; // Initial state before recording
    this.notify();
    
    const trip = getTrip();
    console.log('[SOSService] executeSOS. trip:', trip);
    if (!trip || !trip.tripId) {
      console.log('[SOSService] Error: Missing tripId in executeSOS');
      this.errorMsg = 'Start a trip before sending an SOS.';
      this.status = 'error';
      this.notify();
      return;
    }

    const settings = await getSettings();
    await this.triggerAlarmIfNeeded('immediately');

    try {
      const { latitude, longitude } = await this.getLatestLocation();
      const identity = ProfileService.getIdentitySnapshot();

      const payload: any = {
        tripId: trip.tripId,
        lat: latitude,
        lng: longitude,
        triggerType: this.currentTriggerType,
        identitySnapshot: identity,
      };

      if (settings.recordAudio) {
        this.status = 'recording';
        const durationSeconds = settings.audioRecordingDuration ?? 15;
        this.recordingTimeLeft = durationSeconds;
        this.notify();
        
        this.recordingTimer = setInterval(() => {
          this.recordingTimeLeft -= 1;
          this.notify();
        }, 1000);
        
        const localUri = await AudioRecordingService.recordAudio({ 
          durationSeconds,
          onRecordingComplete: () => {
            if (this.recordingTimer) clearInterval(this.recordingTimer);
            this.status = 'uploading';
            this.notify();
          } 
        });

        if (localUri) {
          try {
            const formData = new FormData();
            formData.append('audio', {
              uri: localUri,
              name: 'sos.m4a',
              type: 'audio/m4a',
            } as any);
            formData.append('tripId', trip.tripId);
            
            const uploadRes = await uploadSOSAudio(formData);
            if (uploadRes && uploadRes.success && uploadRes.publicUrl) {
              payload.audioClipUrl = uploadRes.publicUrl;
              await this.triggerAlarmIfNeeded('after_upload');
            }
          } catch (uploadError) {
            console.error('[SOSService] Backend upload failed');
          }
        }
      } else {
        // If not recording audio, we jump straight to 'after_upload' equivalent
        await this.triggerAlarmIfNeeded('after_upload');
      }

      this.status = 'sending';
      this.notify();
      
      await apiTriggerSOS(payload);
      
      await this.triggerAlarmIfNeeded('after_sent');
      
      this.status = 'success';
      this.notify();

      setTimeout(() => {
        this.cooldownRemaining = settings.sosCooldown ?? 60;
        this.status = 'cooldown';
        this.notify();
        
        this.cooldownTimer = setInterval(() => {
          this.cooldownRemaining -= 1;
          if (this.cooldownRemaining <= 0) {
            if (this.cooldownTimer) clearInterval(this.cooldownTimer);
            this.status = 'idle';
          }
          this.notify();
        }, 1000);
      }, 2000);

    } catch (e: any) {
      this.status = 'error';
      const status = e.response?.status;
      const serverMsg = e.response?.data?.error || '';
      
      if (status === 401) this.errorMsg = 'Please log in again.';
      else if (status === 404) this.errorMsg = 'Trip not found.';
      else if (status === 409) this.errorMsg = serverMsg || 'Conflict updating SOS.';
      else if (status >= 500) this.errorMsg = 'Server error. Please try again.';
      else this.errorMsg = 'Unable to contact server.';
      
      this.notify();
    }
  }
}

export default new SOSService();
