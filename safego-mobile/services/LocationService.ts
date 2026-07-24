import * as Location from 'expo-location';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  timestamp: number;
}

export interface GeocodedLocation extends LocationData {
  country: string | null;
  state: string | null;
  city: string | null;
}

export interface LocationDetails {
  latitude: number;
  longitude: number;
  locationName: string | null;
}

class LocationService {
  /**
   * Ensure permissions are granted.
   */
  async ensurePermission(): Promise<boolean> {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') return true;
    
    // Request if not granted (though typically we should just check, 
    // but the app's UX might prefer explicit request here or upfront).
    const { status: reqStatus } = await Location.requestForegroundPermissionsAsync();
    return reqStatus === 'granted';
  }

  /**
   * Check if location services are enabled on the device.
   */
  async hasServicesEnabled(): Promise<boolean> {
    return await Location.hasServicesEnabledAsync();
  }

  /**
   * Retrieves the current high-accuracy coordinates.
   */
  async getCurrentLocation(): Promise<LocationData | null> {
    const hasPerm = await this.ensurePermission();
    if (!hasPerm) {
      console.warn('[LocationService] Permission not granted');
      return null;
    }

    try {
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracy: result.coords.accuracy,
        speed: result.coords.speed,
        timestamp: result.timestamp,
      };
    } catch (e: any) {
      console.warn('[LocationService] Failed to get current location', e.message);
      return null;
    }
  }

  /**
   * Retrieves current coordinates and performs reverse geocoding to resolve country/state/city.
   */
  async getReverseGeocodedLocation(): Promise<GeocodedLocation | null> {
    const loc = await this.getCurrentLocation();
    if (!loc) return null;

    try {
      const geocodeResult = await Location.reverseGeocodeAsync({
        latitude: loc.latitude,
        longitude: loc.longitude,
      });

      if (geocodeResult && geocodeResult.length > 0) {
        const primary = geocodeResult[0];
        return {
          ...loc,
          country: primary.isoCountryCode || primary.country || null, // e.g., 'IN'
          state: primary.region || null, // e.g., 'Karnataka'
          city: primary.city || primary.subregion || null, // e.g., 'Bengaluru'
        };
      }

      return {
        ...loc,
        country: null,
        state: null,
        city: null,
      };
    } catch (e: any) {
      console.warn('[LocationService] Failed to reverse geocode', e.message);
      return {
        ...loc,
        country: null,
        state: null,
        city: null,
      };
    }
  }

  /**
   * Retrieves coordinates and a combined human-readable location name in one call.
   */
  async getCurrentLocationDetails(): Promise<LocationDetails | null> {
    const loc = await this.getReverseGeocodedLocation();
    if (!loc) return null;

    let locationName = null;
    if (loc.city || loc.state || loc.country) {
      locationName = [loc.city, loc.state, loc.country].filter(Boolean).join(', ');
    }

    return {
      latitude: loc.latitude,
      longitude: loc.longitude,
      locationName
    };
  }

  /**
   * Watches the location with high accuracy.
   */
  async watchLocation(onUpdate: (loc: LocationData) => void): Promise<Location.LocationSubscription | null> {
    const hasPerm = await this.ensurePermission();
    if (!hasPerm) return null;

    try {
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 0,
        },
        (loc) => {
          onUpdate({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy,
            speed: loc.coords.speed === -1 ? null : loc.coords.speed,
            timestamp: loc.timestamp,
          });
        }
      );
      return sub;
    } catch (e: any) {
      console.warn('[LocationService] Failed to watch location', e.message);
      return null;
    }
  }
}

export default new LocationService();
