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
import { removeToken } from '../services/storage';

// ─── Coming Soon alert ───────────────────────────────────────────────────────
const comingSoon = (feature) =>
  Alert.alert('Coming Soon', `${feature} will be available in a future update.`);

// ─── Status Card ─────────────────────────────────────────────────────────────
function StatusCard() {
  return (
    <View style={styles.statusCard}>
      <View style={styles.statusRow}>
        <View style={styles.statusDot} />
        <Text style={styles.statusLabel}>System Status</Text>
      </View>
      <Text style={styles.statusValue}>All systems operational</Text>
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

// ─── Home Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const handleLogout = async () => {
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

        {/* Status card */}
        <StatusCard />

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <ActionButton
          label="Start Trip"
          variant="primary"
          disabled
          onPress={() => comingSoon('Start Trip')}
        />

        <ActionButton
          label="Emergency Contacts"
          onPress={() => comingSoon('Emergency Contacts')}
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
    backgroundColor: '#16a34a',
    marginRight: 8,
  },
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
});
