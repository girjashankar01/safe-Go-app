import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMe, uploadAvatar, updateProfile } from '../lib/api';
import NetInfo from '@react-native-community/netinfo';

const CACHE_KEY = 'safego_user_profile';

export type ProfileState = 'Loading' | 'Ready' | 'Syncing' | 'Offline' | 'Error';

export interface PersonalInfo {
  fullName: string;
  preferredName?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  bloodGroup?: string;
  avatarUrl?: string;
}

export interface MedicalInfo {
  allergies?: string;
  medicalConditions?: string;
  medications?: string;
}

export interface UserProfile {
  version: number;
  updatedAt: string;
  personal: PersonalInfo;
  medical: MedicalInfo;
}

const defaultProfile: UserProfile = {
  version: 1,
  updatedAt: new Date().toISOString(),
  personal: {
    fullName: '',
  },
  medical: {},
};

export interface IdentitySnapshot {
  snapshot: {
    personal: PersonalInfo;
    medical: MedicalInfo;
  };
  version: number;
  updatedAt: string;
}

class ProfileService {
  private currentProfile: UserProfile = JSON.parse(JSON.stringify(defaultProfile));
  private status: ProfileState = 'Loading';
  private listeners: Set<(profile: UserProfile, status: ProfileState) => void> = new Set();
  
  public subscribe(listener: (profile: UserProfile, status: ProfileState) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentProfile, this.status);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l(this.currentProfile, this.status));
  }

  private setStatus(newStatus: ProfileState) {
    this.status = newStatus;
    this.notify();
  }

  public getProfile(): UserProfile {
    return this.currentProfile;
  }
  
  public getStatus(): ProfileState {
    return this.status;
  }

  public getIdentitySnapshot(): IdentitySnapshot {
    return {
      snapshot: {
        personal: this.currentProfile.personal,
        medical: this.currentProfile.medical,
      },
      version: this.currentProfile.version,
      updatedAt: this.currentProfile.updatedAt,
    };
  }

  private validateProfile(profile: UserProfile): UserProfile {
    // Basic validation to prevent corrupt data
    const p = profile.personal;
    
    if (p.bloodGroup && !['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].includes(p.bloodGroup)) {
      p.bloodGroup = undefined;
    }
    
    if (p.dateOfBirth) {
      const dobDate = new Date(p.dateOfBirth);
      if (isNaN(dobDate.getTime())) {
        p.dateOfBirth = undefined;
      }
    }
    
    if (!p.fullName || typeof p.fullName !== 'string') {
      p.fullName = '';
    }

    if (p.avatarUrl && !p.avatarUrl.startsWith('http')) {
      p.avatarUrl = undefined;
    }

    return profile;
  }

  public async load(): Promise<void> {
    this.setStatus('Loading');
    try {
      // 1. Load from cache
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        this.currentProfile = this.validateProfile(JSON.parse(cached));
        this.setStatus('Ready'); // Display immediately
      } else {
        const me = await getMe();
        if (me && me.name && !this.currentProfile.personal.fullName) {
          this.currentProfile.personal.fullName = me.name;
          this.setStatus('Ready');
        }
      }

      // 2. Fetch latest from Supabase
      await this.refresh();
      
    } catch (e) {
      console.warn('[ProfileService] Failed to load profile from cache', e);
      this.setStatus('Error');
    }
  }

  public async refresh(): Promise<void> {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      this.setStatus('Offline');
      return;
    }

    try {
      this.setStatus('Syncing');
      
      const me = await getMe();
      if (!me) {
        this.setStatus('Error');
        return;
      }

      let fetchedProfile: UserProfile = this.validateProfile({
        version: 1,
        updatedAt: new Date().toISOString(),
        personal: {
          fullName: me.name || '',
          preferredName: me.preferred_name || undefined,
          dateOfBirth: me.date_of_birth || undefined,
          bloodGroup: me.blood_group || undefined,
          avatarUrl: me.avatar_url || undefined,
        },
        medical: {
          medicalConditions: me.medical_conditions || undefined,
          allergies: me.allergies || undefined,
          medications: me.medications || undefined,
        }
      });

      const isDifferent = JSON.stringify(this.currentProfile) !== JSON.stringify(fetchedProfile);
      
      if (isDifferent) {
        this.currentProfile = fetchedProfile;
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(this.currentProfile));
      }
      this.setStatus('Ready');
    } catch (e) {
      console.warn('[ProfileService] Failed to fetch latest profile', e);
      this.setStatus('Error');
    }
  }

  public async save(updates: Partial<PersonalInfo & MedicalInfo>): Promise<void> {
    // 1. Optimistic Update
    this.currentProfile = {
      ...this.currentProfile,
      version: this.currentProfile.version + 1,
      updatedAt: new Date().toISOString(),
      personal: {
        ...this.currentProfile.personal,
        fullName: updates.fullName !== undefined ? updates.fullName : this.currentProfile.personal.fullName,
        preferredName: updates.preferredName !== undefined ? updates.preferredName : this.currentProfile.personal.preferredName,
        dateOfBirth: updates.dateOfBirth !== undefined ? updates.dateOfBirth : this.currentProfile.personal.dateOfBirth,
        bloodGroup: updates.bloodGroup !== undefined ? updates.bloodGroup : this.currentProfile.personal.bloodGroup,
        avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : this.currentProfile.personal.avatarUrl,
      },
      medical: {
        ...this.currentProfile.medical,
        allergies: updates.allergies !== undefined ? updates.allergies : this.currentProfile.medical.allergies,
        medicalConditions: updates.medicalConditions !== undefined ? updates.medicalConditions : this.currentProfile.medical.medicalConditions,
        medications: updates.medications !== undefined ? updates.medications : this.currentProfile.medical.medications,
      }
    };
    
    this.currentProfile = this.validateProfile(this.currentProfile);

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(this.currentProfile));
    this.setStatus('Syncing');

    // 2. Background Sync
    try {
      const p = this.currentProfile.personal;
      const m = this.currentProfile.medical;

      await updateProfile({
        name: p.fullName,
        preferred_name: p.preferredName || null,
        date_of_birth: p.dateOfBirth || null,
        blood_group: p.bloodGroup || null,
        medical_conditions: m.medicalConditions || null,
        allergies: m.allergies || null,
        medications: m.medications || null,
      });

      this.setStatus('Ready');
    } catch (e) {
      console.error('[ProfileService] Failed to sync profile update', e);
      this.setStatus('Error');
    }
  }

  public async uploadAvatar(uri: string, base64?: string): Promise<string | null> {
    this.setStatus('Syncing');
    try {
      if (!base64) {
        throw new Error('Base64 image data is required for upload');
      }

      const fileExt = uri.split('.').pop() || 'jpg';
      const response = await uploadAvatar(base64, fileExt);
      
      const timestampedUrl = response.avatarUrl;
      await this.save({ avatarUrl: timestampedUrl });
      return timestampedUrl;

    } catch (e: any) {
      console.error('[ProfileService] Failed to upload avatar', e.message);
      this.setStatus('Error');
      return null;
    }
  }

  public async removeAvatar(): Promise<void> {
    this.setStatus('Syncing');
    try {
      await updateProfile({ avatar_url: null });
      this.currentProfile.personal.avatarUrl = undefined;
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(this.currentProfile));
      this.setStatus('Ready');
    } catch (e: any) {
      console.error('[ProfileService] Failed to remove avatar', e.message);
      this.setStatus('Error');
    }
  }

  public async clearCache(): Promise<void> {
    this.currentProfile = JSON.parse(JSON.stringify(defaultProfile));
    await AsyncStorage.removeItem(CACHE_KEY);
    this.setStatus('Loading');
  }
}

export default new ProfileService();
