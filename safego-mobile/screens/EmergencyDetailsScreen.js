import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import EmergencyHistoryService from '../services/EmergencyHistoryService';
import AudioPlayer from '../components/AudioPlayer';

export default function EmergencyDetailsScreen({ route }) {
  const { incidentId } = route.params;
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIncident();
  }, [incidentId]);

  const loadIncident = async () => {
    setLoading(true);
    const data = await EmergencyHistoryService.fetchIncident(incidentId);
    setIncident(data);
    setLoading(false);
  };

  const openInMaps = () => {
    if (!incident) return;
    const { lat, lng, location_name } = incident; // Assuming lat/lng exist in the payload
    
    // We should make sure lat/lng are returned in getEmergencyIncident
    if (!lat || !lng) return;

    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const label = location_name || 'Emergency Location';
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });

    if (url) Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  if (!incident) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Failed to load incident details.</Text>
      </View>
    );
  }

  const dateObj = new Date(incident.fired_at);
  const dateStr = dateObj.toLocaleDateString();
  const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Assume lat/lng are part of the detailed incident response. 
  // If not, the map won't render points.
  const lat = incident.lat;
  const lng = incident.lng;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      <View style={styles.header}>
        <Text style={styles.title}>{incident.display_type}</Text>
        <Text style={styles.subtitle}>{dateStr} at {timeStr}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Incident Integrity</Text>
        <View style={styles.integrityCard}>
          <View style={styles.integrityRow}>
            <Ionicons name="checkmark-circle" size={20} color="#4D9375" />
            <Text style={styles.integrityText}>Delivered to Backend</Text>
          </View>
          <View style={styles.integrityRow}>
            <Ionicons name="checkmark-circle" size={20} color="#4D9375" />
            <Text style={styles.integrityText}>Stored in Database</Text>
          </View>
          {incident.has_recording && (
            <View style={styles.integrityRow}>
              <Ionicons name="checkmark-circle" size={20} color="#4D9375" />
              <Text style={styles.integrityText}>Audio Uploaded</Text>
            </View>
          )}
        </View>
      </View>

      {incident.has_recording && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recording</Text>
          <AudioPlayer 
            incidentId={incident.id} 
            hasRecording={incident.has_recording} 
            recordingDuration={incident.recording_duration} 
            recordingSize={incident.recording_size} 
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.locationCard}>
          <Text style={styles.locationName}>{incident.location_name || 'Unknown Location'}</Text>
          
          {lat != null && lng != null && (
            <>
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: lat,
                    longitude: lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                >
                  <Marker coordinate={{ latitude: lat, longitude: lng }} pinColor="#FF3B30" />
                </MapView>
              </View>
              
              <TouchableOpacity style={styles.mapsButton} onPress={openInMaps}>
                <Ionicons name="map-outline" size={20} color="#0F766E" />
                <Text style={styles.mapsButtonText}>Open in Maps</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <Text style={styles.detailValue}>{incident.display_status}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Priority Level</Text>
            <Text style={styles.detailValue}>{incident.priority_level}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Priority Score</Text>
            <Text style={styles.detailValue}>{incident.priority_score}</Text>
          </View>
          <View style={[styles.detailRow, styles.noBorder]}>
            <Text style={styles.detailLabel}>Trip</Text>
            <Text style={styles.detailValue}>{incident.trip_id ? 'Linked to Trip' : 'Manual Emergency'}</Text>
          </View>
        </View>
      </View>
      
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: '#1A1C1C',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#5C6564',
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#1A1C1C',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  integrityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#DDE4E2',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  integrityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  integrityText: {
    color: '#1A1C1C',
    fontSize: 15,
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DDE4E2',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  locationName: {
    color: '#1A1C1C',
    fontSize: 16,
    padding: 16,
  },
  mapContainer: {
    height: 150,
    width: '100%',
  },
  map: {
    flex: 1,
  },
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F4F3',
    padding: 16,
    gap: 8,
  },
  mapsButtonText: {
    color: '#0F766E',
    fontSize: 16,
    fontWeight: '500',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#DDE4E2',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DDE4E2',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    color: '#5C6564',
    fontSize: 16,
  },
  detailValue: {
    color: '#1A1C1C',
    fontSize: 16,
    fontWeight: '500',
  }
});
