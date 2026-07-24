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
import { getSettings } from '../services/SettingsService';
import FakeCallService from '../services/FakeCallService';
import { useSafetyIdentity } from '../components/SafetyIdentityContext';
import { Feather } from '@expo/vector-icons';

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
  const { profile, missingFields, status: profileStatus } = useSafetyIdentity();
  
  // Socket connection status — 'connecting' | 'connected' | 'disconnected' | 'error'
  const [socketStatus, setSocketStatus] = useState(
    getSocket().connected ? 'connected' : 'connecting'
  );
  const [fakeCallState, setFakeCallState] = useState({ status: 'Idle', remainingDelay: 0 });

  useEffect(() => {
    const unsub = FakeCallService.subscribe((s) => setFakeCallState(s));
    return unsub;
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
  if (profileStatus === 'Loading') {
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
              {profile?.personal?.fullName
                ? profile.personal.fullName.charAt(0).toUpperCase()
                : '?'}
            </Text>
          </View>
        </View>

        {/* Welcome */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeGreeting}>Welcome back</Text>
          {profile?.personal?.fullName ? (
            <Text style={styles.welcomeName}>{profile.personal.fullName}</Text>
          ) : null}
        </View>

        {/* Safety Identity Card */}
        <TouchableOpacity 
          style={[styles.identityCard, missingFields.totalMissing > 0 ? styles.identityCardWarning : styles.identityCardSuccess]}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={styles.identityHeader}>
            <Feather name="shield" size={20} color={missingFields.totalMissing > 0 ? "#b45309" : "#166534"} />
            <Text style={[styles.identityTitle, { color: missingFields.totalMissing > 0 ? "#b45309" : "#166534" }]}>
              {missingFields.totalMissing > 0 ? "Incomplete Emergency Information" : "Emergency Information Ready"}
            </Text>
          </View>
          
          <View style={styles.identityDetails}>
            <View style={styles.identityRow}>
              <Text style={styles.identityLabel}>Blood Group</Text>
              <Text style={styles.identityValue}>{profile.personal.bloodGroup || '—'}</Text>
            </View>
            <View style={styles.identityRow}>
              <Text style={styles.identityLabel}>Medical Notes</Text>
              <Text style={styles.identityValue}>{missingFields.medicalInfo ? '—' : 'Available'}</Text>
            </View>
            <View style={styles.identityRow}>
              <Text style={styles.identityLabel}>Last Updated</Text>
              <Text style={styles.identityValue}>{new Date(profile.updatedAt).toLocaleDateString()}</Text>
            </View>
          </View>

          {missingFields.totalMissing > 0 && (
            <View style={styles.identityMissing}>
              <Text style={styles.identityMissingLabel}>Missing:</Text>
              <Text style={styles.identityMissingText}>
                {[
                  missingFields.name && "Name",
                  missingFields.bloodGroup && "Blood Group",
                  missingFields.medicalInfo && "Medical Info"
                ].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Status card — live system status */}
        <SystemStatusCard socketStatus={socketStatus} />

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        {/* Fake Call Action (dynamic based on state) */}
        {fakeCallState.status === 'Scheduled' ? (
          <View style={styles.scheduledCallCard}>
            <View>
              <Text style={styles.scheduledCallTitle}>Fake Call Scheduled</Text>
              <Text style={styles.scheduledCallSubtitle}>{fakeCallState.remainingDelay}s remaining</Text>
            </View>
            <TouchableOpacity style={styles.cancelCallBtn} onPress={() => FakeCallService.cancel()}>
              <Text style={styles.cancelCallBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ActionButton
            label="Trigger Fake Call"
            onPress={async () => {
              const settings = await getSettings();
              FakeCallService.start({
                callerName: settings.fakeCallerName,
                delay: settings.fakeCallDelay,
                ringtoneEnabled: settings.fakeCallRingtone,
                vibrationEnabled: settings.fakeCallVibration,
                autoEndDuration: settings.fakeCallAutoEnd,
              });
            }}
          />
        )}

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
  scheduledCallCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  scheduledCallTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  scheduledCallSubtitle: {
    fontSize: 13,
    color: '#16a34a',
    marginTop: 2,
    fontWeight: '600',
  },
  cancelCallBtn: {
    backgroundColor: '#fee2e2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelCallBtnText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 13,
  },

  // Identity Card
  identityCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  identityCardWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  identityCardSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  identityTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  identityDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  identityRow: {
    flex: 1,
  },
  identityLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  identityValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  identityMissing: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  identityMissingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b45309',
    marginRight: 4,
  },
  identityMissingText: {
    fontSize: 12,
    color: '#d97706',
  },
});
