import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Switch,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getSettings, saveSettings } from '../services/SettingsService';

export default function EmergencyAlarmSettingsScreen({ navigation }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const updateSetting = async (key, value) => {
    const updated = await saveSettings({ [key]: value });
    setSettings(updated);
  };

  const setPreset = async (preset) => {
    let updates = {};
    if (preset === 'silent') {
      updates = { emergencyAlarmEnabled: false };
    } else if (preset === 'alert') {
      updates = {
        emergencyAlarmEnabled: true,
        emergencyAlarmSound: true,
        emergencyAlarmVibration: false,
        emergencyAlarmScreenFlash: false,
      };
    } else if (preset === 'maximum') {
      updates = {
        emergencyAlarmEnabled: true,
        emergencyAlarmSound: true,
        emergencyAlarmVibration: true,
        emergencyAlarmScreenFlash: true,
      };
    }
    const updated = await saveSettings(updates);
    setSettings(updated);
  };

  if (!settings) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency Alarm</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        
        <View style={styles.presetContainer}>
          <Text style={styles.sectionTitle}>Presets</Text>
          <View style={styles.presetButtons}>
            <TouchableOpacity style={styles.presetBtn} onPress={() => setPreset('silent')}>
              <Text style={styles.presetText}>Silent</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetBtn} onPress={() => setPreset('alert')}>
              <Text style={styles.presetText}>Alert</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetBtn} onPress={() => setPreset('maximum')}>
              <Text style={styles.presetText}>Maximum</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <View>
              <Text style={styles.rowTitle}>Enable Alarm</Text>
              <Text style={styles.rowSubtitle}>Triggers after SOS completes.</Text>
            </View>
            <Switch
              value={settings.emergencyAlarmEnabled}
              onValueChange={(v) => updateSetting('emergencyAlarmEnabled', v)}
              trackColor={{ false: '#d1d5db', true: '#16a34a' }}
            />
          </View>
        </View>

        {settings.emergencyAlarmEnabled && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trigger Timing</Text>
              {['immediately', 'after_upload', 'after_sent', 'manual'].map(t => (
                <TouchableOpacity 
                  key={t}
                  style={styles.radioRow} 
                  onPress={() => updateSetting('emergencyAlarmTrigger', t)}
                >
                  <Text style={styles.radioText}>
                    {t === 'immediately' ? 'Immediately on SOS start' :
                     t === 'after_upload' ? 'After audio upload (Default)' :
                     t === 'after_sent' ? 'After SOS data sent' :
                     'Manual only'}
                  </Text>
                  {settings.emergencyAlarmTrigger === t && (
                    <Feather name="check" size={20} color="#16a34a" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Effects</Text>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>Loud Alarm Sound</Text>
                <Switch
                  value={settings.emergencyAlarmSound}
                  onValueChange={(v) => updateSetting('emergencyAlarmSound', v)}
                  trackColor={{ false: '#d1d5db', true: '#16a34a' }}
                />
              </View>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>Continuous Vibration</Text>
                <Switch
                  value={settings.emergencyAlarmVibration}
                  onValueChange={(v) => updateSetting('emergencyAlarmVibration', v)}
                  trackColor={{ false: '#d1d5db', true: '#16a34a' }}
                />
              </View>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>Screen Flashing</Text>
                <Switch
                  value={settings.emergencyAlarmScreenFlash}
                  onValueChange={(v) => updateSetting('emergencyAlarmScreenFlash', v)}
                  trackColor={{ false: '#d1d5db', true: '#16a34a' }}
                />
              </View>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Auto-Stop Duration</Text>
              {[0, 30, 60, 120].map(d => (
                <TouchableOpacity 
                  key={d}
                  style={styles.radioRow} 
                  onPress={() => updateSetting('emergencyAlarmDuration', d)}
                >
                  <Text style={styles.radioText}>
                    {d === 0 ? 'Until stopped manually' : `${d} seconds`}
                  </Text>
                  {settings.emergencyAlarmDuration === d && (
                    <Feather name="check" size={20} color="#16a34a" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

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
  content: {
    padding: 16,
  },
  presetContainer: {
    marginBottom: 24,
  },
  presetButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  presetBtn: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  presetText: {
    fontWeight: '600',
    color: '#374151',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  radioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  radioText: {
    fontSize: 16,
    color: '#374151',
  },
});
