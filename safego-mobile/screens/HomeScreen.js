import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Dimensions
} from 'react-native';
import { getMe } from '../lib/api';
import { connectSocket, getSocket } from '../lib/socket';
import { getSettings } from '../services/SettingsService';
import FakeCallService from '../services/FakeCallService';
import { useSafetyIdentity } from '../components/SafetyIdentityContext';
import { 
  Settings, ShieldAlert, ShieldCheck, 
  PhoneCall, Bell, MapPin, Map as MapIcon, 
  ChevronRight, Phone 
} from 'lucide-react-native';
import EmergencyDirectoryService from '../services/EmergencyDirectoryService';
import EmergencyHistoryService from '../services/EmergencyHistoryService';
import SOSService from '../services/SOSService';
import EmergencyAlarmService from '../services/EmergencyAlarmService';
import { hasActiveTrip, restoreTrip } from '../lib/tripState';
import SystemStatusCard from '../components/SystemStatusCard';
import { useTheme, spacing, typography, radius } from '../theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ActionCard } from '../components/ui/ActionCard';
import { ScreenContainer } from '../components/ui/ScreenContainer';

// ─── Hold-to-Activate SOS Button ────────────────────────────────────────────────
function HoldToActivateButton({ onActivate }) {
  const { colors } = useTheme();
  const holdProgress = useRef(new Animated.Value(0)).current;
  const buttonSize = Math.min(220, Dimensions.get('window').width * 0.55);

  const startHold = () => {
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: 2000, // 2 seconds
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        onActivate();
        holdProgress.setValue(0);
      }
    });
  };

  const cancelHold = () => {
    Animated.timing(holdProgress).stop();
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const progressSize = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [buttonSize, buttonSize + 60]
  });

  return (
    <View style={styles.holdContainer}>
      <TouchableOpacity 
        style={[styles.holdTouchable, { width: buttonSize + 60, height: buttonSize + 60 }]}
        onPressIn={startHold}
        onPressOut={cancelHold}
        activeOpacity={1}
      >
        <Animated.View 
          style={[
            styles.holdProgress, 
            { 
              width: progressSize, 
              height: progressSize, 
              borderRadius: Animated.divide(progressSize, 2),
              backgroundColor: colors.danger + '40'
            }
          ]} 
        />
        <View style={[
          styles.holdInnerCircle, 
          { 
            width: buttonSize, 
            height: buttonSize, 
            borderRadius: buttonSize / 2, 
            backgroundColor: colors.danger, 
            shadowColor: colors.danger 
          }
        ]}>
          <Text style={[styles.holdText, { fontSize: typography.sizes.display }]}>SOS</Text>
        </View>
      </TouchableOpacity>
      <Text style={[styles.holdSubtext, { color: colors.secondaryText, fontSize: typography.sizes.small }]}>Press and hold</Text>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { profile, missingFields, status: profileStatus } = useSafetyIdentity();
  
  const [socketStatus, setSocketStatus] = useState(
    getSocket().connected ? 'connected' : 'connecting'
  );
  const [fakeCallState, setFakeCallState] = useState({ status: 'Idle', remainingDelay: 0 });
  const [dirState, setDirState] = useState('Loading');
  const [alarmState, setAlarmState] = useState({ status: 'Idle' });
  const [tripActive, setTripActive] = useState(false);

  useEffect(() => {
    const unsub = FakeCallService.subscribe((s) => setFakeCallState(s));
    return unsub;
  }, []);

  useEffect(() => {
    connectSocket();
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onConnect      = () => setSocketStatus('connected');
    const onDisconnect   = () => setSocketStatus('disconnected');
    const onConnectError = () => setSocketStatus('error');
    const onReconnecting = () => setSocketStatus('connecting');

    socket.on('connect',       onConnect);
    socket.on('disconnect',    onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.io.on('reconnect_attempt', onReconnecting);
    socket.io.on('reconnect',         onConnect);

    setSocketStatus(socket.connected ? 'connected' : 'connecting');

    const unsubDir = EmergencyDirectoryService.subscribe((s) => setDirState(s));
    EmergencyDirectoryService.initialize();

    // Silently fetch fresh history for background sync (UI removed in Phase 2)
    EmergencyHistoryService.fetchHistory().catch(e => console.log('Silently ignoring fetch history error on home screen', e));

    const unsubAlarm = EmergencyAlarmService.subscribe((s) => setAlarmState(s));

    return () => {
      socket.off('connect',       onConnect);
      socket.off('disconnect',    onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.io.off('reconnect_attempt', onReconnecting);
      socket.io.off('reconnect',         onConnect);
      unsubDir();
      unsubAlarm();
    };
  }, []);

  // Update trip state on focus
  useEffect(() => {
    const checkTrip = async () => {
      await restoreTrip();
      setTripActive(hasActiveTrip());
    };
    checkTrip();
    const unsubscribe = navigation.addListener('focus', checkTrip);
    return unsubscribe;
  }, [navigation]);

  const cachedNumbers = EmergencyDirectoryService.getCachedNumbers();
  const primaryEmergency = cachedNumbers.find(n => n.service_type === 'Emergency' || n.priority === 1) || cachedNumbers[0];
  const womensHelpline = cachedNumbers.find(n => n.service_type === "Women's Helpline" || n.service_name.toLowerCase().includes('women'));
  
  // Pick up to three initials
  const contactInitials = cachedNumbers
    .slice(0, 3)
    .map(n => n.service_name.charAt(0).toUpperCase());

  // ── Loading ────────────────────────────────────────────────────────────────
  if (profileStatus === 'Loading') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.secondaryText }]}>Loading your profile…</Text>
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <ScreenContainer scrollable>
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.appName, { color: colors.primary }]}>SafeGo</Text>
          <View style={styles.welcomeSection}>
            <Text style={[styles.welcomeGreeting, { color: colors.secondaryText }]}>Welcome back</Text>
            {profile?.personal?.fullName ? (
              <Text style={[styles.welcomeName, { color: colors.text }]}>{profile.personal.fullName}</Text>
            ) : null}
          </View>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={[styles.settingsBtn, { backgroundColor: isDark ? colors.card : '#f3f4f6' }]} 
            onPress={() => navigation.navigate('Settings')}
          >
            <Settings size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.avatarInitial, { color: colors.primary }]}>
              {profile?.personal?.fullName ? profile.personal.fullName.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
        </View>
      </View>

      {/* Emergency Profile Summary */}
      <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
        <Card style={[styles.identityCard, missingFields.totalMissing > 0 && { borderColor: colors.warning, borderWidth: 1 }]}>
          <View style={styles.identityHeader}>
            {missingFields.totalMissing > 0 ? (
              <ShieldAlert size={20} color={colors.warning} />
            ) : (
              <ShieldCheck size={20} color={colors.primary} />
            )}
            <Text style={[styles.identityTitle, { color: missingFields.totalMissing > 0 ? colors.warning : colors.primary }]}>
              {missingFields.totalMissing > 0 ? "Incomplete Emergency Info" : "Emergency Profile Ready"}
            </Text>
          </View>
          
          <View style={styles.identityDetails}>
            <View style={styles.identityRow}>
              <Text style={[styles.identityLabel, { color: colors.secondaryText }]}>Blood Group</Text>
              <Text style={[styles.identityValue, { color: colors.text }]}>{profile.personal.bloodGroup || '—'}</Text>
            </View>
            <View style={styles.identityRow}>
              <Text style={[styles.identityLabel, { color: colors.secondaryText }]}>Medical Notes</Text>
              <Text style={[styles.identityValue, { color: colors.text }]}>{missingFields.medicalInfo ? '—' : 'Available'}</Text>
            </View>
            <View style={styles.identityRow}>
              <Text style={[styles.identityLabel, { color: colors.secondaryText }]}>Last Updated</Text>
              <Text style={[styles.identityValue, { color: colors.text }]}>{new Date(profile.updatedAt).toLocaleDateString()}</Text>
            </View>
          </View>
        </Card>
      </TouchableOpacity>

      {/* System Status */}
      <SystemStatusCard socketStatus={socketStatus} />

      {/* SOS Button */}
      <HoldToActivateButton onActivate={() => SOSService.triggerManualSOS()} />

      {/* Quick Actions (2x2 Grid) */}
      <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>Quick Actions</Text>
      <View style={styles.gridContainer}>
        {/* Fake Call Action (dynamic based on state) */}
        {fakeCallState.status === 'Scheduled' ? (
          <Card style={styles.gridItem}>
             <View style={styles.scheduledCallContent}>
              <Text style={[styles.scheduledCallTitle, { color: colors.text }]}>Call Scheduled</Text>
              <Text style={[styles.scheduledCallSubtitle, { color: colors.primary }]}>{fakeCallState.remainingDelay}s remaining</Text>
              <Button 
                label="Cancel" 
                variant="danger" 
                style={styles.cancelCallBtn} 
                textStyle={{ fontSize: typography.sizes.small }} 
                onPress={() => FakeCallService.cancel()} 
              />
            </View>
          </Card>
        ) : (
          <ActionCard
            label="Fake Call"
            Icon={PhoneCall}
            style={styles.gridItem}
            onPress={async () => {
              const settings = await getSettings();
              FakeCallService.start({
                callerName: settings.fakeCallerName,
                delay: settings.fakeCallDelay,
                ringtoneEnabled: settings.fakeCallRingtone,
                vibrationEnabled: settings.fakeCallVibration,
                autoEndDuration: settings.fakeCallAutoEnd,
              });
            }}
          />
        )}

        {/* Siren Action */}
        <ActionCard
          label={alarmState.status === 'Playing' || alarmState.status === 'Preparing' ? "Stop Siren" : "Loud Siren"}
          Icon={Bell}
          style={styles.gridItem}
          onPress={() => {
            if (alarmState.status === 'Playing' || alarmState.status === 'Preparing') {
              EmergencyAlarmService.stop();
            } else {
              EmergencyAlarmService.start(true, true);
            }
          }}
        />

        <ActionCard
          label="Location"
          Icon={MapPin}
          style={styles.gridItem}
          onPress={() => navigation.navigate('CurrentLocation')}
        />

        <ActionCard
          label="Live Map"
          Icon={MapIcon}
          style={styles.gridItem}
          onPress={() => navigation.navigate('LiveTracking')}
        />
      </View>

      {/* Trip Control */}
      <Button
        label={tripActive ? "End Trip" : "Start Trip"}
        variant={tripActive ? "danger" : "primary"}
        style={styles.tripButton}
        onPress={() => navigation.navigate('Trip')}
      />

      {/* Emergency Contacts */}
      <TouchableOpacity onPress={() => navigation.navigate('EmergencyContacts')} activeOpacity={0.8}>
        <Card style={styles.contactsCard}>
          <View style={styles.contactsContent}>
            <View>
              <Text style={[styles.contactsTitle, { color: colors.text }]}>Emergency Contacts</Text>
              <View style={styles.initialsContainer}>
                {contactInitials.map((initial, i) => (
                  <View key={i} style={[styles.initialBubble, { backgroundColor: colors.primary + '20', borderColor: colors.card }]}>
                    <Text style={[styles.initialText, { color: colors.primary }]}>{initial}</Text>
                  </View>
                ))}
              </View>
            </View>
            <ChevronRight color={colors.secondaryText} size={24} />
          </View>
        </Card>
      </TouchableOpacity>

      {/* Emergency Resources */}
      <TouchableOpacity onPress={() => navigation.navigate('EmergencyServices')} activeOpacity={0.8}>
        <Card style={styles.resourcesCard}>
          <View style={styles.resourcesHeader}>
            <Text style={[styles.resourcesTitle, { color: colors.danger }]}>Emergency</Text>
            <Text style={[styles.resourcesLocation, { color: colors.secondaryText }]}>
              {EmergencyDirectoryService.getCurrentLocationStr()}
            </Text>
          </View>
          <View style={styles.resourcesBody}>
            {primaryEmergency && (
              <View style={styles.resourcesRow}>
                <Text style={[styles.resourcesLabel, { color: colors.text }]}>Emergency</Text>
                <Text style={[styles.resourcesValue, { color: colors.text }]}>{primaryEmergency.phone_number}</Text>
              </View>
            )}
            {womensHelpline && (
              <View style={styles.resourcesRow}>
                <Text style={[styles.resourcesLabel, { color: colors.text }]}>Women's Helpline</Text>
                <Text style={[styles.resourcesValue, { color: colors.text }]}>{womensHelpline.phone_number}</Text>
              </View>
            )}
          </View>
          <View style={styles.resourcesAction}>
            <Text style={[styles.resourcesActionText, { color: colors.danger }]}>Find Nearby</Text>
            <ChevronRight color={colors.danger} size={18} />
          </View>
        </Card>
      </TouchableOpacity>

    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.small,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xxl,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appName: {
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  welcomeSection: {
    justifyContent: 'center',
  },
  welcomeGreeting: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
  },
  welcomeName: {
    fontSize: typography.sizes.headline,
    fontWeight: typography.weights.bold,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: typography.sizes.section,
    fontWeight: typography.weights.bold,
  },
  identityCard: {
    marginBottom: spacing.xxl,
    padding: spacing.lg,
  },
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  identityTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    marginLeft: spacing.sm,
  },
  identityDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  identityRow: {
    flex: 1,
  },
  identityLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  identityValue: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
  },
  holdContainer: {
    alignItems: 'center',
    marginVertical: spacing.xxxl,
  },
  holdTouchable: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  holdProgress: {
    position: 'absolute',
  },
  holdInnerCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    position: 'absolute',
  },
  holdText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 2,
  },
  holdSubtext: {
    marginTop: spacing.xl,
    textAlign: 'center',
    fontWeight: typography.weights.medium,
  },
  sectionTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
  },
  gridItem: {
    width: '48%',
    marginBottom: spacing.md,
  },
  scheduledCallContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduledCallTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  scheduledCallSubtitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  cancelCallBtn: {
    height: 32,
    paddingHorizontal: spacing.md,
  },
  tripButton: {
    marginBottom: spacing.xxl,
  },
  contactsCard: {
    marginBottom: spacing.xxl,
  },
  contactsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactsTitle: {
    fontSize: typography.sizes.section,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  initialsContainer: {
    flexDirection: 'row',
  },
  initialBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -8,
    borderWidth: 2,
  },
  initialText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
  },
  resourcesCard: {
    marginBottom: spacing.xxxl,
  },
  resourcesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  resourcesTitle: {
    fontSize: typography.sizes.section,
    fontWeight: typography.weights.bold,
  },
  resourcesLocation: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
  },
  resourcesBody: {
    marginBottom: spacing.lg,
  },
  resourcesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  resourcesLabel: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
  },
  resourcesValue: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
  },
  resourcesAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resourcesActionText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    marginRight: spacing.xs,
  }
});
