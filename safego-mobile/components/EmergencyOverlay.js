import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  Modal,
  Dimensions
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import SOSService from '../services/SOSService';
import PinService from '../services/PinService';

export default function EmergencyOverlay() {
  const [sosState, setSosState] = useState(null);

  useEffect(() => {
    const unsub = SOSService.subscribe(setSosState);
    return unsub;
  }, []);

  // Disable hardware back button when overlay is active and in critical state
  useEffect(() => {
    const onBackPress = () => {
      if (!sosState) return false;
      
      const criticalStates = [
        'COUNTDOWN', 
        'RECORDING', 
        'UPLOADING', 
        'SENDING', 
        'ACTIVE'
      ];
      
      if (criticalStates.includes(sosState.status)) {
        // Intercept and prevent back navigation
        return true; 
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [sosState]);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (sosState && sosState.status !== 'IDLE' && sosState.status !== 'CANCELLED') {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [sosState?.status]);

  if (!sosState || sosState.status === 'IDLE' || sosState.status === 'CANCELLED') {
    return null; 
  }

  const { status, activationProgress, countdown, recordingTimeLeft, errorMsg, currentTrigger, startedAt } = sosState;

  const renderCountdown = () => {
    // Stage 2
    return (
      <View style={styles.centerContainer}>
        <Feather name="alert-triangle" size={64} color="#dc2626" style={{ marginBottom: 16 }} />
        <Text style={styles.overlayTitle}>{currentTrigger || 'Emergency SOS'}</Text>
        <Text style={styles.overlaySubtitle}>Sending alert in</Text>
        <Text style={styles.countdownNumber}>{countdown}</Text>
        
        <TouchableOpacity 
          style={styles.cancelBtn} 
          onPress={async () => {
            const validated = await PinService.requestPinValidation(4000);
            if (validated) {
              SOSService.cancelSOS();
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRecording = () => {
    // Stage 3
    return (
      <View style={styles.centerContainer}>
        <Feather name="mic" size={64} color="#dc2626" style={{ marginBottom: 16 }} />
        <Text style={styles.overlayTitle}>Recording Evidence</Text>
        <Text style={styles.countdownNumber}>{recordingTimeLeft}</Text>
        <Text style={styles.overlaySubtitle}>Capturing audio...</Text>
      </View>
    );
  };

  const renderUploading = () => {
    // Stage 4
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#dc2626" style={{ marginBottom: 20, transform: [{ scale: 1.5 }] }} />
        <Text style={styles.overlayTitle}>Uploading</Text>
        <Text style={styles.overlaySubtitle}>Securing audio evidence...</Text>
      </View>
    );
  };

  const renderSending = () => {
    // Stage 5
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#dc2626" style={{ marginBottom: 20, transform: [{ scale: 1.5 }] }} />
        <Text style={styles.overlayTitle}>Sending SOS</Text>
        <Text style={styles.overlaySubtitle}>Notifying your emergency contacts...</Text>
      </View>
    );
  };

  const renderActive = () => {
    // Stage 6
    const startTimeStr = startedAt ? new Date(startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return (
      <View style={styles.centerContainer}>
        <Feather name="shield" size={64} color="#16a34a" style={{ marginBottom: 16 }} />
        <Text style={styles.overlayTitle}>Emergency Active</Text>
        {startedAt && <Text style={styles.startedAtText}>Started at {startTimeStr}</Text>}
        
        <View style={styles.checklistContainer}>
          <View style={styles.checklistItem}>
            <Feather name="check-circle" size={20} color="#16a34a" />
            <Text style={styles.checklistText}>Recording Uploaded</Text>
          </View>
          <View style={styles.checklistItem}>
            <Feather name="check-circle" size={20} color="#16a34a" />
            <Text style={styles.checklistText}>SOS Sent</Text>
          </View>
          <View style={styles.checklistItem}>
            <Feather name="check-circle" size={20} color="#16a34a" />
            <Text style={styles.checklistText}>Live Tracking Active</Text>
          </View>
          <View style={styles.checklistItem}>
            <Feather name="check-circle" size={20} color="#16a34a" />
            <Text style={styles.checklistText}>Contacts Notified</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderFailed = () => {
    // Stage 7
    return (
      <View style={styles.centerContainer}>
        <Feather name="x-circle" size={64} color="#dc2626" style={{ marginBottom: 16 }} />
        <Text style={styles.overlayTitle}>Action Failed</Text>
        <Text style={styles.overlaySubtitle}>{errorMsg || 'An unknown error occurred.'}</Text>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.retryBtn]} 
            onPress={() => SOSService.retryRecording()}
            activeOpacity={0.8}
          >
            <Text style={styles.retryBtnText}>Retry Upload</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.anywayBtn]} 
            onPress={() => SOSService.sendSOSAnyway()}
            activeOpacity={0.8}
          >
            <Text style={styles.anywayBtnText}>Send Anyway</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.cancelBtn} 
          onPress={async () => {
            const validated = await PinService.requestPinValidation(4000);
            if (validated) {
              SOSService.cancelSOS();
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelBtnText}>Cancel SOS</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderContent = () => {
    switch (status) {
      case 'COUNTDOWN': return renderCountdown();
      case 'RECORDING': return renderRecording();
      case 'UPLOADING': return renderUploading();
      case 'SENDING': return renderSending();
      case 'ACTIVE': return renderActive();
      case 'FAILED': return renderFailed();
      default: return null;
    }
  };

  return (
    <Animated.View style={[styles.overlayContainer, { opacity: fadeAnim }]}>
      {renderContent()}

      {/* Global Footer */}
      <View style={styles.footerContainer}>
        <Text style={styles.footerTitle}>Emergency Mode</Text>
        <Text style={styles.footerText}>
          SafeGo will remain active until{'\n'}the emergency is resolved.
        </Text>
      </View>
    </Animated.View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    width: width,
    height: height,
    backgroundColor: 'rgba(0, 0, 0, 0.85)', // solid black tint
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  centerContainer: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  overlayTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 8,
    textAlign: 'center',
  },
  overlaySubtitle: {
    fontSize: 16,
    color: '#cbd5e1',
    marginBottom: 32,
    textAlign: 'center',
  },
  overlayDisclaimer: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 24,
    textAlign: 'center',
  },
  countdownNumber: {
    fontSize: 84,
    fontWeight: '900',
    color: '#ef4444',
    marginBottom: 32,
    textAlign: 'center',
  },
  cancelBtn: {
    width: '100%',
    maxWidth: 280,
    height: 54,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  cancelBtnText: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 300,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  retryBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  anywayBtn: {
    backgroundColor: '#ef4444',
  },
  anywayBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  checklistContainer: {
    width: '100%',
    maxWidth: 260,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 20,
    borderRadius: 16,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checklistText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  startedAtText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 24,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
    width: '100%',
  },
  footerTitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  footerText: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  holdContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  holdProgressContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  holdProgress: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)', // light red fading
  },
  holdInnerCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  holdText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
