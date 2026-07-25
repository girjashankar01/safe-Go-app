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
import PinService from '../services/PinService';
import AudioPlaybackService from '../services/AudioPlaybackService';
import { Modal, TextInput, ActivityIndicator } from 'react-native';
import { useTheme, typography } from '../theme';

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
  const { colors } = useTheme();
  const [settings, setSettings] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  
  const [locStatus, setLocStatus] = useState('Unknown');
  const [micStatus, setMicStatus] = useState('Not Installed'); // Placeholder until expo-av is added

  // PIN Management State
  const [pinMode, setPinMode] = useState('none'); // 'none' | 'set' | 'change_old' | 'change_new' | 'remove'
  const [pinInput, setPinInput] = useState('');
  const [tempPin, setTempPin] = useState(''); // Stores old pin during change flow
  const [pinError, setPinError] = useState('');
  const [isPinLoading, setIsPinLoading] = useState(false);

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
      
      // 4. Cleanup Audio
      AudioPlaybackService.stopAll();

      // 5. Reset Navigation to Login
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  // ── PIN Management Handlers ────────────────────────────────────────────────
  const closePinModal = () => {
    setPinMode('none');
    setPinInput('');
    setTempPin('');
    setPinError('');
  };

  const handlePinSubmit = async () => {
    if (pinInput.length < 4) {
      setPinError('PIN must be at least 4 digits');
      return;
    }
    
    setIsPinLoading(true);
    setPinError('');

    try {
      if (pinMode === 'set') {
        await PinService.setPin(pinInput);
        setSettings({ ...settings, emergencyPinHash: await PinService.hashPin(pinInput) });
        closePinModal();
      } else if (pinMode === 'change_old') {
        const isValid = await PinService.verifyPin(pinInput);
        if (isValid) {
          setTempPin(pinInput);
          setPinInput('');
          setPinMode('change_new');
        } else {
          setPinError('Incorrect old PIN');
        }
      } else if (pinMode === 'change_new') {
        await PinService.changePin(tempPin, pinInput);
        setSettings({ ...settings, emergencyPinHash: await PinService.hashPin(pinInput) });
        closePinModal();
      } else if (pinMode === 'remove') {
        const isValid = await PinService.verifyPin(pinInput);
        if (isValid) {
          await PinService.removePin();
          setSettings({ ...settings, emergencyPinHash: null, requirePinForSOSCancel: false });
          // Also persist the toggle turning off
          await saveSettings({ requirePinForSOSCancel: false });
          closePinModal();
        } else {
          setPinError('Incorrect PIN');
        }
      }
    } catch (e) {
      setPinError('An error occurred. Try again.');
    } finally {
      setIsPinLoading(false);
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
              trackColor={{ false: '#d1d5db', true: colors.primary }}
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

        {/* ── Trip Safety ────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Trip Safety</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Enable Periodic Check-ins</Text>
            <Switch
              value={settings.periodicCheckInsEnabled}
              onValueChange={(val) => updateSetting('periodicCheckInsEnabled', val)}
              trackColor={{ false: '#d1d5db', true: colors.primary }}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.stackRow}>
            <Text style={styles.label}>Check-in Interval (minutes)</Text>
            <SegmentedControl
              options={[
                { label: '15', value: 15 },
                { label: '30', value: 30 },
                { label: '60', value: 60 },
                { label: '90', value: 90 },
                { label: '120', value: 120 },
              ]}
              selectedValue={settings.checkInIntervalMinutes ?? 15}
              onValueChange={(val) => updateSetting('checkInIntervalMinutes', val)}
              disabled={!settings.periodicCheckInsEnabled}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.stackRow}>
            <Text style={styles.label}>Response Timeout (seconds)</Text>
            <SegmentedControl
              options={[
                { label: '15', value: 15 },
                { label: '30', value: 30 },
                { label: '45', value: 45 },
                { label: '60', value: 60 },
              ]}
              selectedValue={settings.checkInResponseTimeoutSeconds ?? 30}
              onValueChange={(val) => updateSetting('checkInResponseTimeoutSeconds', val)}
              disabled={!settings.periodicCheckInsEnabled}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.stackRow}>
            <Text style={styles.label}>Missed Check-in Action</Text>
            <SegmentedControl
              options={[
                { label: 'SOS', value: 'sos' },
                { label: 'Warning', value: 'warning' },
                { label: 'Guardians', value: 'guardians' },
              ]}
              selectedValue={settings.missedCheckInAction ?? 'sos'}
              onValueChange={(val) => updateSetting('missedCheckInAction', val)}
              disabled={!settings.periodicCheckInsEnabled}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>High Accuracy Tracking</Text>
            <Switch
              value={settings.highAccuracyTracking}
              onValueChange={(val) => updateSetting('highAccuracyTracking', val)}
              trackColor={{ false: '#d1d5db', true: colors.primary }}
            />
          </View>
        </View>

        {/* ── Emergency Security ─────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Emergency Security</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Require PIN To Cancel SOS</Text>
            <Switch
              value={settings.requirePinForSOSCancel}
              onValueChange={(val) => updateSetting('requirePinForSOSCancel', val)}
              trackColor={{ false: '#d1d5db', true: colors.primary }}
            />
          </View>
          <View style={styles.divider} />
          {settings.emergencyPinHash ? (
            <>
              <TouchableOpacity style={styles.row} onPress={() => setPinMode('change_old')}>
                <Text style={styles.label}>Change PIN</Text>
                <Text style={styles.subText}>→</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.row} onPress={() => setPinMode('remove')}>
                <Text style={styles.logoutText}>Remove PIN</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.row} onPress={() => setPinMode('set')}>
              <Text style={styles.label}>Set PIN</Text>
              <Text style={styles.subText}>→</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Emergency Alarm ────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Emergency Alarm</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('EmergencyAlarmSettings')}>
            <Text style={styles.label}>Alarm Configuration</Text>
            <Text style={styles.subText}>→</Text>
          </TouchableOpacity>
        </View>

        {/* ── Fake Call ──────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Preventive Safety</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('FakeCall')}>
            <Text style={styles.label}>Fake Call Settings</Text>
            <Text style={styles.subText}>→</Text>
          </TouchableOpacity>
        </View>

        {/* ── Account ────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Logged in as</Text>
            <Text style={styles.subText}>{userEmail}</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.label}>Safety Profile</Text>
            <Text style={styles.subText}>→</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('EmergencyHistory')}>
            <Text style={styles.label}>Emergency History</Text>
            <Text style={styles.subText}>→</Text>
          </TouchableOpacity>
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

      {/* ── PIN Management Modal ─────────────────────────────────────────────── */}
      <Modal visible={pinMode !== 'none'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pinMode === 'set' ? 'Set Emergency PIN' :
               pinMode === 'change_old' ? 'Enter Current PIN' :
               pinMode === 'change_new' ? 'Set New PIN' :
               'Remove PIN'}
            </Text>
            <Text style={styles.modalBody}>
              {pinMode === 'remove' ? 'Enter your current PIN to confirm removal.' : 'PIN must be 4 to 6 digits.'}
            </Text>
            
            <TextInput
              style={styles.modalInput}
              value={pinInput}
              onChangeText={(text) => {
                setPinInput(text.replace(/[^0-9]/g, ''));
                setPinError('');
              }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              placeholder="••••"
              placeholderTextColor="#9ca3af"
              autoFocus
            />

            {pinError ? <Text style={styles.modalError}>{pinError}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalCancelBtn]} 
                onPress={closePinModal}
                disabled={isPinLoading}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: colors.primary }, (!pinInput || isPinLoading) && styles.modalSubmitBtnDisabled]} 
                onPress={handlePinSubmit}
                disabled={!pinInput || isPinLoading}
              >
                {isPinLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  backBtnText: { ...typography.callout, color: '#0F766E' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.headline, color: '#111827' },
  headerSpacer: { width: 60 },
  scroll: { padding: 16, paddingBottom: 40 },
  sectionTitle: {
    ...typography.footnote,
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
  label: { ...typography.body, color: '#111827' },
  statusText: { ...typography.footnote, color: '#6b7280', marginTop: 2 },
  subText: { ...typography.subhead, color: '#6b7280' },
  logoutText: { ...typography.callout, color: '#dc2626' },
  actionBtn: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBtnText: { ...typography.footnote, color: '#111827' },
  
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
    ...typography.subhead,
    color: '#6b7280',
  },
  segmentTextActive: {
    color: '#111827',
    fontWeight: '600',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    ...typography.title3,
    color: '#111827',
    marginBottom: 8,
  },
  modalBody: {
    ...typography.subhead,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalInput: {
    width: '100%',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 16,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 16,
    color: '#111827',
    fontWeight: '700',
  },
  modalError: {
    ...typography.footnote,
    color: '#dc2626',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelBtn: {
    backgroundColor: '#f3f4f6',
  },
  modalCancelBtnText: {
    ...typography.callout,
    color: '#4b5563',
  },
  modalSubmitBtn: {
    backgroundColor: '#16a34a',
  },
  modalSubmitBtnDisabled: {
    opacity: 0.6,
  },
  modalSubmitBtnText: {
    ...typography.callout,
    color: '#fff',
  },
});
