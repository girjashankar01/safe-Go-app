import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LocationService from '../services/LocationService';
import MapView, { Marker } from 'react-native-maps';

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
  return 'Could not retrieve location. Please try again.';
}

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

export default function CurrentLocationScreen({ navigation }) {
  const [location, setLocation] = useState(null); // expo-location coords object
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const fetchLocation = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      // Check permission first — don't re-request, just check.
      const hasPerm = await LocationService.ensurePermission();
      if (!hasPerm) {
        setError('Location permission is not granted. Grant it from the Home screen first.');
        return;
      }

      // Single one-shot read.
      const result = await LocationService.getCurrentLocation();
      if (!result) {
        setError('Could not retrieve location. Please try again.');
        return;
      }
      setLocation({ coords: result, timestamp: result.timestamp });
      DeviceEventEmitter.emit('LocationUpdated', result.timestamp ? new Date(result.timestamp).toISOString() : new Date().toISOString());
    } catch (e) {
      setError(parseLocationError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch once on mount.
  useEffect(() => { fetchLocation(); }, [fetchLocation]);

  const coords = location?.coords;
  const timestamp = location?.timestamp;

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
        <Text style={styles.headerTitle}>Current Location</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Loading */}
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={styles.loadingText}>Loading current location…</Text>
          </View>
        ) : null}

        {/* Error */}
        {!loading && error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Location Unavailable</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        ) : null}

        {/* Location data */}
        {!loading && !error && coords ? (
          <View style={styles.dataCard}>
            <View style={styles.dataCardHeader}>
              <View style={styles.dotGreen} />
              <Text style={styles.dataCardLabel}>GPS Fix</Text>
            </View>

            <DataRow
              label="Latitude"
              value={coords.latitude.toFixed(6)}
            />
            <View style={styles.separator} />

            <DataRow
              label="Longitude"
              value={coords.longitude.toFixed(6)}
            />
            <View style={styles.separator} />

            <DataRow
              label="Accuracy"
              value={coords.accuracy != null ? coords.accuracy.toFixed(1) : '—'}
              unit="m"
            />
            <View style={styles.separator} />

            <DataRow
              label="Timestamp"
              value={timestamp != null ? formatTimestamp(timestamp) : '—'}
            />
          </View>
        ) : null}

        {/* Refresh button — always visible, disabled while loading */}
        <TouchableOpacity
          style={[styles.refreshBtn, loading && styles.refreshBtnDisabled]}
          onPress={fetchLocation}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.refreshBtnText}>Refresh Location</Text>
          }
        </TouchableOpacity>

        {/* One-shot disclaimer */}
        <Text style={styles.disclaimer}>
          Each press reads your position once. No continuous tracking is active.
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
    paddingTop: 24,
    paddingBottom: 40,
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
    marginBottom: 20,
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
  dotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
    marginRight: 8,
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

  // Refresh button
  refreshBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  refreshBtnDisabled: {
    opacity: 0.6,
  },
  refreshBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Disclaimer
  disclaimer: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 17,
  },
});
