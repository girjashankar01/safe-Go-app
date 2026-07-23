import * as Crypto from 'expo-crypto';
import { DeviceEventEmitter } from 'react-native';
import { getSettings, saveSettings } from './SettingsService';

/**
 * Emitted when the PinService wants to prompt the user for their PIN.
 */
export const EVENT_REQUEST_PIN = 'PinService:RequestPin';
export const EVENT_HIDE_PIN = 'PinService:HidePin';

class PinService {
  /**
   * Hashes a raw PIN securely using SHA-256.
   * @param pin {string} The raw PIN
   * @returns {Promise<string>} The hashed PIN
   */
  async hashPin(pin: string): Promise<string> {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pin
    );
  }

  /**
   * Checks if PIN protection is enabled in settings.
   */
  async isProtectionEnabled(): Promise<boolean> {
    const settings = await getSettings();
    return settings.requirePinForSOSCancel === true;
  }

  /**
   * Checks if a PIN is currently set (hash exists).
   */
  async hasPin(): Promise<boolean> {
    const settings = await getSettings();
    return !!settings.emergencyPinHash;
  }

  /**
   * Verifies if the given raw PIN matches the stored hash.
   */
  async verifyPin(pin: string): Promise<boolean> {
    const settings = await getSettings();
    if (!settings.emergencyPinHash) return false;
    
    const hash = await this.hashPin(pin);
    return hash === settings.emergencyPinHash;
  }

  /**
   * Sets a new PIN.
   */
  async setPin(pin: string): Promise<void> {
    const hash = await this.hashPin(pin);
    await saveSettings({ emergencyPinHash: hash });
  }

  /**
   * Changes the PIN, provided the old PIN is correct.
   */
  async changePin(oldPin: string, newPin: string): Promise<boolean> {
    const isValid = await this.verifyPin(oldPin);
    if (!isValid) return false;

    await this.setPin(newPin);
    return true;
  }

  /**
   * Removes the PIN.
   */
  async removePin(): Promise<void> {
    await saveSettings({ emergencyPinHash: null });
  }

  /**
   * Triggers a global UI prompt to validate the PIN.
   * Resolves true if validated (or if protection is disabled), false otherwise.
   * @param timeoutMs {number} Optional timeout in milliseconds before automatically cancelling
   */
  async requestPinValidation(timeoutMs?: number): Promise<boolean> {
    const isEnabled = await this.isProtectionEnabled();
    const hasPinSet = await this.hasPin();

    // If protection is off or no PIN is set, immediately allow the action.
    if (!isEnabled || !hasPinSet) {
      return true;
    }

    return new Promise((resolve) => {
      let timer: NodeJS.Timeout | null = null;
      let isResolved = false;

      const handleResult = (result: boolean) => {
        if (isResolved) return;
        isResolved = true;
        if (timer) clearTimeout(timer);
        resolve(result);
      };

      // We pass the resolve function to the modal so it can resolve the promise
      // when the user succeeds or cancels.
      DeviceEventEmitter.emit(EVENT_REQUEST_PIN, {
        onResult: handleResult
      });

      if (timeoutMs) {
        timer = setTimeout(() => {
          DeviceEventEmitter.emit(EVENT_HIDE_PIN);
          handleResult(false);
        }, timeoutMs);
      }
    });
  }
}

export default new PinService();
