import { Vibration } from 'react-native';
import AudioPlaybackService, { PlaybackPriority } from './AudioPlaybackService';
export type FakeCallState = 'Idle' | 'Scheduled' | 'Incoming' | 'Active' | 'Ended';

export interface FakeCallConfig {
  callerName: string;
  delay: number; // in seconds
  ringtoneEnabled: boolean;
  vibrationEnabled: boolean;
  autoEndDuration: number; // in seconds, 0 = manual
}

export interface FakeCallStateObj {
  status: FakeCallState;
  remainingDelay: number;
  callDuration: number;
  config: FakeCallConfig | null;
}

type Listener = (state: FakeCallStateObj) => void;

class FakeCallService {
  private status: FakeCallState = 'Idle';
  private config: FakeCallConfig | null = null;
  
  // Scheduling Timers
  private targetTimestamp: number | null = null;
  private scheduleInterval: NodeJS.Timeout | null = null;
  
  // Active Call Timers
  private activeCallStartTs: number | null = null;
  private activeInterval: NodeJS.Timeout | null = null;
  private autoEndTimeout: NodeJS.Timeout | null = null;
  
  // Incoming Call Timers (for ringtone/vibration looping)
  private ringVibrateInterval: NodeJS.Timeout | null = null;

  // Observers
  private listeners: Set<Listener> = new Set();

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }

  public getState(): FakeCallStateObj {
    let remainingDelay = 0;
    if (this.status === 'Scheduled' && this.targetTimestamp) {
      remainingDelay = Math.max(0, Math.ceil((this.targetTimestamp - Date.now()) / 1000));
    }

    let callDuration = 0;
    if (this.status === 'Active' && this.activeCallStartTs) {
      callDuration = Math.max(0, Math.floor((Date.now() - this.activeCallStartTs) / 1000));
    }

    return {
      status: this.status,
      remainingDelay,
      callDuration,
      config: this.config,
    };
  }

  public start(config: FakeCallConfig) {
    if (this.status !== 'Idle') {
      console.warn('[FakeCallService] A fake call is already active or scheduled.');
      return;
    }

    this.config = { ...config };
    
    if (this.config.delay <= 0) {
      this.transitionTo('Incoming');
    } else {
      this.targetTimestamp = Date.now() + this.config.delay * 1000;
      this.transitionTo('Scheduled');
    }
  }

  public cancel() {
    if (this.status === 'Scheduled' || this.status === 'Incoming' || this.status === 'Active' || this.status === 'Ended') {
      this.transitionTo('Idle');
    }
  }

  public accept() {
    if (this.status === 'Incoming') {
      this.transitionTo('Active');
    }
  }

  public decline() {
    if (this.status === 'Incoming') {
      this.transitionTo('Idle');
    }
  }

  public end() {
    if (this.status === 'Active') {
      this.transitionTo('Ended');
    }
  }

  public clearEnded() {
    if (this.status === 'Ended') {
      this.transitionTo('Idle');
    }
  }

  private transitionTo(newState: FakeCallState) {
    this.status = newState;
    this.cleanupTimers();

    if (newState === 'Scheduled') {
      // Setup schedule checker (ticks every 500ms to be responsive and survive background pauses well)
      this.scheduleInterval = setInterval(() => {
        if (this.targetTimestamp && Date.now() >= this.targetTimestamp) {
          this.transitionTo('Incoming');
        } else {
          this.notify(); // tick the remainingDelay for UI
        }
      }, 500);
    } 
    else if (newState === 'Incoming') {
      // Start Ringtone & Vibration
      if (this.config?.vibrationEnabled) {
        Vibration.vibrate([1000, 2000], true);
      }
      if (this.config?.ringtoneEnabled) {
        AudioPlaybackService.play('ringtone', PlaybackPriority.MEDIUM, { 
          isLooping: true, 
          playsInSilentMode: false 
        });
      }
    } 
    else if (newState === 'Active') {
      // Stop Ringtone & Vibration
      Vibration.cancel();
      AudioPlaybackService.stop();
      
      this.activeCallStartTs = Date.now();
      
      this.activeInterval = setInterval(() => {
        this.notify(); // tick the duration for UI
      }, 1000);

      // Auto end
      if (this.config && this.config.autoEndDuration > 0) {
        this.autoEndTimeout = setTimeout(() => {
          this.transitionTo('Ended');
        }, this.config.autoEndDuration * 1000);
      }

      // Audio stream stub (would play conversation here)
    } 
    else if (newState === 'Ended') {
      Vibration.cancel();
      // Wait for UI to read 'Ended' state, then UI is responsible for calling clearEnded() if they want to close it, or we can auto-clear after some time.
      // Actually, since UI needs to prompt "Did this help?", we stay in Ended until clearEnded() is called.
    } 
    else if (newState === 'Idle') {
      this.config = null;
      this.targetTimestamp = null;
      this.activeCallStartTs = null;
      Vibration.cancel();
      AudioPlaybackService.stop();
    }

    this.notify();
  }

  private cleanupTimers() {
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
      this.scheduleInterval = null;
    }
    if (this.activeInterval) {
      clearInterval(this.activeInterval);
      this.activeInterval = null;
    }
    if (this.autoEndTimeout) {
      clearTimeout(this.autoEndTimeout);
      this.autoEndTimeout = null;
    }
    if (this.ringVibrateInterval) {
      clearInterval(this.ringVibrateInterval);
      this.ringVibrateInterval = null;
    }
  }
}

// Singleton export
export default new FakeCallService();
