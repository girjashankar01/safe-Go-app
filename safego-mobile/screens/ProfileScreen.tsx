import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, typography } from '../theme';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { ActionSheetIOS } from 'react-native';

import ProfileService, { PersonalInfo, MedicalInfo } from '../services/ProfileService';
import { useSafetyIdentity } from '../components/SafetyIdentityContext';
import ProfileAvatar from '../components/ProfileAvatar';

const BLOOD_GROUPS = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'
];

export default function ProfileScreen({ navigation }: any) {
  const { profile } = useSafetyIdentity();
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // Local edit states
  const [personal, setPersonal] = useState<PersonalInfo>(profile?.personal || { fullName: '' });
  const [medical, setMedical] = useState<MedicalInfo>(profile?.medical || {});
  
  // UI states
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  useEffect(() => {
    // Only resync if the backend profile updated and we're not actively saving
    if (!saving) {
      setPersonal(profile.personal);
      setMedical(profile.medical);
    }
  }, [profile.updatedAt]);

  const handleSave = async () => {
    // Validation
    const name = personal.fullName?.trim() || '';
    if (name.length === 0 || name.length > 100) {
      Alert.alert('Validation Error', 'Full Name is required and must be between 1 and 100 characters.');
      return;
    }

    if (medical.medicalConditions && medical.medicalConditions.length > 1000) {
      Alert.alert('Validation Error', 'Medical Conditions notes cannot exceed 1000 characters.');
      return;
    }
    if (medical.allergies && medical.allergies.length > 1000) {
      Alert.alert('Validation Error', 'Allergies notes cannot exceed 1000 characters.');
      return;
    }
    if (medical.medications && medical.medications.length > 1000) {
      Alert.alert('Validation Error', 'Medications notes cannot exceed 1000 characters.');
      return;
    }

    setSaving(true);
    await ProfileService.save({
      ...personal,
      ...medical
    });
    setSaving(false);
    
    Alert.alert('Success', 'Profile saved successfully.');
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      // Prevent future dates
      if (selectedDate > new Date()) {
        Alert.alert('Invalid Date', 'Date of birth cannot be in the future.');
        return;
      }
      
      const formattedDate = selectedDate.toISOString().split('T')[0];
      setPersonal(prev => ({ ...prev, dateOfBirth: formattedDate }));
    }
  };

  const handleBloodGroupPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Unknown', ...BLOOD_GROUPS.filter(g => g !== 'Unknown')],
          cancelButtonIndex: 0,
          title: 'Select Blood Group'
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            const selected = ['Cancel', 'Unknown', ...BLOOD_GROUPS.filter(g => g !== 'Unknown')][buttonIndex];
            setPersonal(prev => ({ ...prev, bloodGroup: selected }));
          }
        }
      );
    } else {
      // Fallback for Android (using existing picker wrapped in a modal, or just an alert for simplicity)
      // Since Picker intercepts scrolling, we will wrap it in a custom alert/modal for Android later if needed,
      // but for now, we can leave the inline picker for Android.
    }
  };

  // Missing Information Checklist computation
  const isMissing = (val?: string) => !val || val.trim().length === 0;
  const missingItems = [
    { label: 'Name', valid: !isMissing(personal?.fullName) },
    { label: 'Date of Birth', valid: !isMissing(personal?.dateOfBirth) },
    { label: 'Blood Group', valid: !isMissing(personal?.bloodGroup) },
    { label: 'Medical Information', valid: !isMissing(medical?.medicalConditions) || !isMissing(medical?.allergies) || !isMissing(medical?.medications) },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safety Profile</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveBtnText, saving && styles.disabledText]}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          
          <ProfileAvatar 
            avatarUrl={personal?.avatarUrl} 
            fullName={personal?.fullName || ''}
            onChangePhoto={(uri) => setPersonal(prev => ({ ...prev, avatarUrl: uri }))}
          />

          {/* Checklist */}
          <View style={styles.checklistCard}>
            <Text style={styles.checklistTitle}>Profile Checklist</Text>
            {missingItems.map((item, idx) => (
              <View key={idx} style={styles.checklistItem}>
                {item.valid ? (
                  <Feather name="check-circle" size={16} color="#16a34a" style={styles.checkIcon} />
                ) : (
                  <Feather name="alert-triangle" size={16} color="#f59e0b" style={styles.checkIcon} />
                )}
                <Text style={[styles.checklistText, !item.valid && styles.checklistMissing]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Personal Information */}
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.card}>
            <View style={styles.inputRow}>
              <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={personal?.fullName || ''}
                onChangeText={(val) => setPersonal(prev => ({ ...prev, fullName: val }))}
                placeholder="Required"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={styles.divider} />
            
            <View style={styles.inputRow}>
              <Text style={styles.label}>Preferred Name</Text>
              <TextInput
                style={styles.input}
                value={personal?.preferredName || ''}
                onChangeText={(val) => setPersonal(prev => ({ ...prev, preferredName: val }))}
                placeholder="Optional"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={styles.divider} />

            <View style={styles.inputRow}>
              <Text style={styles.label}>Date of Birth</Text>
              <TouchableOpacity style={styles.inputTouchable} onPress={() => setShowDatePicker(true)}>
                <Text style={personal?.dateOfBirth ? styles.inputText : styles.placeholderText}>
                  {personal?.dateOfBirth || 'Select Date'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.divider} />

            <View style={styles.pickerRow}>
              <Text style={styles.label}>Blood Group</Text>
              {Platform.OS === 'ios' ? (
                <TouchableOpacity style={styles.inputTouchable} onPress={handleBloodGroupPress}>
                  <Text style={personal?.bloodGroup ? styles.inputText : styles.placeholderText}>
                    {personal?.bloodGroup || 'Select Blood Group'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={personal?.bloodGroup || ''}
                    onValueChange={(itemValue) => setPersonal(prev => ({ ...prev, bloodGroup: itemValue }))}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select..." value="" color="#9ca3af" />
                    {BLOOD_GROUPS.map(bg => (
                      <Picker.Item key={bg} label={bg} value={bg} />
                    ))}
                  </Picker>
                </View>
              )}
            </View>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={personal?.dateOfBirth ? new Date(personal.dateOfBirth) : new Date()}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={handleDateChange}
            />
          )}

          {/* Medical Information */}
          <Text style={styles.sectionTitle}>Medical Information</Text>
          <Text style={styles.sectionDesc}>This information helps emergency responders.</Text>
          <View style={styles.card}>
            <View style={styles.textAreaRow}>
              <Text style={[styles.label, { width: '100%' }]}>Medical Conditions</Text>
              <TextInput
                style={styles.textArea}
                value={medical?.medicalConditions || ''}
                onChangeText={(val) => setMedical(prev => ({ ...prev, medicalConditions: val }))}
                placeholder="e.g. Asthma, Diabetes..."
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={1000}
              />
            </View>
            <View style={styles.divider} />

            <View style={styles.textAreaRow}>
              <Text style={[styles.label, { width: '100%' }]}>Allergies</Text>
              <TextInput
                style={styles.textArea}
                value={medical?.allergies || ''}
                onChangeText={(val) => setMedical(prev => ({ ...prev, allergies: val }))}
                placeholder="e.g. Penicillin, Peanuts..."
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={1000}
              />
            </View>
            <View style={styles.divider} />

            <View style={styles.textAreaRow}>
              <Text style={[styles.label, { width: '100%' }]}>Current Medications</Text>
              <TextInput
                style={styles.textArea}
                value={medical?.medications || ''}
                onChangeText={(val) => setMedical(prev => ({ ...prev, medications: val }))}
                placeholder="e.g. Inhaler, Insulin..."
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={1000}
              />
            </View>
          </View>

          {/* Emergency Contacts */}
          <Text style={styles.sectionTitle}>Emergency Contacts</Text>
          <View style={styles.card}>
            <TouchableOpacity 
              style={styles.navRow} 
              onPress={() => navigation.navigate('EmergencyContacts')}
            >
              <View>
                <Text style={styles.navLabel}>Manage Emergency Contacts</Text>
                <Text style={styles.navDesc}>Add or remove trusted guardians</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.previewBtn} onPress={() => setShowPreview(true)}>
            <Feather name="eye" size={18} color="#16a34a" style={styles.previewIcon} />
            <Text style={styles.previewBtnText}>Preview Emergency Information</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showPreview} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewHeaderTitle}>Emergency Information</Text>
            <TouchableOpacity onPress={() => setShowPreview(false)}>
              <Text style={styles.previewCloseBtn}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.previewScroll}>
            <View style={styles.previewNoticeBox}>
              <Feather name="info" size={20} color="#0369a1" />
              <Text style={styles.previewNoticeText}>
                This is exactly the information that will be securely shared with your Emergency Contacts and Police Control Room when you trigger an SOS.
              </Text>
            </View>
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>Full Name</Text>
              <Text style={styles.previewValue}>{personal.fullName || '—'}</Text>
              
              <Text style={styles.previewLabel}>Date of Birth</Text>
              <Text style={styles.previewValue}>{personal.dateOfBirth || '—'}</Text>
              
              <Text style={styles.previewLabel}>Blood Group</Text>
              <Text style={styles.previewValue}>{personal.bloodGroup || '—'}</Text>
              
              <Text style={styles.previewLabel}>Medical Conditions</Text>
              <Text style={styles.previewValue}>{medical.medicalConditions || '—'}</Text>
              
              <Text style={styles.previewLabel}>Allergies</Text>
              <Text style={styles.previewValue}>{medical.allergies || '—'}</Text>
              
              <Text style={styles.previewLabel}>Medications</Text>
              <Text style={styles.previewValue}>{medical.medications || '—'}</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { paddingVertical: 4, paddingRight: 12 },
  backBtnText: { ...typography.callout, color: '#111827' },
  headerTitle: { ...typography.headline, color: '#111827' },
  saveBtn: { paddingVertical: 4, paddingLeft: 12 },
  saveBtnText: { ...typography.callout, color: '#16a34a' },
  disabledText: { color: '#9ca3af' },
  
  scroll: { padding: 16, paddingBottom: 40, backgroundColor: '#f9fafb', flexGrow: 1 },
  
  checklistCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 8,
  },
  checklistTitle: {
    ...typography.subhead,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkIcon: {
    marginRight: 8,
  },
  checklistText: {
    ...typography.subhead,
    color: '#374151',
  },
  checklistMissing: {
    color: '#b45309',
    fontWeight: '500',
  },

  sectionTitle: {
    ...typography.footnote,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionDesc: {
    ...typography.footnote,
    color: '#6b7280',
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  pickerContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  picker: {
    width: '100%',
  },
  textAreaRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 16 },
  
  label: { 
    ...typography.subhead,
    color: '#111827', 
    width: 130,
  },
  required: {
    color: '#dc2626'
  },
  input: {
    flex: 1,
    ...typography.body,
    color: '#111827',
    paddingVertical: 4,
    textAlign: 'right',
  },
  inputTouchable: {
    flex: 1,
    paddingVertical: 4,
    alignItems: 'flex-end',
  },
  inputText: {
    ...typography.body,
    color: '#111827',
  },
  placeholderText: {
    ...typography.body,
    color: '#9ca3af',
  },
  textArea: {
    ...typography.body,
    color: '#1f2937',
    minHeight: 35,
    marginTop: 8,
    textAlignVertical: 'top',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  previewHeaderTitle: {
    ...typography.headline,
    color: '#111827',
  },
  previewCloseBtn: {
    ...typography.callout,
    color: '#16a34a',
  },
  previewScroll: {
    flex: 1,
    padding: 16,
  },
  previewNoticeBox: {
    flexDirection: 'row',
    backgroundColor: '#e0f2fe',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  previewNoticeText: {
    flex: 1,
    marginLeft: 12,
    ...typography.subhead,
    color: '#0369a1',
    lineHeight: 20,
  },
  previewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  previewLabel: {
    ...typography.caption1,
    color: '#6b7280',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 16,
  },
  previewValue: {
    ...typography.body,
    color: '#111827',
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 16,
    marginBottom: 32,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  previewIcon: {
    marginRight: 8,
  },
  previewBtnText: {
    ...typography.callout,
    color: '#16a34a',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  navLabel: {
    ...typography.subhead,
    color: '#111827',
  },
  navDesc: {
    ...typography.footnote,
    color: '#6b7280',
    marginTop: 2,
  }
});
