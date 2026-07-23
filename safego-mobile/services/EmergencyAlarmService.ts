import { Vibration } from 'react-native';
import { getSettings } from './SettingsService';
import AudioPlaybackService, { PlaybackPriority } from './AudioPlaybackService';

export type EmergencyAlarmState = 'Idle' | 'Preparing' | 'Playing' | 'Stopping';

interface EmergencyAlarmStateObj {
  status: EmergencyAlarmState;
}

type Listener = (state: EmergencyAlarmStateObj) => void;

class EmergencyAlarmService {
  private status: EmergencyAlarmState = 'Idle';
  private listeners: Set<Listener> = new Set();
  
  private durationTimeout: NodeJS.Timeout | null = null;
  private isEnabledForCurrentSOS: boolean = false;

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }

  public getState(): EmergencyAlarmStateObj {
    return { status: this.status };
  }

  /**
   * Called by SOSService when an emergency starts.
   * Based on the trigger configuration, this will activate the effects.
   */
  public async start() {
    if (this.status !== 'Idle') {
      return; // Ignore duplicate starts, strictly Singleton.
    }

    const settings = await getSettings();
    if (!settings.emergencyAlarmEnabled) return;

    this.isEnabledForCurrentSOS = true;
    this.transitionTo('Preparing');

    // Simulate preparation time for audio loading, etc.
    setTimeout(() => {
      if (this.status === 'Preparing') {
        this.transitionTo('Playing');
      }
    }, 100);
  }

  public stop() {
    this.isEnabledForCurrentSOS = false;
    if (this.status === 'Playing' || this.status === 'Preparing') {
      this.transitionTo('Stopping');
      setTimeout(() => {
        this.transitionTo('Idle');
      }, 50); // Small cleanup delay
    } else {
      this.transitionTo('Idle');
    }
  }

  private async transitionTo(newState: EmergencyAlarmState) {
    this.status = newState;
    
    if (newState === 'Playing') {
      const settings = await getSettings();
      
      // 1. Audio Effect
      if (settings.emergencyAlarmSound) {
        AudioPlaybackService.play('alarm', PlaybackPriority.HIGH, { 
          isLooping: true, 
          playsInSilentMode: true 
        });
      }
      
      // 2. Vibration Effect
      if (settings.emergencyAlarmVibration) {
        Vibration.vibrate([1000, 1000], true); // looping pattern
      }

      // 3. Screen Flash Effect (Handled by observing UI components)
      // 4. Flashlight Effect (Stub)
      
      // Duration
      if (settings.emergencyAlarmDuration > 0) {
        this.durationTimeout = setTimeout(() => {
          this.stop();
        }, settings.emergencyAlarmDuration * 1000);
      }
    } 
    else if (newState === 'Stopping' || newState === 'Idle') {
      if (this.durationTimeout) {
        clearTimeout(this.durationTimeout);
        this.durationTimeout = null;
      }
      
      // Cleanup all effects
      Vibration.cancel();
      AudioPlaybackService.stop();
      // stopFlashlight();
    }

    this.notify();
  }
}

export default new EmergencyAlarmService();
