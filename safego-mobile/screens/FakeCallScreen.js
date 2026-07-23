import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { getSettings, saveSettings } from '../services/SettingsService';

const PRESETS = ['Unknown', 'Mom', 'Dad', 'Brother', 'Sister', 'Friend', 'Office', 'Custom'];
const DELAYS = [
  { label: 'Now', value: 0 },
  { label: '10 seconds', value: 10 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '2 minutes', value: 120 },
  { label: '5 minutes', value: 300 },
];
const AUTO_END = [
  { label: 'Manual (Do not auto-end)', value: 0 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '2 minutes', value: 120 },
];

export default function FakeCallScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // States
  const [preset, setPreset] = useState('Unknown');
  const [customName, setCustomName] = useState('');
  const [delay, setDelay] = useState(10);
  const [ringtoneEnabled, setRingtoneEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [autoEnd, setAutoEnd] = useState(0);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const s = await getSettings();
    if (PRESETS.includes(s.fakeCallerName)) {
      setPreset(s.fakeCallerName);
    } else {
      setPreset('Custom');
      setCustomName(s.fakeCallerName);
    }
    setDelay(s.fakeCallDelay);
    setRingtoneEnabled(s.fakeCallRingtone);
    setVibrationEnabled(s.fakeCallVibration);
    setAutoEnd(s.fakeCallAutoEnd);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    let finalName = preset;
    if (preset === 'Custom') {
      finalName = customName.trim() || 'Unknown';
    }

    await saveSettings({
      fakeCallerName: finalName,
      fakeCallDelay: delay,
      fakeCallRingtone: ringtoneEnabled,
      fakeCallVibration: vibrationEnabled,
      fakeCallAutoEnd: autoEnd,
    });
    setSaving(false);
    navigation.goBack();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fake Call Settings</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#16a34a" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Caller Name</Text>
          <View style={styles.presets}>
            {PRESETS.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.presetChip, preset === p && styles.presetChipActive]}
                onPress={() => setPreset(p)}
              >
                <Text style={[styles.presetText, preset === p && styles.presetTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {preset === 'Custom' && (
            <TextInput
              style={styles.input}
              placeholder="Enter custom caller name..."
              value={customName}
              onChangeText={setCustomName}
              placeholderTextColor="#9ca3af"
            />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trigger Delay</Text>
          <Text style={styles.cardSubtitle}>How long to wait before the fake call rings.</Text>
          {DELAYS.map(d => (
            <TouchableOpacity key={d.value} style={styles.radioRow} onPress={() => setDelay(d.value)}>
              <View style={[styles.radioOuter, delay === d.value && styles.radioOuterActive]}>
                {delay === d.value && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Alert Preferences</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Play Ringtone</Text>
            <Switch
              value={ringtoneEnabled}
              onValueChange={setRingtoneEnabled}
              trackColor={{ false: '#d1d5db', true: '#16a34a' }}
            />
          </View>
          <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.switchLabel}>Vibrate</Text>
            <Switch
              value={vibrationEnabled}
              onValueChange={setVibrationEnabled}
              trackColor={{ false: '#d1d5db', true: '#16a34a' }}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Auto End Call</Text>
          <Text style={styles.cardSubtitle}>Automatically hang up after answering.</Text>
          {AUTO_END.map(a => (
            <TouchableOpacity key={a.value} style={styles.radioRow} onPress={() => setAutoEnd(a.value)}>
              <View style={[styles.radioOuter, autoEnd === a.value && styles.radioOuterActive]}>
                {autoEnd === a.value && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backBtnText: {
    fontSize: 16,
    color: '#4b5563',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  saveBtn: {
    paddingVertical: 8,
    paddingLeft: 16,
  },
  saveBtnText: {
    fontSize: 16,
    color: '#16a34a',
    fontWeight: '700',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 16,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetChipActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
  },
  presetText: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
  },
  presetTextActive: {
    color: '#16a34a',
    fontWeight: '600',
  },
  input: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterActive: {
    borderColor: '#16a34a',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16a34a',
  },
  radioLabel: {
    fontSize: 15,
    color: '#374151',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  switchLabel: {
    fontSize: 15,
    color: '#374151',
  },
});
