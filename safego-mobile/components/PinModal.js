import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  DeviceEventEmitter,
  ActivityIndicator,
} from 'react-native';
import PinService, { EVENT_REQUEST_PIN } from '../services/PinService';

export default function PinModal() {
  const [visible, setVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [resolver, setResolver] = useState(null);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(EVENT_REQUEST_PIN, (payload) => {
      setResolver(() => payload.onResult);
      setPin('');
      setErrorMsg('');
      setLoading(false);
      setVisible(true);
    });

    return () => sub.remove();
  }, []);

  const handleCancel = () => {
    setVisible(false);
    if (resolver) {
      resolver(false);
    }
  };

  const handleSubmit = async () => {
    if (!pin) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const isValid = await PinService.verifyPin(pin);
      if (isValid) {
        setVisible(false);
        if (resolver) resolver(true);
      } else {
        setErrorMsg('Incorrect PIN');
        setPin('');
      }
    } catch (e) {
      setErrorMsg('An error occurred. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Security Check</Text>
          <Text style={styles.body}>Enter your Emergency PIN to proceed.</Text>

          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={(text) => {
              setPin(text.replace(/[^0-9]/g, ''));
              setErrorMsg('');
            }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            placeholder="••••"
            placeholderTextColor="#9ca3af"
            autoFocus
          />

          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.btn, styles.cancelBtn]} 
              onPress={handleCancel}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.btn, styles.submitBtn, (!pin || loading) && styles.submitBtnDisabled]} 
              onPress={handleSubmit}
              disabled={!pin || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Verify</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
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
  error: {
    color: '#dc2626',
    marginBottom: 16,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#f3f4f6',
  },
  cancelBtnText: {
    color: '#4b5563',
    fontWeight: '600',
    fontSize: 16,
  },
  submitBtn: {
    backgroundColor: '#16a34a',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
