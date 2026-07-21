import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

// ─── Constants ────────────────────────────────────────────────────────────────

const UPDATE_INTERVAL_MS = 3000;

// Reasonable city-level zoom delta.
const DELTA = 0.01;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MapScreen({ navigation }) {
  const [coords,      setCoords]      = useState(null);  // { latitude, longitude }
  const [permDenied,  setPermDenied]  = useState(false);
  const [initialising, setInitialising] = useState(true);

  const mapRef          = useRef(null);
  const subscriptionRef = useRef(null);
  // True after the camera has been centred on the first GPS fix.
  // All subsequent GPS updates move only the Marker — not the camera.
  const centredOnce     = useRef(false);
  // Computed once on mount; never changes so MapView's initialRegion is stable.
  const initialRegionRef = useRef({
    latitude:       12.9716,
    longitude:      77.5946,
    latitudeDelta:  DELTA,
    longitudeDelta: DELTA,
  });

  // ── Start watcher ───────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const start = async () => {
      const { status } = await Location.getForegroundPermissionsAsync();

      if (status !== 'granted') {
        if (mounted) {
          setPermDenied(true);
          setInitialising(false);
        }
        return;
      }

      try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy:         Location.Accuracy.High,
            timeInterval:     UPDATE_INTERVAL_MS,
            distanceInterval: 0,
          },
          (loc) => {
            if (!mounted) return;

            const next = {
              latitude:  loc.coords.latitude,
              longitude: loc.coords.longitude,
            };

            setCoords(next);
            setInitialising(false);

            // Centre the camera ONLY on the first fix.
            // After that the user owns the camera — never fight them.
            if (!centredOnce.current) {
              centredOnce.current = true;
              // Also update initialRegion ref so the MapView has the right
              // starting position if it ever re-mounts.
              initialRegionRef.current = {
                ...next,
                latitudeDelta:  DELTA,
                longitudeDelta: DELTA,
              };
              mapRef.current?.animateToRegion(initialRegionRef.current, 400);
            }
            // Subsequent fixes: only the Marker coordinate prop changes.
          },
        );

        if (mounted) {
          subscriptionRef.current = sub;
        } else {
          // Component unmounted before the subscription resolved — clean up immediately.
          sub.remove();
        }
      } catch {
        if (mounted) setInitialising(false);
      }
    };

    start();

    return () => {
      mounted = false;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Permission denied ───────────────────────────────────────────────────────
  if (permDenied) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Map</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.permTitle}>Location permission required.</Text>
          <Text style={styles.permBody}>
            Grant location access from the Home screen, then return here.
          </Text>
          <TouchableOpacity style={styles.returnBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Text style={styles.returnBtnText}>Return to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Map</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Map — fills remaining space */}
      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegionRef.current}
          showsUserLocation={false}   // we draw our own marker
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          moveOnMarkerPress={false}
        >
          {coords ? (
            <Marker
              coordinate={coords}
              title="You are here"
              pinColor="#16a34a"
            />
          ) : null}
        </MapView>

        {/* Acquiring overlay — shown until first fix */}
        {initialising ? (
          <View style={styles.acquiringOverlay}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={styles.acquiringText}>Acquiring GPS…</Text>
          </View>
        ) : null}
      </View>

      {/* Coordinate strip below the map */}
      <View style={styles.coordStrip}>
        {coords ? (
          <>
            <View style={styles.coordItem}>
              <Text style={styles.coordLabel}>Latitude</Text>
              <Text style={styles.coordValue}>{coords.latitude.toFixed(6)}</Text>
            </View>
            <View style={styles.coordDivider} />
            <View style={styles.coordItem}>
              <Text style={styles.coordLabel}>Longitude</Text>
              <Text style={styles.coordValue}>{coords.longitude.toFixed(6)}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.waitingText}>Waiting for GPS…</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backBtnText: {
    fontSize: 15,
    color: '#16a34a',
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  headerSpacer: {
    width: 60,
  },

  // Map
  mapWrapper: {
    flex: 1,
  },
  map: {
    flex: 1,
    width: '100%',
  },

  // Acquiring overlay
  acquiringOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(249,250,251,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acquiringText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Coordinate strip
  coordStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 70,
  },
  coordItem: {
    flex: 1,
    alignItems: 'center',
  },
  coordLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  coordValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  coordDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
  },
  waitingText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },

  // Permission denied
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
    textAlign: 'center',
  },
  permBody: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  returnBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  returnBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
