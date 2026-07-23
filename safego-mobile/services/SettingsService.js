import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@settings';

export const DEFAULT_SETTINGS = {
  sosCountdown: 5,
  sosCooldown: 60,
  recordAudio: true,
  audioRecordingDuration: 15,
  periodicCheckInsEnabled: false,
  checkInIntervalMinutes: 15,
  checkInResponseTimeoutSeconds: 30,
  missedCheckInAction: 'sos',
  requirePinForSOSCancel: false,
  emergencyPinHash: null,
  highAccuracyTracking: true,
  // Fake Call
  fakeCallerName: 'Unknown',
  fakeCallDelay: 10,
  fakeCallRingtone: true,
  fakeCallVibration: true,
  fakeCallAutoEnd: 0,
};

/**
 * Load settings from AsyncStorage.
 * Returns defaults merged with any stored overrides.
 */
export async function getSettings() {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save partial settings updates to AsyncStorage.
 */
export async function saveSettings(updates) {
  try {
    const current = await getSettings();
    const nextSettings = { ...current, ...updates };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    return nextSettings;
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
}

/**
 * Reset settings to default.
 */
export async function resetSettings() {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    return { ...DEFAULT_SETTINGS };
  } catch (error) {
    console.error('Failed to reset settings:', error);
    throw error;
  }
}
