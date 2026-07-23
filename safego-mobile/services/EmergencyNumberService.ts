import { getSettings } from './SettingsService';

class EmergencyNumberService {
  /**
   * Resolves the correct emergency number based on the user's explicit setting
   * or falling back to a timezone-based heuristic.
   */
  async getEmergencyNumber(): Promise<string> {
    const settings = await getSettings();
    
    // Explicit override
    if (settings.customEmergencyNumber) {
      return settings.customEmergencyNumber;
    }

    // Timezone heuristic
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      if (tz.includes('Kolkata') || tz.includes('India') || tz.includes('Asia/Calcutta')) {
        return '112';
      }
      
      if (tz.includes('London') || tz.includes('Europe/Belfast')) {
        return '999'; // UK
      }
      
      if (tz.includes('Europe')) {
        return '112'; // EU Standard
      }
      
      if (tz.includes('Australia')) {
        return '000'; // AUS
      }
    } catch (e) {
      console.warn('[EmergencyNumberService] Could not resolve timezone', e);
    }

    // Default Fallback
    return '911';
  }
}

export default new EmergencyNumberService();
