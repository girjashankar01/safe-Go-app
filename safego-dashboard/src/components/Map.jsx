import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default icon path issues in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create a custom red pulsing icon for SOS
const sosIcon = new L.DivIcon({
  className: 'sos-marker',
  html: `
    <div class="relative flex h-6 w-6">
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
      <span class="relative inline-flex rounded-full h-6 w-6 bg-red-600 border-2 border-white shadow"></span>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const defaultIcon = new L.DivIcon({
  className: 'default-marker',
  html: `
    <div class="relative flex h-6 w-6">
      <span class="relative inline-flex rounded-full h-6 w-6 bg-blue-500 border-2 border-white shadow"></span>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Component to dynamically update map center when location changes
function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function Map({ location, isSOS }) {
  const position = [location.lat, location.lng];

  return (
    <MapContainer 
      center={position} 
      zoom={16} 
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <Marker position={position} icon={isSOS ? sosIcon : defaultIcon}>
        <Popup>
          <div className="font-sans">
            <strong className="block mb-1">{isSOS ? 'Emergency Location' : 'Current Location'}</strong>
            <span className="text-gray-600">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
          </div>
        </Popup>
      </Marker>
      <ChangeView center={position} />
    </MapContainer>
  );
}
