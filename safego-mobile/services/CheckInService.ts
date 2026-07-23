import { DeviceEventEmitter } from 'react-native';
import { getSettings } from './SettingsService';
import { triggerSOS } from '../lib/api';

export const EVENT_CHECKIN_PROMPT = 'CheckInService:ShowPrompt';
export const EVENT_CHECKIN_HIDE = 'CheckInService:HidePrompt';

class CheckInService {
  private intervalTimer: NodeJS.Timeout | null = null;
  private responseTimer: NodeJS.Timeout | null = null;
  private tripId: string | null = null;
  private isSosActive: boolean = false;

  /**
   * Starts the periodic check-in cycle if enabled in settings.
   */
  async start(tripId: string) {
    this.stop(); // clear any existing timers
    this.tripId = tripId;
    this.isSosActive = false;
    
    const settings = await getSettings();
    if (!settings.periodicCheckInsEnabled) return;

    const intervalMinutes = settings.checkInIntervalMinutes ?? 15;
    const intervalMs = intervalMinutes * 60 * 1000;

    this.intervalTimer = setTimeout(() => {
      this.promptUser();
    }, intervalMs);
    
    console.log(`[CheckInService] Scheduled check-in in ${intervalMinutes} minutes`);
  }

  /**
   * Stops all timers. Permanently stops check-ins if an SOS is triggered.
   */
  stop(dueToSos: boolean = false) {
    if (this.intervalTimer) clearTimeout(this.intervalTimer);
    if (this.responseTimer) clearTimeout(this.responseTimer);
    this.intervalTimer = null;
    this.responseTimer = null;
    
    DeviceEventEmitter.emit(EVENT_CHECKIN_HIDE);

    if (dueToSos) {
      this.isSosActive = true;
      console.log('[CheckInService] Halted completely due to SOS');
    } else if (!this.tripId) {
      console.log('[CheckInService] Stopped');
    }
  }

  /**
   * Prompts the user and starts the response countdown.
   */
  private async promptUser() {
    if (this.isSosActive) return; // Never prompt if SOS is active

    const settings = await getSettings();
    const timeoutSeconds = settings.checkInResponseTimeoutSeconds ?? 30;

    DeviceEventEmitter.emit(EVENT_CHECKIN_PROMPT, {
      timeoutSeconds,
    });

    this.responseTimer = setTimeout(() => {
      this.onTimedOut();
    }, timeoutSeconds * 1000);
  }

  /**
   * Called by the UI when the user presses "I'm Safe".
   */
  onConfirmed() {
    // Hide UI and clear timeout
    DeviceEventEmitter.emit(EVENT_CHECKIN_HIDE);
    if (this.responseTimer) clearTimeout(this.responseTimer);
    this.responseTimer = null;

    // Reschedule next check-in
    if (this.tripId && !this.isSosActive) {
      this.start(this.tripId);
    }
  }

  /**
   * Called when the user fails to respond in time.
   */
  private async onTimedOut() {
    DeviceEventEmitter.emit(EVENT_CHECKIN_HIDE);
    
    if (this.isSosActive || !this.tripId) return;

    const settings = await getSettings();
    const action = settings.missedCheckInAction ?? 'sos';

    console.log(`[CheckInService] Check-in missed. Action: ${action}`);

    // If the action is SOS, halt the service permanently
    if (action === 'sos') {
      this.stop(true);
      try {
        // Trigger SOS without location (backend will use last known location from Trip)
        await triggerSOS({
          tripId: this.tripId,
          triggerType: 'missed_checkin',
        });
      } catch (e) {
        console.error('[CheckInService] Failed to trigger SOS', e);
      }
    } else {
      // Implement other actions (warnings, guardians) in the future.
      // For now, if not 'sos', just reset.
      this.start(this.tripId);
    }
  }
}

export default new CheckInService();
