import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
} from '../lib/api';

const MAX_CONTACTS = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isValidPhone  = (v) => /^\+?[\d\s\-()]{7,20}$/.test(v.trim());

function parseApiError(e) {
  if (!e.response) return 'Could not reach the server. Check your connection.';
  return e.response?.data?.error ?? `Server error (${e.response.status})`;
}

// ─── Contact Card ─────────────────────────────────────────────────────────────

function ContactCard({ contact, onEdit, onDelete }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{contact.name}</Text>
        <Text style={styles.cardDetail}>{contact.phone}</Text>
        <Text style={styles.cardDetail}>{contact.email}</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.cardBtn, styles.cardBtnEdit]}
          onPress={() => onEdit(contact)}
          activeOpacity={0.75}
        >
          <Text style={styles.cardBtnEditText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cardBtn, styles.cardBtnDelete]}
          onPress={() => onDelete(contact)}
          activeOpacity={0.75}
        >
          <Text style={styles.cardBtnDeleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Contact Modal (Add / Edit) ───────────────────────────────────────────────

function ContactModal({ visible, initial, onSave, onCancel }) {
  const isEditing = !!initial;

  const [name,  setName]  = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  // Sync fields when modal opens / contact changes.
  useEffect(() => {
    if (visible) {
      setName(initial?.name  ?? '');
      setPhone(initial?.phone ?? '');
      setEmail(initial?.email ?? '');
      setError('');
    }
  }, [visible, initial]);

  const validate = () => {
    if (!name.trim())         return 'Name is required.';
    if (!phone.trim())        return 'Phone is required.';
    if (!isValidPhone(phone)) return 'Enter a valid phone number.';
    if (!email.trim())        return 'Email is required.';
    if (!isValidEmail(email)) return 'Enter a valid email address.';
    return null;
  };

  const handleSave = async () => {
    const msg = validate();
    if (msg) { setError(msg); return; }

    setError('');
    setSaving(true);
    try {
      await onSave({ name: name.trim(), phone: phone.trim(), email: email.trim() });
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>
            {isEditing ? 'Edit Contact' : 'Add Contact'}
          </Text>

          {error ? <Text style={styles.modalError}>{error}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor="#9ca3af"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            placeholderTextColor="#9ca3af"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="done"
          />

          <TouchableOpacity
            style={[styles.modalBtn, styles.modalBtnPrimary, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.modalBtnPrimaryText}>Save</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modalBtn, styles.modalBtnSecondary]}
            onPress={onCancel}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EmergencyContactsScreen({ navigation }) {
  const [contacts,  setContacts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editing,      setEditing]      = useState(null); // null = adding, object = editing

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getContacts();
      setContacts(data ?? []);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // ── Add ─────────────────────────────────────────────────────────────────────
  const handleOpenAdd = () => {
    setEditing(null);
    setModalVisible(true);
  };

  // ── Edit ────────────────────────────────────────────────────────────────────
  const handleOpenEdit = (contact) => {
    setEditing(contact);
    setModalVisible(true);
  };

  // ── Save (shared by add + edit) ─────────────────────────────────────────────
  const handleSave = async (fields) => {
    if (editing) {
      await updateContact(editing.id, fields);
    } else {
      await createContact(fields);
    }
    setModalVisible(false);
    await fetchContacts();
  };

  const handleCancelModal = () => setModalVisible(false);

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = (contact) => {
    Alert.alert(
      'Delete Contact',
      `Remove ${contact.name} from your emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteContact(contact.id);
              await fetchContacts();
            } catch (e) {
              Alert.alert('Error', parseApiError(e));
            }
          },
        },
      ],
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency Contacts</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Loading contacts…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Error banner */}
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
              <TouchableOpacity onPress={fetchContacts}>
                <Text style={styles.errorBannerRetry}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Count pill */}
          <View style={styles.countRow}>
            <Text style={styles.countText}>
              {contacts.length} / {MAX_CONTACTS} contacts
            </Text>
          </View>

          {/* Empty state */}
          {contacts.length === 0 && !error ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No emergency contacts yet</Text>
              <Text style={styles.emptyBody}>
                Add up to 3 contacts who will be notified when you start a trip.
              </Text>
            </View>
          ) : null}

          {/* Contact cards */}
          {contacts.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
            />
          ))}

          {/* Add button — hidden when at cap */}
          {contacts.length < MAX_CONTACTS ? (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={handleOpenAdd}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnText}>+ Add Contact</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.capBanner}>
              <Text style={styles.capBannerText}>
                Maximum of {MAX_CONTACTS} contacts reached.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Add / Edit modal */}
      <ContactModal
        visible={modalVisible}
        initial={editing}
        onSave={handleSave}
        onCancel={handleCancelModal}
      />
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },

  // Header
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
    color: '#0F766E',
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
    width: 60, // mirrors back button width to center the title
  },

  // Scroll content
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // Error banner
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorBannerText: {
    fontSize: 14,
    color: '#b91c1c',
    flex: 1,
    marginRight: 8,
  },
  errorBannerRetry: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },

  // Count pill
  countRow: {
    marginBottom: 16,
  },
  countText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Contact card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
    marginRight: 12,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  cardDetail: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 1,
  },
  cardActions: {
    flexDirection: 'column',
    gap: 8,
  },
  cardBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignItems: 'center',
  },
  cardBtnEdit: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  cardBtnEditText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
  },
  cardBtnDelete: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  cardBtnDeleteText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc2626',
  },

  // Add button
  addBtn: {
    marginTop: 8,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Cap banner
  capBanner: {
    marginTop: 8,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  capBannerText: {
    fontSize: 14,
    color: '#92400e',
    fontWeight: '500',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 20,
  },
  modalError: {
    fontSize: 14,
    color: '#dc2626',
    marginBottom: 12,
  },

  // Inputs
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 12,
    backgroundColor: '#fff',
  },

  // Modal buttons
  modalBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalBtnPrimary: {
    backgroundColor: '#16a34a',
  },
  modalBtnPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalBtnSecondary: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalBtnSecondaryText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
