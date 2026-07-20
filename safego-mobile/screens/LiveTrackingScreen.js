import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';

// ─── Constants ────────────────────────────────────────────────────────────────

// How often the watcher fires (ms). 3 s gives visible updates without hammering the GPS.
const UPDATE_INTERVAL_MS = 3000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(epochMs) {
  const d = new Date(epochMs);
  const date = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  return `${date}  ${time}`;
}

function parseLocationError(e) {
  const msg = e?.message ?? '';
  if (msg.includes('Location services are disabled') || msg.includes('unavailable')) {
    return 'GPS is unavailable. Please enable Location Services on your device.';
  }
  if (msg.includes('timed out') || msg.includes('timeout')) {
    return 'Location request timed out. Move to an open area and try again.';
  }
  if (msg.includes('permission') || msg.includes('denied')) {
    return 'Location permission is not granted. Grant it from the Home screen first.';
  }
  return 'Could not start live tracking. Please try again.';
}

// ─── Pulsing dot ──────────────────────────────────────────────────────────────
// Animates as long as isLive is true; freezes when stopped.

function PulseDot({ isLive }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const animRef = useRef(null);

  useEffect(() => {
    if (isLive) {
      animRef.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scale,   { toValue: 1.6, duration: 700, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
            Animated.timing(opacity, { toValue: 0,   duration: 700, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scale,   { toValue: 1,   duration: 0,   useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1,   duration: 0,   useNativeDriver: true }),
          ]),
        ]),
      );
      animRef.current.start();
    } else {
      animRef.current?.stop();
      scale.setValue(1);
      opacity.setValue(1);
    }

    return () => animRef.current?.stop();
  }, [isLive, scale, opacity]);

  return (
    <View style={dot.wrapper}>
      <Animated.View style={[dot.ring, { transform: [{ scale }], opacity }]} />
      <View style={[dot.core, !isLive && dot.coreOff]} />
    </View>
  );
}

const dot = StyleSheet.create({
  wrapper: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  ring:    { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#16a34a', opacity: 0.35 },
  core:    { width: 10, height: 10, borderRadius: 5, backgroundColor: '#16a34a' },
  coreOff: { backgroundColor: '#9ca3af' },
});

// ─── Data Row ─────────────────────────────────────────────────────────────────

function DataRow({ label, value, unit }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <View style={styles.dataValueRow}>
        <Text style={styles.dataValue}>{value}</Text>
        {unit ? <Text style={styles.dataUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LiveTrackingScreen({ navigation }) {
  const [location,    setLocation]    = useState(null);
  const [isTracking,  setIsTracking]  = useState(false);
  const [initialising, setInitialising] = useState(true); // true until first fix or error
  const [error,       setError]       = useState('');
  const [updateCount, setUpdateCount] = useState(0);

  // Subscription ref — stored outside state so cleanup can always reach it.
  const subscriptionRef = useRef(null);

  // ── Start watcher ────────────────────────────────────────────────────────────
  const startWatcher = async () => {
    setError('');

    // Guard: check permission without re-requesting.
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Location permission is not granted. Grant it from the Home screen first.');
      setInitialising(false);
      return;
    }

    try {
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: UPDATE_INTERVAL_MS,
          distanceInterval: 0, // fire by time, not movement
        },
        (loc) => {
          setLocation(loc);
          setUpdateCount((n) => n + 1);
          setInitialising(false);
        },
      );
      subscriptionRef.current = sub;
      setIsTracking(true);
    } catch (e) {
      setError(parseLocationError(e));
      setInitialising(false);
    }
  };

  // ── Stop watcher ─────────────────────────────────────────────────────────────
  const stopWatcher = () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setIsTracking(false);
  };

  // ── Mount / unmount ──────────────────────────────────────────────────────────
  // Start immediately on mount; always clean up on unmount (prevents GPS leak).
  useEffect(() => {
    startWatcher();
    return () => {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle handler ───────────────────────────────────────────────────────────
  const handleToggle = () => {
    if (isTracking) {
      stopWatcher();
    } else {
      setInitialising(true);
      startWatcher();
    }
  };

  const coords    = location?.coords;
  const timestamp = location?.timestamp;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            stopWatcher(); // always clean up before leaving
            navigation.goBack();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Tracking</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Status banner */}
        <View style={[styles.statusBanner, !isTracking && styles.statusBannerOff]}>
          <PulseDot isLive={isTracking} />
          <View>
            <Text style={[styles.statusText, !isTracking && styles.statusTextOff]}>
              {isTracking ? 'Live' : 'Stopped'}
            </Text>
            {updateCount > 0 ? (
              <Text style={styles.statusSub}>
                {updateCount} update{updateCount !== 1 ? 's' : ''}
                {isTracking ? `  ·  every ${UPDATE_INTERVAL_MS / 1000}s` : ''}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Initial loading */}
        {initialising && !error ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={styles.loadingText}>Acquiring GPS signal…</Text>
          </View>
        ) : null}

        {/* Error */}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Tracking Unavailable</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        ) : null}

        {/* Coordinates card */}
        {coords ? (
          <View style={styles.dataCard}>
            <View style={styles.dataCardHeader}>
              <View style={[styles.dotIndicator, !isTracking && styles.dotIndicatorOff]} />
              <Text style={styles.dataCardLabel}>GPS Coordinates</Text>
            </View>

            <DataRow label="Latitude"  value={coords.latitude.toFixed(6)}  />
            <View style={styles.separator} />
            <DataRow label="Longitude" value={coords.longitude.toFixed(6)} />
            <View style={styles.separator} />
            <DataRow
              label="Accuracy"
              value={coords.accuracy != null ? coords.accuracy.toFixed(1) : '—'}
              unit="m"
            />
            <View style={styles.separator} />
            <DataRow
              label="Last Updated"
              value={timestamp != null ? formatTimestamp(timestamp) : '—'}
            />
          </View>
        ) : null}

        {/* Speed / heading card — shown when available */}
        {coords && (coords.speed != null || coords.heading != null) ? (
          <View style={styles.dataCard}>
            <View style={styles.dataCardHeader}>
              <View style={[styles.dotIndicator, !isTracking && styles.dotIndicatorOff]} />
              <Text style={styles.dataCardLabel}>Motion</Text>
            </View>

            {coords.speed != null ? (
              <>
                <DataRow
                  label="Speed"
                  value={(coords.speed * 3.6).toFixed(1)} // m/s → km/h
                  unit="km/h"
                />
                <View style={styles.separator} />
              </>
            ) : null}

            {coords.heading != null ? (
              <DataRow
                label="Heading"
                value={coords.heading.toFixed(0)}
                unit="°"
              />
            ) : null}
          </View>
        ) : null}

        {/* Stop / Start toggle */}
        <TouchableOpacity
          style={[
            styles.toggleBtn,
            isTracking ? styles.toggleBtnStop : styles.toggleBtnStart,
          ]}
          onPress={handleToggle}
          activeOpacity={0.8}
        >
          <Text style={styles.toggleBtnText}>
            {isTracking ? 'Stop Tracking' : 'Start Tracking'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Updates every {UPDATE_INTERVAL_MS / 1000} seconds using foreground location only.
          {'\n'}No data is sent to any server.
        </Text>
      </ScrollView>
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

  // Scroll
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // Status banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  statusBannerOff: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#15803d',
  },
  statusTextOff: {
    color: '#6b7280',
  },
  statusSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },

  // Loading card
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Error card
  errorCard: {
    backgroundColor: '#fff1f2',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#be123c',
    marginBottom: 6,
  },
  errorBody: {
    fontSize: 14,
    color: '#9f1239',
    lineHeight: 20,
  },

  // Data card
  dataCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  dataCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
    marginRight: 8,
  },
  dotIndicatorOff: {
    backgroundColor: '#9ca3af',
  },
  dataCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Data rows
  dataRow: {
    paddingVertical: 12,
  },
  dataLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  dataValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  dataValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  dataUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },

  // Toggle button
  toggleBtn: {
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  toggleBtnStop: {
    backgroundColor: '#dc2626',
  },
  toggleBtnStart: {
    backgroundColor: '#16a34a',
  },
  toggleBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Disclaimer
  disclaimer: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
  },
});
