import React, { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Switch,
  Linking,
  AppState,
} from 'react-native';
import * as Location from 'expo-location';

import { getSettings, saveSettings } from '../services/SettingsService';
import { getMe } from '../lib/api';
import { removeToken } from '../services/storage';
import { disconnectSocket } from '../lib/socket';
import { clearTrip } from '../lib/tripState';

// A simple reusable selector component since we don't have a native picker installed
function SegmentedControl({ options, selectedValue, onValueChange, disabled = false }) {
  return (
    <View style={[styles.segmentContainer, disabled && { opacity: 0.6 }]}>
      {options.map((opt) => {
        const isSelected = selectedValue === opt.value;
        return (
          <TouchableOpacity
            key={opt.value.toString()}
            style={[styles.segmentBtn, isSelected && styles.segmentBtnActive]}
            onPress={() => !disabled && onValueChange(opt.value)}
            activeOpacity={disabled ? 1 : 0.7}
          >
            <Text style={[styles.segmentText, isSelected && styles.segmentTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function SettingsScreen({ navigation }) {
  const [settings, setSettings] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  
  const [locStatus, setLocStatus] = useState('Unknown');
  const [micStatus, setMicStatus] = useState('Not Installed'); // Placeholder until expo-av is added

  // Load state on mount
  useEffect(() => {
    const init = async () => {
      const s = await getSettings();
      setSettings(s);
      const me = await getMe();
      if (me) setUserEmail(me.email);
    };
    init();
    checkPermissions();
  }, []);

  // Listen to AppState to refresh permissions when coming back from Settings
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        checkPermissions();
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const checkPermissions = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocStatus(status === 'granted' ? 'Granted' : 'Denied');
    } catch (e) {
      setLocStatus('Error');
    }
  };

  const updateSetting = async (key, value) => {
    // Optimistic update
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    // Persist
    await saveSettings({ [key]: value });
  };

  const handleLogout = async () => {
    try {
      // 1. Disconnect Socket
      disconnectSocket();
      
      // 2. Clear Auth
      await removeToken();
      // user is technically removed by removing token in this architecture
      
      // 3. Clear Active Trip
      await clearTrip();

      // 4. Reset Navigation to Login
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  if (!settings) return null; // loading

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        
        {/* ── Permissions ────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Permissions</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View>
              <Text style={styles.label}>Location</Text>
              <Text style={styles.statusText}>{locStatus}</Text>
            </View>
            <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openSettings()}>
              <Text style={styles.actionBtnText}>Manage</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View>
              <Text style={styles.label}>Microphone</Text>
              <Text style={styles.statusText}>{micStatus}</Text>
            </View>
            <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openSettings()}>
              <Text style={styles.actionBtnText}>Manage</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Emergency ──────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Emergency</Text>
        <View style={styles.card}>
          <View style={styles.stackRow}>
            <Text style={styles.label}>SOS Countdown</Text>
            <SegmentedControl
              options={[
                { label: 'Instant', value: 0 },
                { label: '5s', value: 5 },
                { label: '10s', value: 10 },
              ]}
              selectedValue={settings.sosCountdown}
              onValueChange={(val) => updateSetting('sosCountdown', val)}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.stackRow}>
            <Text style={styles.label}>SOS Cooldown</Text>
            <SegmentedControl
              options={[
                { label: '30s', value: 30 },
                { label: '60s', value: 60 },
                { label: '120s', value: 120 },
              ]}
              selectedValue={settings.sosCooldown}
              onValueChange={(val) => updateSetting('sosCooldown', val)}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Record Audio</Text>
            <Switch
              value={settings.recordAudio}
              onValueChange={(val) => updateSetting('recordAudio', val)}
              trackColor={{ false: '#d1d5db', true: '#16a34a' }}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.stackRow}>
            <Text style={styles.label}>Recording Duration</Text>
            <SegmentedControl
              options={[
                { label: '5s', value: 5 },
                { label: '15s', value: 15 },
                { label: '30s', value: 30 },
              ]}
              selectedValue={settings.audioRecordingDuration ?? 15}
              onValueChange={(val) => updateSetting('audioRecordingDuration', val)}
              disabled={!settings.recordAudio}
            />
          </View>
        </View>

        {/* ── Trip ───────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Trip</Text>
        <View style={styles.card}>
          <View style={styles.stackRow}>
            <Text style={styles.label}>Periodic Check-ins</Text>
            <SegmentedControl
              options={[
                { label: 'OFF', value: 0 },
                { label: '15m', value: 15 },
                { label: '30m', value: 30 },
                { label: '60m', value: 60 },
              ]}
              selectedValue={settings.periodicCheckIn}
              onValueChange={(val) => updateSetting('periodicCheckIn', val)}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>High Accuracy Tracking</Text>
            <Switch
              value={settings.highAccuracyTracking}
              onValueChange={(val) => updateSetting('highAccuracyTracking', val)}
              trackColor={{ false: '#d1d5db', true: '#16a34a' }}
            />
          </View>
        </View>

        {/* ── Account ────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Logged in as</Text>
            <Text style={styles.subText}>{userEmail}</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* ── About ──────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Version</Text>
            <Text style={styles.subText}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Privacy Policy</Text>
            <Text style={styles.subText}>View</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Terms of Service</Text>
            <Text style={styles.subText}>View</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { paddingVertical: 4, paddingRight: 12 },
  backBtnText: { fontSize: 15, color: '#16a34a', fontWeight: '600' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#111827' },
  headerSpacer: { width: 60 },
  scroll: { padding: 16, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  stackRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 16 },
  label: { fontSize: 15, color: '#111827', fontWeight: '500' },
  statusText: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  subText: { fontSize: 14, color: '#6b7280' },
  logoutText: { fontSize: 15, color: '#dc2626', fontWeight: '600' },
  actionBtn: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#111827' },
  
  // Segmented Control
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 3,
    marginTop: 10,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  segmentTextActive: {
    color: '#111827',
    fontWeight: '600',
  },
});
