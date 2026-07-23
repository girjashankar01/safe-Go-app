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
import { getMe } from '../lib/api';
import { connectSocket, getSocket } from '../lib/socket';

// ─── Coming Soon alert ───────────────────────────────────────────────────────
const comingSoon = (feature) =>
  Alert.alert('Coming Soon', `${feature} will be available in a future update.`);

import SystemStatusCard from '../components/SystemStatusCard';

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


export default function HomeScreen({ navigation }) {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

        {/* Status card — live system status */}
        <SystemStatusCard socketStatus={socketStatus} />

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        {/* SOS — first and most prominent */}
        <ActionButton
          label="SOS"
          variant="destructive"
          onPress={() => navigation.navigate('SOS')}
        />

        <ActionButton
          label="Manage Trip"
          variant="primary"
          onPress={() => navigation.navigate('Trip')}
        />

        <ActionButton
          label="Trip History"
          onPress={() => navigation.navigate('History')}
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
          onPress={() => navigation.navigate('Settings')}
        />

        {/* Divider */}
        <View style={styles.divider} />
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
});
