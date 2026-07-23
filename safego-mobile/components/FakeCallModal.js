import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import FakeCallService from '../services/FakeCallService';

const { width } = Dimensions.get('window');

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
}

export default function FakeCallModal() {
  const navigation = useNavigation();
  const [state, setState] = useState({
    status: 'Idle',
    remainingDelay: 0,
    callDuration: 0,
    config: null,
  });

  useEffect(() => {
    const unsubscribe = FakeCallService.subscribe((s) => {
      setState(s);
    });
    return unsubscribe;
  }, []);

  const handleAccept = () => FakeCallService.accept();
  const handleDecline = () => FakeCallService.decline();
  const handleEnd = () => FakeCallService.end();
  
  const handleSafe = () => FakeCallService.clearEnded();
  const handleNeedHelp = () => {
    FakeCallService.clearEnded();
    navigation.navigate('SOS');
  };

  const isVisible = ['Incoming', 'Active', 'Ended'].includes(state.status);

  if (!isVisible) {
    return null;
  }

  const callerName = state.config?.callerName || 'Unknown';
  const initial = callerName.charAt(0).toUpperCase();

  return (
    <Modal visible={isVisible} animationType="slide" transparent={false} onRequestClose={() => {}}>
      <SafeAreaView style={styles.container}>
        
        {/* INCOMING STATE */}
        {state.status === 'Incoming' && (
          <View style={styles.fullScreen}>
            <View style={styles.topSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <Text style={styles.callerName}>{callerName}</Text>
              <Text style={styles.statusText}>Incoming call</Text>
            </View>

            <View style={styles.bottomSection}>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
                  <Feather name="phone-off" size={28} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
                  <Feather name="phone" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.actionLabels}>
                <Text style={styles.actionLabel}>Decline</Text>
                <Text style={styles.actionLabel}>Accept</Text>
              </View>
            </View>
          </View>
        )}

        {/* ACTIVE STATE */}
        {state.status === 'Active' && (
          <View style={styles.fullScreen}>
            <View style={styles.topSection}>
              <View style={styles.avatarSmall}>
                <Text style={styles.avatarSmallText}>{initial}</Text>
              </View>
              <Text style={styles.callerName}>{callerName}</Text>
              <Text style={styles.statusText}>{formatDuration(state.callDuration)}</Text>
            </View>

            <View style={styles.controlsGrid}>
              <View style={styles.controlItem}>
                <View style={styles.controlBtn}>
                  <Feather name="mic-off" size={24} color="#fff" />
                </View>
                <Text style={styles.controlLabel}>mute</Text>
              </View>
              <View style={styles.controlItem}>
                <View style={styles.controlBtn}>
                  <Feather name="grid" size={24} color="#fff" />
                </View>
                <Text style={styles.controlLabel}>keypad</Text>
              </View>
              <View style={styles.controlItem}>
                <View style={styles.controlBtn}>
                  <Feather name="volume-2" size={24} color="#fff" />
                </View>
                <Text style={styles.controlLabel}>speaker</Text>
              </View>
            </View>

            <View style={styles.bottomSection}>
              <TouchableOpacity style={styles.endCallBtn} onPress={handleEnd}>
                <Feather name="phone-off" size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ENDED / FOLLOW UP STATE */}
        {state.status === 'Ended' && (
          <View style={[styles.fullScreen, styles.endedContainer]}>
            <View style={styles.endedCard}>
              <Text style={styles.endedTitle}>Call Ended</Text>
              <Text style={styles.endedBody}>Did this help you safely exit the situation?</Text>
              
              <TouchableOpacity style={styles.safeBtn} onPress={handleSafe}>
                <Feather name="check-circle" size={20} color="#15803d" style={{ marginRight: 8 }} />
                <Text style={styles.safeBtnText}>I'm Safe</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.helpBtn} onPress={handleNeedHelp}>
                <Feather name="alert-triangle" size={20} color="#b91c1c" style={{ marginRight: 8 }} />
                <Text style={styles.helpBtnText}>I Need Help</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  fullScreen: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  topSection: {
    alignItems: 'center',
    marginTop: 60,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarText: {
    fontSize: 40,
    color: '#fff',
    fontWeight: '600',
  },
  avatarSmall: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarSmallText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '600',
  },
  callerName: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '400',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 18,
    color: '#9ca3af',
  },
  bottomSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  actionLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 16,
    width: 80,
    textAlign: 'center',
  },
  declineBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  controlsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginTop: 40,
  },
  controlItem: {
    alignItems: 'center',
  },
  controlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlLabel: {
    color: '#fff',
    fontSize: 14,
  },
  endCallBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endedContainer: {
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    margin: -32, // negate the padding from fullScreen
    padding: 32,
  },
  endedCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  endedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  endedBody: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  safeBtn: {
    flexDirection: 'row',
    backgroundColor: '#dcfce7',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  safeBtnText: {
    color: '#15803d',
    fontSize: 16,
    fontWeight: '700',
  },
  helpBtn: {
    flexDirection: 'row',
    backgroundColor: '#fee2e2',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpBtnText: {
    color: '#b91c1c',
    fontSize: 16,
    fontWeight: '700',
  },
});
