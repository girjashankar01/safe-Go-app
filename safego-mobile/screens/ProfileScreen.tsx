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
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

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
              <Text style={styles.label}>Medical Conditions</Text>
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
              <Text style={styles.label}>Allergies</Text>
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
              <Text style={styles.label}>Current Medications</Text>
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
  container: { flex: 1, backgroundColor: '#f9fafb' },
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
  backBtnText: { fontSize: 15, color: '#111827', fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  saveBtn: { paddingVertical: 4, paddingLeft: 12 },
  saveBtnText: { fontSize: 15, color: '#16a34a', fontWeight: '600' },
  disabledText: { color: '#9ca3af' },
  
  scroll: { padding: 16, paddingBottom: 40 },
  
  checklistCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 8,
  },
  checklistTitle: {
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 14,
    color: '#374151',
  },
  checklistMissing: {
    color: '#b45309',
    fontWeight: '500',
  },

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
  sectionDesc: {
    fontSize: 13,
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
    fontSize: 15, 
    color: '#111827', 
    fontWeight: '500',
    width: 130,
  },
  required: {
    color: '#dc2626'
  },
  input: {
    flex: 1,
    fontSize: 15,
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
    fontSize: 15,
    color: '#111827',
  },
  placeholderText: {
    fontSize: 15,
    color: '#9ca3af',
  },
  textArea: {
    fontSize: 15,
    color: '#111827',
    marginTop: 8,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  navLabel: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  navDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  }
});
