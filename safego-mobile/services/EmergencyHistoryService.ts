import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEmergencyHistory, getEmergencyIncident, getEmergencyAudioUrl } from '../lib/api';

const CACHE_KEY = 'safego_emergency_history';
const CACHE_META_KEY = 'safego_emergency_history_meta';

export interface EmergencyIncident {
  id: string;
  fired_at: string;
  trigger_type: string;
  status: string;
  priority_level: string;
  priority_score: number;
  location_name: string | null;
  recording_duration: number | null;
  recording_size: number | null;
  has_recording: boolean;
  trip_id: string | null;
  // UI Display Fields
  display_type?: string;
  display_status?: string;
}

class EmergencyHistoryService {
  private history: EmergencyIncident[] = [];
  private fetchPromise: Promise<EmergencyIncident[]> | null = null;
  private listeners: Set<() => void> = new Set();
  
  public lastSynced: Date | null = null;
  public historyVersion: number = 0;

  constructor() {
    this.initialize();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public async initialize() {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        this.history = JSON.parse(cached);
      }
      
      const meta = await AsyncStorage.getItem(CACHE_META_KEY);
      if (meta) {
        const parsedMeta = JSON.parse(meta);
        this.lastSynced = parsedMeta.lastSynced ? new Date(parsedMeta.lastSynced) : null;
        this.historyVersion = parsedMeta.historyVersion || 0;
      }
      this.notify();
    } catch (e) {
      console.warn('[EmergencyHistoryService] Failed to load cache', e);
    }
  }

  private mapIncident(incident: any): EmergencyIncident {
    // Map status
    let display_status = 'Unknown';
    if (incident.status === 'completed') display_status = 'Completed';
    else if (incident.status === 'failed') display_status = 'Failed';
    else if (incident.status === 'cancelled') display_status = 'Cancelled';
    else if (incident.status === 'active') display_status = 'Active';

    // Map trigger type
    let display_type = 'Emergency';
    if (incident.trigger_type === 'manual') display_type = 'Manual SOS';
    else if (incident.trigger_type === 'missed_checkin') display_type = 'Missed Safety Check-in';
    else if (incident.trigger_type === 'voice') display_type = 'Voice Activation';
    else if (incident.trigger_type === 'shake') display_type = 'Shake Activation';

    return {
      ...incident,
      display_status,
      display_type,
    };
  }

  public async fetchHistory(page = 1, limit = 20): Promise<EmergencyIncident[]> {
    if (this.fetchPromise && page === 1) {
      return this.fetchPromise;
    }

    const promise = (async () => {
      try {
        const data = await getEmergencyHistory(page, limit);
        const mappedData = data.map(this.mapIncident);
        
        if (page === 1) {
          this.history = mappedData;
          this.lastSynced = new Date();
          this.historyVersion += 1;
          
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(this.history));
          await AsyncStorage.setItem(CACHE_META_KEY, JSON.stringify({
            lastSynced: this.lastSynced.toISOString(),
            historyVersion: this.historyVersion,
          }));
          this.notify();
        }
        
        return mappedData;
      } catch (error) {
        console.error('[EmergencyHistoryService] Error fetching history:', error);
        throw error;
      } finally {
        if (page === 1) {
          this.fetchPromise = null;
        }
      }
    })();

    if (page === 1) {
      this.fetchPromise = promise;
    }
    
    return promise;
  }

  public refresh(): Promise<EmergencyIncident[]> {
    return this.fetchHistory(1, 20);
  }

  public getCachedHistory(): EmergencyIncident[] {
    return this.history;
  }

  public async fetchIncident(id: string): Promise<EmergencyIncident | null> {
    try {
      const data = await getEmergencyIncident(id);
      return this.mapIncident(data);
    } catch (e) {
      console.error('[EmergencyHistoryService] Error fetching incident details:', e);
      return null;
    }
  }

  public async getAudioUrl(id: string): Promise<{ url: string, expiresIn: number } | null> {
    try {
      const res = await getEmergencyAudioUrl(id);
      return { url: res.signedUrl, expiresIn: res.expires_in };
    } catch (e) {
      console.error('[EmergencyHistoryService] Error fetching signed audio URL:', e);
      return null;
    }
  }

  public async clearCache() {
    this.history = [];
    this.lastSynced = null;
    this.historyVersion = 0;
    this.fetchPromise = null;
    
    await AsyncStorage.removeItem(CACHE_KEY);
    await AsyncStorage.removeItem(CACHE_META_KEY);
    
    this.notify();
  }
}

export default new EmergencyHistoryService();
