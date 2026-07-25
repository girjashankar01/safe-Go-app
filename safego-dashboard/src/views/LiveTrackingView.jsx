import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import Map from '../components/Map';
import MedicalCard from '../components/MedicalCard';
import { AlertTriangle, Phone, MapPin, User, Activity, Clock } from 'lucide-react';

const SOCKET_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3000';

export default function LiveTrackingView() {
  const { token } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  
  const [liveLocation, setLiveLocation] = useState(null);
  const [sosStatus, setSosStatus] = useState(null);

  useEffect(() => {
    // 1. Fetch initial trip data
    const fetchTrip = async () => {
      try {
        const response = await axios.get(`${API_URL}/track/${token}`);
        setData(response.data);
        if (response.data.location?.lat) {
          setLiveLocation({ lat: response.data.location.lat, lng: response.data.location.lng });
        }
        setSosStatus(response.data.sosEvent);
      } catch (err) {
        setError('Invalid or expired tracking link');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTrip();
  }, [token]);

  useEffect(() => {
    if (!data) return;

    // 2. Connect socket
    const socket = io(SOCKET_URL);
    
    // Join the trip room to receive updates
    socket.emit('trip:join', { tripId: data.trip.id, role: 'watcher' });

    socket.on('location:fan-out', (payload) => {
      setLiveLocation({ lat: payload.lat, lng: payload.lng });
    });

    socket.on('sos:alert', (payload) => {
      setSosStatus(payload);
    });
    
    socket.on('sos:resolved', () => {
      setSosStatus(null);
    });

    return () => {
      socket.disconnect();
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <div className="text-xl flex flex-col items-center gap-4">
          <Activity className="animate-spin w-8 h-8 text-blue-500" />
          <span>Connecting to SafeGo...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white p-6 text-center">
        <div className="max-w-md bg-gray-900 p-8 rounded-xl border border-gray-800 shadow-2xl">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Tracking Unavailable</h2>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  const { trip, users, identity } = data;
  const isSOS = !!sosStatus || trip.status === 'sos';
  
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col md:flex-row">
      {/* Left Sidebar - Details */}
      <div className="w-full md:w-[400px] lg:w-[450px] bg-gray-900 border-r border-gray-800 flex flex-col z-10 shadow-xl overflow-y-auto">
        
        {/* Header */}
        <div className={`p-6 border-b \${isSOS ? 'border-red-900/50 bg-red-950/20' : 'border-gray-800'}`}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold tracking-tight">SafeGo Tracking</h1>
            {isSOS ? (
              <span className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                SOS Active
              </span>
            ) : (
              <span className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                Live
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-900/50 flex items-center justify-center overflow-hidden border border-blue-800">
               {users.avatar_url ? (
                 <img src={users.avatar_url} className="w-full h-full object-cover" />
               ) : (
                 <User className="w-6 h-6 text-blue-400" />
               )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">{users.name}</h2>
              <div className="flex items-center text-sm text-gray-400 gap-1 mt-0.5">
                <Phone className="w-3.5 h-3.5" />
                {users.phone || 'No phone provided'}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1">
          {/* Status Card */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2 uppercase tracking-wide">
              <Activity className="w-4 h-4" /> Trip Status
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Started at</span>
                <span className="text-gray-200">{new Date(trip.started_at).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Current Speed</span>
                <span className="text-gray-200">0 km/h</span>
              </div>
              {liveLocation && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Location</span>
                  <span className="text-blue-400 font-mono text-xs mt-1">
                    {liveLocation.lat.toFixed(5)}, {liveLocation.lng.toFixed(5)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* SOS Event Details if applicable */}
          {sosStatus && (
            <div className="bg-red-950/30 rounded-xl p-4 border border-red-900/50">
              <h3 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2 uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4" /> Emergency Details
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Trigger</span>
                  <span className="text-red-300 font-medium capitalize">{sosStatus.triggerType || 'Manual SOS'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Priority</span>
                  <span className="text-red-300 font-medium">{sosStatus.priorityLevel || 'CRITICAL'}</span>
                </div>
                {sosStatus.audioClipUrl && (
                  <div className="mt-4 pt-3 border-t border-red-900/30">
                    <a 
                      href={sosStatus.audioClipUrl} 
                      target="_blank"
                      className="flex items-center justify-center gap-2 w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
                    >
                      Listen to Ambient Audio
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Medical Information */}
          <MedicalCard identity={identity} />
          
        </div>
      </div>

      {/* Right Map Area */}
      <div className="flex-1 h-[50vh] md:h-screen bg-gray-900 relative">
        {liveLocation ? (
          <Map location={liveLocation} isSOS={isSOS} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 flex-col gap-3">
            <MapPin className="w-12 h-12 opacity-50" />
            <p>Waiting for GPS signal...</p>
          </div>
        )}
      </div>
    </div>
  );
}
