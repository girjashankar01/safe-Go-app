import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import LocationService from '../services/LocationService';
import { startTrip, endTrip, getActiveTrip, getMe } from '../lib/api';
import { connectSocket, getSocket } from '../lib/socket';
import { useTheme } from '../theme';
import {
  setTrip,
  clearTrip,
  getTrip,
  hasActiveTrip,
  restoreTrip,
} from '../lib/tripState';
import CheckInService from '../services/CheckInService';
import { useSafetyIdentity } from '../components/SafetyIdentityContext';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TripScreen({ navigation }) {
  const { colors } = useTheme();
  const { missingFields } = useSafetyIdentity();
  
  // Local mirror of tripState — drives all UI.
  const [trip,    setTripLocal] = useState(null);   // null = no active trip
  const [loading, setLoading]   = useState(true);   // initial sync
  const [working, setWorking]   = useState(false);  // start / end in flight
  const [error,   setError]     = useState('');

  const [trackingStats, setTrackingStats] = useState(null);

  // Guard: prevent duplicate taps from firing concurrent requests.
  const workingRef = useRef(false);
  const watcherRef = useRef(null);

  // ── Mount: restore local state then sync with backend ───────────────────────
  useEffect(() => {
    const init = async () => {
      // 1. Restore whatever we last persisted locally.
      await restoreTrip();

      // 2. Ask the backend what it actually knows — source of truth.
      try {
        const result = await getActiveTrip(); // GET /trips/active

        if (result.hasActiveTrip) {
          // Backend has an open trip — always trust it.
          const currentTrip = getTrip();
          let uid = currentTrip.userId;
          if (!uid) {
            const me = await getMe();
            uid = me.id;
          }

          await setTrip({
            tripId:        result.trip.id,
            trackingToken: result.trip.trackingToken,
            startedAt:     result.trip.startedAt,
            userId:        uid,
          });
          setTripLocal(getTrip());
          CheckInService.start(result.trip.id);
        } else {
          // Backend has no open trip — clear any stale local state.
          if (hasActiveTrip()) {
            await clearTrip();
          }
          setTripLocal(null);
          CheckInService.stop();
        }
      } catch {
        // Network unavailable — fall back to local state so the user can still
        // see a previously started trip. They will re-sync on next open.
        if (hasActiveTrip()) {
          const t = getTrip();
          setTripLocal(t);
          CheckInService.start(t.tripId);
        }
      }

      setLoading(false);
    };
    init();
  }, []);

  const isStartingWatcher = useRef(false);

  // ── GPS Tracking Watcher ─────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    if (!trip || !trip.tripId) {
      if (watcherRef.current) {
        console.log('[TripTracking] watcher stopped');
        watcherRef.current.remove();
        watcherRef.current = null;
      }
      setTrackingStats(null);
      return;
    }

    if (watcherRef.current || isStartingWatcher.current) return;

    const startWatcher = async () => {
      isStartingWatcher.current = true;
      try {
        const hasPerm = await LocationService.ensurePermission();
        if (!hasPerm) {
          if (mounted) setError('Location permission revoked. Tracking stopped.');
          isStartingWatcher.current = false;
          return;
        }

        console.log('[TripTracking] watcher started');
        const sub = await LocationService.watchLocation((loc) => {
          if (!mounted) return;

          const lat = loc.latitude;
          const lng = loc.longitude;
          const accuracy = loc.accuracy;
          const speed = loc.speed;
          const timestamp = loc.timestamp ? new Date(loc.timestamp).toISOString() : new Date().toISOString();
          
          DeviceEventEmitter.emit('LocationUpdated', timestamp);

          setTrackingStats({
            lat,
            lng,
            accuracy,
            speed,
            timestamp
          });

          const socket = getSocket();
          if (socket && socket.connected) {
            const payload = {
              tripId: trip.id || trip.tripId,
              userId: trip.user_id || trip.userId,
              lat,
              lng,
              accuracy,
              speed,
              timestamp
            };
            socket.emit('location:update', payload);
            console.log('[TripTracking] emitting location');
          }
        });

        if (mounted) {
          watcherRef.current = sub;
        } else {
          console.log('[TripTracking] watcher stopped (unmounted during init)');
          sub.remove();
        }
      } catch (err) {
        if (mounted) {
          setError('Failed to start GPS tracking: ' + err.message);
        }
      } finally {
        isStartingWatcher.current = false;
      }
    };

    startWatcher();

    return () => {
      mounted = false;
      if (watcherRef.current) {
        console.log('[TripTracking] watcher stopped');
        watcherRef.current.remove();
        watcherRef.current = null;
      }
    };
  }, [trip]);

  // ── Start Trip ───────────────────────────────────────────────────────────────
  const handleStartTrip = async () => {
    if (workingRef.current) return;   // prevent double-tap
    
    if (missingFields.bloodGroup) {
      Alert.alert(
        'Incomplete Safety Identity',
        'Your blood group is missing. Completing your Safety Identity helps responders in an emergency.',
        [
          { text: 'Complete Later', style: 'cancel', onPress: () => executeStartTrip() },
          { text: 'Update Now', style: 'default', onPress: () => navigation.navigate('Profile') },
        ]
      );
    } else {
      executeStartTrip();
    }
  };

  const executeStartTrip = async () => {
    workingRef.current = true;
    setError('');
    setWorking(true);

    try {
      const hasPerm = await LocationService.ensurePermission();
      if (!hasPerm) {
        setError('Location permission is required to start a trip.\nGrant it from the Home screen.');
        return;
      }

      let originLat, originLng;
      const loc = await LocationService.getCurrentLocation();
      if (loc) {
        originLat = loc.latitude;
        originLng = loc.longitude;
      } else {
        setError('Unable to get your current location.\nPlease try again in a moment.');
        return;
      }

      // POST /trips/start
      const response = await startTrip({ originLat, originLng });
      const me = await getMe();

      await setTrip({
        tripId:        response.tripId,
        trackingToken: response.trackingToken,
        userId:        me.id,
      });
      setTripLocal(getTrip());
      CheckInService.start(response.tripId);

    } catch (e) {
      const status = e.response?.status;
      const serverMsg = e.response?.data?.error || '';

      if (status === 409 && e.response?.data?.existingTripId) {
        // Backend already has an open trip — recover it silently.
        try {
          const me = await getMe();
          await setTrip({
            tripId:        e.response.data.existingTripId,
            trackingToken: null,
            userId:        me.id
          });
          setTripLocal(getTrip());
          CheckInService.start(e.response.data.existingTripId);
          setError('A previous trip was recovered. You can end it now.');
        } catch (fetchErr) {
          setError('Failed to recover trip details.');
        }
      } else if (status === 400) {
        setError(serverMsg || 'Invalid request. Please try again.');
      } else if (status >= 500) {
        setError('Unexpected server error. Please try again later.');
      } else if (!status) {
        setError('Unable to contact server.\nCheck your network connection.');
      } else {
        setError(serverMsg || 'Failed to start trip.');
      }
    } finally {
      workingRef.current = false;
      setWorking(false);
    }
  };

  // ── End Trip ─────────────────────────────────────────────────────────────────
  const handleEndTrip = () => {
    if (workingRef.current) return;   // prevent double-tap
    const current = getTrip();
    if (!current.tripId) return;

    Alert.alert(
      'End Trip',
      'Are you sure you want to end this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Trip',
          style: 'destructive',
          onPress: () => confirmEndTrip(current.tripId),
        },
      ],
    );
  };

  const confirmEndTrip = async (tripId) => {
    if (workingRef.current) return;
    workingRef.current = true;
    setError('');
    setWorking(true);

    try {
      await endTrip(tripId);  // POST /trips/:id/end
      // Only clear local state AFTER the backend confirms success.
      await clearTrip();
      setTripLocal(null);
      CheckInService.stop();
    } catch (e) {
      // Keep trip active — do not clear state on failure.
      const status = e.response?.status;
      const serverMsg = e.response?.data?.error || '';

      if (status === 404) {
        // Trip already ended on the server — clear local state to match.
        await clearTrip();
        setTripLocal(null);
        CheckInService.stop();
        setError('This trip had already ended on the server. Local state cleared.');
      } else if (status >= 500) {
        setError('Unexpected server error. Trip kept active — try again.');
      } else if (!status) {
        setError('Unable to contact server.\nTrip kept active — check your network.');
      } else {
        setError(serverMsg || 'Failed to end trip.');
      }
    } finally {
      workingRef.current = false;
      setWorking(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trip</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>Trip</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── IDLE STATE ─────────────────────────────────────────────────────── */}
        {!trip ? (
          <>
            <View style={styles.idleCard}>
              <Feather name="map" size={48} color="#9ca3af" style={{ marginBottom: 16 }} />
              <Text style={styles.idleTitle}>No Active Trip</Text>
              <Text style={styles.idleBody}>
                Start a trip to begin recording your journey.{'\n'}
                Your emergency contacts will be notified.
              </Text>
            </View>

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryBtn, working && styles.primaryBtnDisabled]}
              onPress={handleStartTrip}
              activeOpacity={0.85}
              disabled={working}
            >
              {working ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Start Trip</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          /* ── ACTIVE TRIP STATE ─────────────────────────────────────────────── */
          <>
            {/* Status badge */}
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeBadgeText}>Trip Active</Text>
            </View>

            {/* Trip info card */}
            <View style={styles.infoCard}>
              <Row label="Trip ID" value={trip.tripId} mono />
              <View style={styles.rowDivider} />
              <Row label="Started At" value={formatDate(trip.startedAt)} />
              <View style={styles.rowDivider} />
              <Row
                label="Tracking Token"
                value={trip.trackingToken ? `${trip.trackingToken.slice(0, 20)}…` : '—'}
                mono
                small
              />
            </View>
            
            {/* Diagnostics Card */}
            {trackingStats && (
              <View style={styles.infoCard}>
                <Row label="Tracking Status" value="Active" />
                <View style={styles.rowDivider} />
                <Row label="Latitude" value={trackingStats.lat} mono />
                <View style={styles.rowDivider} />
                <Row label="Longitude" value={trackingStats.lng} mono />
                <View style={styles.rowDivider} />
                <Row label="Accuracy" value={trackingStats.accuracy ? `${trackingStats.accuracy.toFixed(1)} m` : '—'} mono />
                <View style={styles.rowDivider} />
                <Row label="Speed" value={trackingStats.speed != null ? `${trackingStats.speed.toFixed(1)} m/s` : '—'} mono />
                <View style={styles.rowDivider} />
                <Row label="Last Update" value={formatDate(trackingStats.timestamp)} />
              </View>
            )}

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* End Trip button */}
            <TouchableOpacity 
                style={[
                  styles.endBtn, 
                  { backgroundColor: colors.errorContainer, borderColor: colors.error, borderWidth: 1, shadowColor: colors.errorContainer },
                  working && styles.endBtnDisabled
                ]} 
                onPress={handleEndTrip}
                disabled={working}
                activeOpacity={0.8}
              >
                {working ? (
                  <ActivityIndicator color={colors.error} />
                ) : (
                  <Text style={[styles.endBtnText, { color: colors.error }]}>End Trip</Text>
                )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Row({ label, value, mono = false, small = false }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, mono && styles.rowValueMono, small && styles.rowValueSmall]}
        numberOfLines={2}
        selectable
      >
        {value || '—'}
      </Text>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day:    '2-digit',
      month:  'short',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
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
    color: '#4F46E5', // Indigo
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
    paddingTop: 28,
    paddingBottom: 48,
  },

  // Loading / centered
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Idle card
  idleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  idleIcon: {
    fontSize: 44,
    marginBottom: 14,
  },
  idleTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  idleBody: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 21,
  },

  // Active badge
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
    marginRight: 8,
  },
  activeBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803d',
    letterSpacing: 0.3,
  },

  // Info card
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowLabel: {
    width: 110,
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingTop: 2,
  },
  rowValue: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  rowValueMono: {
    fontFamily: 'Courier',
    fontSize: 13,
    color: '#374151',
  },
  rowValueSmall: {
    fontSize: 12,
    color: '#6b7280',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
  },

  // Error banner
  errorBanner: {
    backgroundColor: '#fff1f2',
    borderRadius: 10,
    padding: 13,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  errorText: {
    fontSize: 14,
    color: '#be123c',
    fontWeight: '600',
    textAlign: 'center',
  },

  // Start Trip button
  primaryBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: '#16a34a',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // End Trip button
  endBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: '#dc2626',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  endBtnDisabled: {
    opacity: 0.6,
  },
  endBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

