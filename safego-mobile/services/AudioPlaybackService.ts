import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import AudioRecordingService from './AudioRecordingService';
import { AudioAssetType, AudioAssets } from './AudioAssets';

export type PlaybackState = 'Idle' | 'Loading' | 'Playing' | 'Stopping' | 'Released';

export enum PlaybackPriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
}

interface PlaybackRequest {
  asset?: AudioAssetType;
  uri?: string;
  priority: PlaybackPriority;
  isLooping?: boolean;
}

export interface AudioDiagnostic {
  state: PlaybackState;
  asset: AudioAssetType | string | null;
  priority: PlaybackPriority | null;
  isLooping: boolean;
  muted: boolean;
  volume: number;
}

class AudioPlaybackService {
  private state: PlaybackState = 'Idle';
  private currentAsset: AudioAssetType | string | null = null;
  private currentPriority: PlaybackPriority | null = null;
  private player: AudioPlayer | null = null;
  private isLooping: boolean = false;
  
  private queuedRequest: PlaybackRequest | null = null;
  private recordingCheckInterval: ReturnType<typeof setInterval> | null = null;

  public getState(): PlaybackState {
    return this.state;
  }

  public getCurrentTime(): number {
    return this.player?.currentTime || 0;
  }

  public getDuration(): number {
    return this.player?.duration || 0;
  }

  public seekTo(timeMillis: number) {
    if (this.player) {
      this.player.seekTo(timeMillis);
    }
  }

  public getDiagnostic(): AudioDiagnostic {
    return {
      state: this.state,
      asset: this.currentAsset,
      priority: this.currentPriority,
      isLooping: this.isLooping,
      muted: this.player?.muted ?? false,
      volume: this.player?.volume ?? 1.0,
    };
  }

  public async play(
    asset: AudioAssetType, 
    priority: PlaybackPriority = PlaybackPriority.LOW,
    options: { isLooping?: boolean; playsInSilentMode?: boolean } = {}
  ) {
    await this.startPlayback(asset, undefined, priority, options);
  }

  public async playUri(
    uri: string,
    priority: PlaybackPriority = PlaybackPriority.LOW,
    options: { isLooping?: boolean; playsInSilentMode?: boolean } = {}
  ) {
    await this.startPlayback(undefined, uri, priority, options);
  }

  private async startPlayback(
    asset?: AudioAssetType, 
    uri?: string,
    priority: PlaybackPriority = PlaybackPriority.LOW,
    options: { isLooping?: boolean; playsInSilentMode?: boolean } = {}
  ) {
    const identifier = asset || uri || 'unknown';
    console.log(`[AudioPlaybackService] Requested play for ${identifier} with priority ${priority}`);

    // If a recording is active, queue this request (if it's higher or equal to any currently queued)
    if (AudioRecordingService.isRecordingActive()) {
      console.log(`[AudioPlaybackService] Recording active. Queueing ${identifier}.`);
      if (!this.queuedRequest || priority >= this.queuedRequest.priority) {
        this.queuedRequest = { asset, uri, priority, isLooping: options.isLooping };
        this.pollRecordingState();
      }
      return;
    }

    // Priority Check
    if (this.state === 'Playing' || this.state === 'Loading') {
      if (this.currentPriority !== null && priority < this.currentPriority) {
        console.log(`[AudioPlaybackService] Ignoring request. Current priority ${this.currentPriority} > requested ${priority}.`);
        return;
      }
      // If we reach here, new priority is >= current priority. We interrupt.
      console.log(`[AudioPlaybackService] Interrupting current playback (${this.currentAsset}) for new request (${identifier}).`);
      await this.stop();
    }

    this.state = 'Loading';
    this.currentAsset = identifier;
    this.currentPriority = priority;
    this.isLooping = options.isLooping ?? false;

    try {
      // Configure Audio Session based on feature
      await setAudioModeAsync({
        playsInSilentMode: options.playsInSilentMode ?? false,
        allowsRecording: false,
        shouldPlayInBackground: options.playsInSilentMode ?? false, // iOS throws InvalidAudioModeException if playsInSilentMode is false but shouldPlayInBackground is true
        interruptionMode: 'doNotMix',
      });

      const source = asset ? AudioAssets[asset] : uri;
      console.log(`[AudioPlaybackService] Source resolved to:`, source);
      this.player = createAudioPlayer(source as string | number);
      this.player.loop = this.isLooping;

      if ((this.state as PlaybackState) === 'Stopping' || (this.state as PlaybackState) === 'Released') {
        // Stop was called while we were loading
        this.releaseResources();
        return;
      }

      this.player.play();
      this.state = 'Playing';
      console.log(`[AudioPlaybackService] Playing ${identifier}, player object keys:`, Object.keys(this.player));
      
      // Temporary: log status every 1s
      let i = 0;
      const id = setInterval(() => {
        if (!this.player) { clearInterval(id); return; }
        console.log(`[AudioPlaybackService Debug] i=${i} playing=${this.player.playing} duration=${this.player.duration} currentTime=${this.player.currentTime} isLoaded=${this.player.isLoaded}`);
        i++;
      }, 1000);
      
    } catch (e) {
      console.error(`[AudioPlaybackService] Failed to play ${identifier}:`, e);
      this.releaseResources();
    }
  }

  public async stop() {
    if (this.state === 'Idle' || this.state === 'Released') return;
    
    console.log(`[AudioPlaybackService] Stopping playback of ${this.currentAsset}`);
    this.state = 'Stopping';
    
    this.releaseResources();
    
    // Also clear queued request if we are intentionally stopping
    this.queuedRequest = null;
    if (this.recordingCheckInterval) {
      clearInterval(this.recordingCheckInterval);
      this.recordingCheckInterval = null;
    }
  }

  public stopAll() {
    this.stop();
  }

  private releaseResources() {
    if (this.player) {
      try {
        this.player.pause(); // stop the playback
        this.player.release();
      } catch (e) {
        console.warn('[AudioPlaybackService] Error releasing player:', e);
      }
      this.player = null;
    }
    
    this.currentAsset = null;
    this.currentPriority = null;
    this.isLooping = false;
    this.state = 'Released';
    
    // Move back to Idle so it's ready for the next play
    setTimeout(() => {
      if (this.state === 'Released') {
        this.state = 'Idle';
      }
    }, 50);
  }

  private pollRecordingState() {
    if (this.recordingCheckInterval) return;

    this.recordingCheckInterval = setInterval(() => {
      if (!AudioRecordingService.isRecordingActive()) {
        clearInterval(this.recordingCheckInterval!);
        this.recordingCheckInterval = null;
        
        const req = this.queuedRequest;
        if (req) {
          console.log(`[AudioPlaybackService] Recording finished. Starting queued ${req.asset || req.uri}`);
          this.queuedRequest = null;
          if (req.asset) {
            this.play(req.asset, req.priority, { isLooping: req.isLooping });
          } else if (req.uri) {
            this.playUri(req.uri, req.priority, { isLooping: req.isLooping });
          }
        }
      }
    }, 1000);
  }
}

export default new AudioPlaybackService();
