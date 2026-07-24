import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import EmergencyHistoryService from '../services/EmergencyHistoryService';

export default function EmergencyHistoryScreen() {
  const navigation = useNavigation();
  const [incidents, setIncidents] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribing ensures we get latest from cache immediately
    const unsubscribe = EmergencyHistoryService.subscribe(() => {
      setIncidents(EmergencyHistoryService.getCachedHistory());
    });
    
    setIncidents(EmergencyHistoryService.getCachedHistory());
    
    // Fetch fresh data
    EmergencyHistoryService.fetchHistory().finally(() => {
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await EmergencyHistoryService.refresh();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const renderItem = ({ item }) => {
    const dateObj = new Date(item.fired_at);
    const dateStr = dateObj.toLocaleDateString();
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('EmergencyDetails', { incidentId: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardType}>{item.display_type}</Text>
          <View style={[styles.statusBadge, item.status === 'completed' ? styles.statusCompleted : styles.statusFailed]}>
            <Text style={[styles.statusText, item.status === 'completed' ? styles.statusTextCompleted : styles.statusTextFailed]}>{item.display_status}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Ionicons name="time-outline" size={16} color="#5C6564" />
            <Text style={styles.infoText}>{dateStr} at {timeStr}</Text>
          </View>
          
          <View style={styles.row}>
            <Ionicons name="location-outline" size={16} color="#5C6564" />
            <Text style={styles.infoText} numberOfLines={1}>
              {item.location_name || 'Location unknown'}
            </Text>
          </View>
          
          {item.has_recording && (
            <View style={styles.row}>
              <Ionicons name="mic-outline" size={16} color="#5C6564" />
              <Text style={styles.infoText}>Audio recording available</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="shield-checkmark-outline" size={64} color="#5C6564" />
        <Text style={styles.emptyTitle}>No emergency incidents yet.</Text>
        <Text style={styles.emptySubtitle}>
          Your emergency history will appear here after an SOS is successfully sent.
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={incidents}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5C6564" />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DDE4E2',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardType: {
    color: '#1A1C1C',
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#F0F4F3',
  },
  statusCompleted: {
    backgroundColor: '#E3F2EC',
  },
  statusFailed: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    color: '#1A1C1C',
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextCompleted: {
    color: '#4D9375',
  },
  statusTextFailed: {
    color: '#DC2626',
  },
  cardBody: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    color: '#5C6564',
    fontSize: 14,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    color: '#1A1C1C',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#5C6564',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  }
});
