import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { getMe } from '../lib/api';
import { removeToken } from '../services/storage';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';

// ─── Coming Soon alert ───────────────────────────────────────────────────────
const comingSoon = (feature) =>
  Alert.alert('Coming Soon', `${feature} will be available in a future update.`);

// ─── Status Card ─────────────────────────────────────────────────────────────
// Receives live socketStatus prop so it re-renders on every status change.
function StatusCard({ socketStatus }) {
  const isConnected    = socketStatus === 'connected';
  const isConnecting   = socketStatus === 'connecting';
  const isDisconnected = socketStatus === 'disconnected' || socketStatus === 'error';

  let dotStyle  = styles.statusDotGrey;
  let label     = '— Connecting…';
  if (isConnected)    { dotStyle = styles.statusDotGreen;  label = '🟢 Connected'; }
  if (isConnecting)   { dotStyle = styles.statusDotAmber;  label = '🟡 Connecting…'; }
  if (isDisconnected) { dotStyle = styles.statusDotRed;    label = '🔴 Disconnected'; }

  return (
    <View style={styles.statusCard}>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, dotStyle]} />
        <Text style={styles.statusLabel}>Socket</Text>
      </View>
      <Text style={styles.statusValue}>{label}</Text>
      <Text style={styles.statusSub}>GPS · Emergency contacts · Alerts</Text>
    </View>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────
function ActionButton({ label, onPress, variant = 'default', disabled = false }) {
  const isPrimary = variant === 'primary';
  const isDestructive = variant === 'destructive';

  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        isPrimary && styles.actionButtonPrimary,
        isDestructive && styles.actionButtonDestructive,
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <Text
        style={[
          styles.actionButtonText,
          isPrimary && styles.actionButtonTextPrimary,
          isDestructive && styles.actionButtonTextDestructive,
          disabled && styles.actionButtonTextDisabled,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Location Permission Card ────────────────────────────────────────────────
// Displays current permission status and a button to request it.
// Never accesses the user's actual position.
function LocationPermissionCard({ status, onRequest, requesting }) {
  const isGranted = status === 'granted';
  const isDenied = status === 'denied';
  const isUndetermined = status === 'undetermined';

  return (
    <View style={styles.permCard}>
      <View style={styles.permHeader}>
        <View
          style={[
            styles.permDot,
            isGranted && styles.permDotGranted,
            isDenied && styles.permDotDenied,
            isUndetermined && styles.permDotUndetermined,
          ]}
        />
        <Text style={styles.permTitle}>Location Permission</Text>
      </View>

      {/* Status badge */}
      <View
        style={[
          styles.permBadge,
          isGranted && styles.permBadgeGranted,
          isDenied && styles.permBadgeDenied,
          isUndetermined && styles.permBadgeUndetermined,
        ]}
      >
        <Text
          style={[
            styles.permBadgeText,
            isGranted && styles.permBadgeTextGranted,
            isDenied && styles.permBadgeTextDenied,
            isUndetermined && styles.permBadgeTextUndetermined,
          ]}
        >
          {isGranted && '✓ Granted'}
          {isDenied && '✗ Denied'}
          {isUndetermined && '— Not yet requested'}
          {!status && '— Checking…'}
        </Text>
      </View>

      {/* Contextual message */}
      {isDenied && (
        <Text style={styles.permDeniedMsg}>
          Location access was denied. To enable it, go to{' '}
          <Text style={styles.permDeniedMsgBold}>Settings → SafeGo → Location</Text>
          {' '}and set it to "While Using the App".
        </Text>
      )}
      {isGranted && (
        <Text style={styles.permGrantedMsg}>
          Location access is ready. Trip tracking will use it when you start a trip.
        </Text>
      )}

      {/* Only show the button when not yet granted or when undetermined */}
      {!isGranted && (
        <TouchableOpacity
          style={[
            styles.permButton,
            isDenied && styles.permButtonDisabled,
          ]}
          onPress={onRequest}
          disabled={isDenied || requesting}
          activeOpacity={0.75}
        >
          {requesting
            ? <ActivityIndicator size="small" color="#fff" />
            : (
              <Text style={styles.permButtonText}>
                {isDenied ? 'Open Settings to Enable' : 'Grant Location Permission'}
              </Text>
            )
          }
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Location permission state — 'undetermined' | 'granted' | 'denied'
  const [locationStatus, setLocationStatus] = useState(null);
  const [requestingLocation, setRequestingLocation] = useState(false);

  // Socket connection status — 'connecting' | 'connected' | 'disconnected' | 'error'
  const [socketStatus, setSocketStatus] = useState(
    getSocket().connected ? 'connected' : 'connecting'
  );

  useEffect(() => {
    getMe()
      .then((data) => setUser(data))
      .catch((e) => {
        // 401 is handled globally by the Axios interceptor → auto-logout.
        // Any other error: surface a message so the user knows.
        if (!e.response) {
          setError('Could not reach the server. Check your connection.');
        } else if (e.response.status !== 401) {
          setError('Failed to load your profile. Please try again.');
        }
        // 401: interceptor navigates to Login — stay silent here.
      })
      .finally(() => setLoading(false));
  }, []);

  // Connect socket here to cover the auto-login path (App.js calls getMe() then
  // navigates directly to Home without going through LoginScreen).
  // connectSocket() is a no-op if the socket is already connected.
  useEffect(() => {
    connectSocket();
  }, []);

  // Subscribe to socket lifecycle events and keep socketStatus in sync.
  // Listeners are registered with named functions so they can be cleanly removed.
  useEffect(() => {
    const socket = getSocket();

    const onConnect      = () => setSocketStatus('connected');
    const onDisconnect   = () => setSocketStatus('disconnected');
    const onConnectError = () => setSocketStatus('error');
    const onReconnecting = () => setSocketStatus('connecting');

    socket.on('connect',       onConnect);
    socket.on('disconnect',    onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.io.on('reconnect_attempt', onReconnecting);
    socket.io.on('reconnect',         onConnect);

    // Sync immediately in case the socket state changed before listeners were attached.
    setSocketStatus(socket.connected ? 'connected' : 'connecting');

    return () => {
      socket.off('connect',       onConnect);
      socket.off('disconnect',    onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.io.off('reconnect_attempt', onReconnecting);
      socket.io.off('reconnect',         onConnect);
    };
  }, []);

  // Check existing location permission status on mount (no prompt shown).
  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => setLocationStatus(status))
      .catch(() => setLocationStatus('undetermined'));
  }, []);

  const handleRequestLocation = async () => {
    setRequestingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(status);
    } catch {
      // Unexpected error — treat as undetermined so the button stays visible.
      setLocationStatus('undetermined');
    } finally {
      setRequestingLocation(false);
    }
  };

  const handleLogout = async () => {
    disconnectSocket(); // sever socket before clearing credentials
    await removeToken();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading your profile…</Text>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>SafeGo</Text>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {user?.full_name
                ? user.full_name.charAt(0).toUpperCase()
                : user?.email
                ? user.email.charAt(0).toUpperCase()
                : '?'}
            </Text>
          </View>
        </View>

        {/* Welcome */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeGreeting}>Welcome back</Text>
          {user?.full_name ? (
            <Text style={styles.welcomeName}>{user.full_name}</Text>
          ) : null}
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <Text style={styles.welcomeEmail}>{user?.email ?? '—'}</Text>
          )}
        </View>

        {/* Status card — live socket status */}
        <StatusCard socketStatus={socketStatus} />

        {/* Location permission */}
        <LocationPermissionCard
          status={locationStatus}
          onRequest={handleRequestLocation}
          requesting={requestingLocation}
        />

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        {/* SOS — first and most prominent */}
        <ActionButton
          label="SOS"
          variant="destructive"
          onPress={() => navigation.navigate('SOS')}
        />

        <ActionButton
          label="Start Trip"
          variant="primary"
          disabled
          onPress={() => comingSoon('Start Trip')}
        />

        <ActionButton
          label="Emergency Contacts"
          onPress={() => navigation.navigate('EmergencyContacts')}
        />

        <ActionButton
          label="Current Location"
          onPress={() => navigation.navigate('CurrentLocation')}
        />

        <ActionButton
          label="Live Tracking"
          onPress={() => navigation.navigate('LiveTracking')}
        />

        <ActionButton
          label="Map"
          onPress={() => navigation.navigate('Map')}
        />

        <ActionButton
          label="Settings"
          onPress={() => comingSoon('Settings')}
        />

        {/* Divider */}
        <View style={styles.divider} />

        {/* Logout */}
        <ActionButton
          label="Logout"
          variant="destructive"
          onPress={handleLogout}
        />
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // Loading
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#16a34a',
    letterSpacing: -0.5,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 17,
    fontWeight: '700',
    color: '#16a34a',
  },

  // Welcome
  welcomeSection: {
    marginBottom: 24,
  },
  welcomeGreeting: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  welcomeName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  welcomeEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    marginTop: 4,
  },

  // Status card
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusDotGreen: { backgroundColor: '#16a34a' },
  statusDotAmber: { backgroundColor: '#f59e0b' },
  statusDotRed:   { backgroundColor: '#dc2626' },
  statusDotGrey:  { backgroundColor: '#d1d5db' },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  statusSub: {
    fontSize: 13,
    color: '#9ca3af',
  },

  // Section title
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Action buttons
  actionButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 18,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  actionButtonPrimary: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  actionButtonDestructive: {
    backgroundColor: '#fff',
    borderColor: '#fca5a5',
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  actionButtonTextPrimary: {
    color: '#fff',
  },
  actionButtonTextDestructive: {
    color: '#dc2626',
  },
  actionButtonTextDisabled: {
    color: '#9ca3af',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },

  // Location permission card
  permCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  permHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  permDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d1d5db',
    marginRight: 8,
  },
  permDotGranted: { backgroundColor: '#16a34a' },
  permDotDenied:  { backgroundColor: '#dc2626' },
  permDotUndetermined: { backgroundColor: '#f59e0b' },
  permTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  permBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 10,
    backgroundColor: '#f3f4f6',
  },
  permBadgeGranted:       { backgroundColor: '#dcfce7' },
  permBadgeDenied:        { backgroundColor: '#fee2e2' },
  permBadgeUndetermined:  { backgroundColor: '#fef3c7' },
  permBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  permBadgeTextGranted:       { color: '#15803d' },
  permBadgeTextDenied:        { color: '#b91c1c' },
  permBadgeTextUndetermined:  { color: '#92400e' },
  permDeniedMsg: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 19,
    marginBottom: 12,
  },
  permDeniedMsgBold: {
    fontWeight: '600',
    color: '#374151',
  },
  permGrantedMsg: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 19,
  },
  permButton: {
    marginTop: 12,
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  permButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  permButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
