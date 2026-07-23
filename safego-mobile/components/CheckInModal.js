import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  DeviceEventEmitter,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import CheckInService, {
  EVENT_CHECKIN_PROMPT,
  EVENT_CHECKIN_HIDE,
} from '../services/CheckInService';

export default function CheckInModal() {
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    let intervalId = null;

    const showSub = DeviceEventEmitter.addListener(EVENT_CHECKIN_PROMPT, (payload) => {
      setTimeLeft(payload.timeoutSeconds);
      setVisible(true);

      // Start the visual countdown
      intervalId = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalId);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    const hideSub = DeviceEventEmitter.addListener(EVENT_CHECKIN_HIDE, () => {
      setVisible(false);
      if (intervalId) clearInterval(intervalId);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleConfirm = () => {
    CheckInService.onConfirmed();
  };

  if (!visible) return null;

  // Format MM:SS
  const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const secs = (timeLeft % 60).toString().padStart(2, '0');

  return (
    <Modal transparent animationType="slide" visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Feather name="shield" size={48} color="#16a34a" style={{ marginBottom: 16 }} />
          <Text style={styles.title}>Safety Check-in</Text>
          <Text style={styles.body}>Just checking in. Are you safe?</Text>
          
          <Text style={styles.countdownLabel}>Respond within</Text>
          <Text style={styles.countdownValue}>{mins}:{secs}</Text>

          <TouchableOpacity style={styles.btn} onPress={handleConfirm} activeOpacity={0.8}>
            <Text style={styles.btnText}>I'm Safe</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  countdownLabel: {
    fontSize: 14,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    marginBottom: 4,
  },
  countdownValue: {
    fontSize: 42,
    fontWeight: '800',
    color: '#dc2626',
    fontVariant: ['tabular-nums'],
    marginBottom: 32,
  },
  btn: {
    width: '100%',
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.5,
  },
});
