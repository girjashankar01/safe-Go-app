import { getToken } from './storage';
import { getMe } from '../lib/api';
import { restoreTrip } from '../lib/tripState';
import { getSettings } from './SettingsService';
import ProfileService from './ProfileService';
import { connectSocket } from '../lib/socket';

class BootstrapService {
  public async initialize(): Promise<{ route: string; user?: any }> {
    try {
      // 1. Auth check
      const token = await getToken();
      if (!token) {
        return { route: 'Login' };
      }

      // 2. Validate token and get user
      const user = await getMe();
      if (!user) {
        return { route: 'Login' };
      }

      // 3. Restore trip state
      await restoreTrip();

      // 4. Preload Settings
      await getSettings();

      // 5. Preload Safety Identity
      await ProfileService.load();

      // 6. Connect Socket
      connectSocket();

      return { route: 'Home', user };
    } catch (e) {
      console.warn('[BootstrapService] Initialization failed:', e);
      return { route: 'Login' };
    }
  }
}

export default new BootstrapService();
