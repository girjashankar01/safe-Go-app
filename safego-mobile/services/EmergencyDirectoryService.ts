import AsyncStorage from '@react-native-async-storage/async-storage';
import LocationService, { GeocodedLocation } from './LocationService';
import { fetchEmergencyServices } from '../lib/api';
import { getDistanceMeters } from '../utils/DistanceUtils';
import NetInfo from '@react-native-community/netinfo';

export type DirectoryState = 'Loading' | 'Refreshing' | 'Offline' | 'Error' | 'Ready';

export interface EmergencyNumber {
  id: string;
  service_name: string;
  phone_number: string;
  service_type: string;
}

export interface NearbyFacility {
  id: string;
  name: string;
  type: string;
  distance: number;
  lat: number;
  lon: number;
}

type Listener = (state: DirectoryState) => void;

const CACHE_KEY = 'safego_emergency_numbers';
const CACHE_META_KEY = 'safego_emergency_meta';

class EmergencyDirectoryService {
  private state: DirectoryState = 'Loading';
  private listeners: Set<Listener> = new Set();

  private emergencyNumbers: EmergencyNumber[] = [];
  private facilities: NearbyFacility[] = [];
  private currentLocationStr: string = '';
  
  // Request deduplication
  private pendingNumbersPromise: Promise<EmergencyNumber[]> | null = null;
  private pendingFacilitiesPromise: Promise<NearbyFacility[]> | null = null;

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private setState(newState: DirectoryState) {
    if (this.state !== newState) {
      this.state = newState;
      this.listeners.forEach((l) => l(newState));
    }
  }

  public getState() {
    return this.state;
  }

  public getCachedNumbers() {
    return this.emergencyNumbers;
  }

  public getCachedFacilities() {
    return this.facilities;
  }

  public getCurrentLocationStr() {
    return this.currentLocationStr;
  }

  /**
   * Initializes the directory. Loads from cache immediately, then refreshes.
   */
  public async initialize() {
    this.setState('Loading');
    
    try {
      const loc = await LocationService.getReverseGeocodedLocation();
      if (loc && loc.country && loc.state) {
        this.currentLocationStr = `${loc.state}, ${loc.country}`;
      } else {
        this.currentLocationStr = 'Unknown Location';
      }

      await this.loadFromCache();
      
      // Fire refresh async, don't await it here so we show cached data instantly
      this.refresh(loc).catch(e => console.warn(e));
    } catch (e) {
      console.warn('[DirectoryService] init failed', e);
      this.setState('Error');
    }
  }

  /**
   * Refreshes both numbers and facilities based on the location.
   */
  public async refresh(loc?: GeocodedLocation | null) {
    if (this.state !== 'Loading') {
      this.setState('Refreshing');
    }

    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        this.setState('Offline');
        console.log('[DirectoryService Telemetry] Offline. Using cache.');
        return;
      }

      const location = loc || await LocationService.getReverseGeocodedLocation();
      if (!location) {
        this.setState('Error');
        return;
      }

      if (location.country && location.state) {
        this.currentLocationStr = `${location.state}, ${location.country}`;
      }

      // Start both fetches concurrently
      const numbersPromise = this.getEmergencyNumbers(location);
      const facilitiesPromise = this.getNearbyFacilities(location);

      const [numbers, facilities] = await Promise.all([numbersPromise, facilitiesPromise]);
      this.emergencyNumbers = numbers;
      this.facilities = facilities;
      
      this.setState('Ready');
    } catch (e) {
      console.warn('[DirectoryService] Refresh failed', e);
      if (this.emergencyNumbers.length > 0) {
        this.setState('Offline'); // fallback to cached display
      } else {
        this.setState('Error');
      }
    }
  }

  /**
   * Clears the local cache.
   */
  public async clearCache() {
    await AsyncStorage.removeItem(CACHE_KEY);
    await AsyncStorage.removeItem(CACHE_META_KEY);
    this.emergencyNumbers = [];
    console.log('[DirectoryService Telemetry] Cache cleared.');
  }

  private async loadFromCache() {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        this.emergencyNumbers = JSON.parse(cached);
        console.log(`[DirectoryService Telemetry] Cache hit. Loaded ${this.emergencyNumbers.length} numbers.`);
      }
    } catch (e) {
      console.warn('[DirectoryService] Cache read failed', e);
    }
  }

  private async getEmergencyNumbers(loc: GeocodedLocation): Promise<EmergencyNumber[]> {
    if (this.pendingNumbersPromise) {
      console.log('[DirectoryService Telemetry] Request deduplicated (Numbers)');
      return this.pendingNumbersPromise;
    }

    this.pendingNumbersPromise = (async () => {
      try {
        const cacheMetaStr = await AsyncStorage.getItem(CACHE_META_KEY);
        const start = Date.now();
        
        let shouldFetch = true;
        if (cacheMetaStr) {
          const meta = JSON.parse(cacheMetaStr);
          if (meta.country === loc.country && meta.state === loc.state) {
            console.log('[DirectoryService Telemetry] Cache valid for current state/country.');
            // Still fetching for stale-while-revalidate, but if offline it handles it gracefully
            // Actually, we could return here if we wanted strict cache, but user asked to refresh
            // on state change. We are refreshing anyway, but we only block if state changed.
          } else {
            console.log(`[DirectoryService Telemetry] State/Country changed. Cache miss.`);
            this.emergencyNumbers = []; // Clear old state numbers
          }
        } else {
          console.log('[DirectoryService Telemetry] No cache meta. Cache miss.');
        }

        const numbers = await fetchEmergencyServices(loc.country, loc.state, loc.city);
        
        const latency = Date.now() - start;
        console.log(`[DirectoryService Telemetry] API Latency (Numbers): ${latency}ms`);

        if (numbers && numbers.length > 0) {
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(numbers));
          await AsyncStorage.setItem(CACHE_META_KEY, JSON.stringify({ country: loc.country, state: loc.state, updatedAt: new Date().toISOString() }));
          return numbers;
        }
        return this.emergencyNumbers;
      } finally {
        this.pendingNumbersPromise = null;
      }
    })();

    return this.pendingNumbersPromise;
  }

  private async getNearbyFacilities(loc: GeocodedLocation): Promise<NearbyFacility[]> {
    if (this.pendingFacilitiesPromise) {
      console.log('[DirectoryService Telemetry] Request deduplicated (Facilities)');
      return this.pendingFacilitiesPromise;
    }

    this.pendingFacilitiesPromise = (async () => {
      try {
        const start = Date.now();
        const lat = loc.latitude;
        const lon = loc.longitude;
        
        // 10km radius
        const radius = 10000;
        const limit = 10;
        
        const query = `
          [out:json][timeout:8];
          (
            node["amenity"="police"](around:${radius},${lat},${lon});
            node["amenity"="hospital"](around:${radius},${lat},${lon});
            node["amenity"="pharmacy"](around:${radius},${lat},${lon});
          );
          out center ${limit};
        `;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second strict timeout

        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error('Overpass response not ok');
        }

        const data = await response.json();
        const latency = Date.now() - start;
        console.log(`[DirectoryService Telemetry] Overpass Latency: ${latency}ms`);
        
        const facilities: NearbyFacility[] = [];
        
        if (data && data.elements) {
          for (const el of data.elements) {
            if (!el.tags || !el.tags.name) continue;
            
            const elLat = el.lat || el.center?.lat;
            const elLon = el.lon || el.center?.lon;
            if (!elLat || !elLon) continue;

            const dist = getDistanceMeters(lat, lon, elLat, elLon);
            
            let type = 'Facility';
            if (el.tags.amenity === 'police') type = 'Police Station';
            if (el.tags.amenity === 'hospital') type = 'Hospital';
            if (el.tags.amenity === 'pharmacy') type = 'Pharmacy';

            facilities.push({
              id: el.id.toString(),
              name: el.tags.name,
              type,
              distance: dist,
              lat: elLat,
              lon: elLon,
            });
          }
        }

        // Sort by distance and return top 10 overall (though overpass already limits to 10 arbitrary elements, sorting is good UX)
        facilities.sort((a, b) => a.distance - b.distance);
        return facilities.slice(0, 10);
      } catch (e: any) {
        console.log(`[DirectoryService Telemetry] Overpass failed: ${e.message}`);
        // Return existing or empty so it degrades gracefully
        return this.facilities;
      } finally {
        this.pendingFacilitiesPromise = null;
      }
    })();

    return this.pendingFacilitiesPromise;
  }
}

export default new EmergencyDirectoryService();
