import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme, typography } from '../theme';
import { getTrip } from '../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTripDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTripTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDuration(seconds) {
  if (seconds == null) return '';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs} hr ${mins} min`;
}

function maskToken(token) {
  if (!token) return '—';
  if (token.length <= 10) return '••••••' + token.slice(-4);
  return '••••••••••' + token.slice(-4);
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function TripDetailsScreen({ route, navigation }) {
  const { tripId } = route.params;
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // 'not_found' | 'network' | null

  const fetchTripDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTrip(tripId);
      setTrip(data);
    } catch (e) {
      if (e.response?.status === 404) {
        setError('not_found');
      } else {
        setError('network');
      }
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchTripDetails();
  }, [fetchTripDetails]);

  const copyTripId = async () => {
    if (trip && trip.id) {
      await Clipboard.setStringAsync(trip.id);
    }
  };

  // ── Render States ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trip Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error === 'not_found') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trip Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>Trip not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error === 'network') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trip Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>Couldn't load trip details.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchTripDetails}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!trip) return null;

  // Status mapping
  const isSos = trip.status === 'sos';
  const isActive = trip.status === 'active' || trip.status === 'sos';
  
  let statusLabel = trip.status.charAt(0).toUpperCase() + trip.status.slice(1);
  if (isSos) statusLabel = 'SOS Triggered';
  else if (isActive && trip.status !== 'active') statusLabel = 'Active';

  let badgeStyle = styles.badgeCompleted;
  let badgeTextStyle = styles.badgeTextCompleted;
  if (isSos) {
    badgeStyle = styles.badgeSos;
    badgeTextStyle = styles.badgeTextSos;
  } else if (trip.status === 'active') {
    badgeStyle = styles.badgeActive;
    badgeTextStyle = styles.badgeTextActive;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <View style={[styles.badge, badgeStyle]}>
              <Text style={[styles.badgeText, badgeTextStyle]}>{statusLabel}</Text>
            </View>
          </View>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Started</Text>
            <View style={styles.valueCol}>
              <Text style={styles.value}>{formatTripDate(trip.startedAt)}</Text>
              <Text style={styles.subValue}>{formatTripTime(trip.startedAt)}</Text>
            </View>
          </View>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Ended</Text>
            <Text style={styles.value}>{trip.endedAt ? formatTripTime(trip.endedAt) : 'Not yet ended'}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Duration</Text>
            <Text style={styles.value}>{trip.endedAt ? formatDuration(trip.durationSeconds) : 'Trip still active'}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Origin</Text>
            <View style={styles.valueCol}>
              <Text style={styles.value}>{trip.originLat?.toFixed(6)}</Text>
              <Text style={styles.value}>{trip.originLng?.toFixed(6)}</Text>
            </View>
          </View>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Destination</Text>
            <Text style={styles.value}>{trip.destinationName || 'Not provided'}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Tracking Token</Text>
            <Text style={styles.valueMono}>{maskToken(trip.trackingToken)}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Trip ID</Text>
            <View style={styles.copyRow}>
              <Text style={styles.valueMono}>{trip.id ? trip.id.substring(0, 8) + '...' : '—'}</Text>
              <TouchableOpacity onPress={copyTripId} style={styles.copyBtn}>
                <Text style={styles.copyBtnText}>Copy</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
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
    ...typography.callout,
    color: '#4F46E5',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...typography.headline,
    color: '#111827',
  },
  headerSpacer: {
    width: 60,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    ...typography.subhead,
    color: '#6b7280',
  },
  errorTitle: {
    ...typography.subhead,
    color: '#111827',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    ...typography.subhead,
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  label: {
    ...typography.footnote,
    color: '#6b7280',
    flex: 1,
  },
  value: {
    ...typography.subhead,
    color: '#111827',
    textAlign: 'right',
  },
  subValue: {
    ...typography.caption1,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 2,
  },
  valueCol: {
    alignItems: 'flex-end',
  },
  valueMono: {
    ...typography.subhead,
    fontFamily: 'Courier',
    color: '#374151',
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyBtn: {
    marginLeft: 12,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyBtnText: {
    ...typography.caption1,
    fontWeight: '600',
    color: '#16a34a',
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  badgeCompleted: {
    backgroundColor: '#f3f4f6',
  },
  badgeActive: {
    backgroundColor: '#dcfce7',
  },
  badgeSos: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    ...typography.caption1,
    textTransform: 'uppercase',
  },
  badgeTextCompleted: {
    color: '#4b5563',
  },
  badgeTextActive: {
    color: '#15803d',
  },
  badgeTextSos: {
    color: '#b91c1c',
  },
});
