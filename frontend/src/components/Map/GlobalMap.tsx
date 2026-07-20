import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTelemetryStore } from '../../store/telemetryStore';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icon marker in Vite builds
const createSvgIcon = (color: string, isActive: boolean = false) => {
  const size = isActive ? 42 : 30;
  const innerSize = isActive ? 16 : 12;
  const dashedSize = isActive ? 32 : 22;
  const auraStyle = isActive ? `box-shadow: 0 0 16px 4px ${color}; z-index: 100;` : `box-shadow: 0 0 6px ${color};`;
  const animationDuration = isActive ? '2s' : '4s';
  const dashedStyle = isActive ? `border: 2.5px dashed ${color}; opacity: 0.85;` : `border: 2px dashed ${color}; opacity: 0.5;`;

  return L.divIcon({
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: ${innerSize}px; height: ${innerSize}px; background-color: ${color}; border-radius: 50%; border: 2px solid #111827; ${auraStyle}"></div>
        <div style="position: absolute; width: ${dashedSize}px; height: ${dashedSize}px; ${dashedStyle} border-radius: 50%; animation: spin ${animationDuration} linear infinite;"></div>
        ${isActive ? `<div style="position: absolute; width: ${dashedSize + 12}px; height: ${dashedSize + 12}px; border: 1.5px solid ${color}; border-radius: 50%; animation: pulse-ring 2s ease-out infinite; opacity: 0.6;"></div>` : ''}
      </div>
      <style>
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse-ring {
          0% { transform: scale(0.65); opacity: 1; }
          100% { transform: scale(1.3); opacity: 0; }
        }
      </style>
    `,
    className: 'custom-map-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

interface ChuteMapItem {
  _id: string;
  name: string;
  gpsCoordinates: { lat: number; lng: number };
  status: string;
  plantName: string;
}

// Helper to guarantee valid coordinates for every chute
const getChuteCoords = (chute: ChuteMapItem, index: number): { lat: number; lng: number } => {
  if (
    chute.gpsCoordinates &&
    typeof chute.gpsCoordinates.lat === 'number' &&
    typeof chute.gpsCoordinates.lng === 'number' &&
    !isNaN(chute.gpsCoordinates.lat) &&
    !isNaN(chute.gpsCoordinates.lng)
  ) {
    return { lat: chute.gpsCoordinates.lat, lng: chute.gpsCoordinates.lng };
  }
  // Deterministic offset based on index so every chute has a distinct visible location on map
  return {
    lat: 36.1699 + (index % 5) * 0.006,
    lng: -115.1398 + Math.floor(index / 5) * 0.008,
  };
};

// Center map component helper (smooth flyTo animation)
const ChangeMapView: React.FC<{ coords: { lat: number; lng: number } }> = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number' && map) {
      try {
        const container = map.getContainer();
        if (container && container.clientWidth > 0 && container.clientHeight > 0) {
          map.flyTo([coords.lat, coords.lng], 14, { animate: true, duration: 1 });
        }
      } catch (e) {
        // Suppress Leaflet flyTo errors on unmount/hidden container
      }
    }
  }, [coords.lat, coords.lng, map]);
  return null;
};

export const GlobalMap: React.FC<{ chutes: ChuteMapItem[] }> = ({ chutes }) => {
  const { setActiveChute, activeChuteId } = useTelemetryStore();
  const [filter, setFilter] = useState<string>('All');
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 36.1699, lng: -115.1398 });

  const statusColors = {
    Normal: '#00C853',
    Buildup: '#FFB300',
    Blocked: '#FF3D00',
    Blasting: '#2196F3',
  };

  const filteredChutes = chutes.filter((c) => {
    if (filter === 'All') return true;
    return c.status === filter;
  });

  // Center map on active chute if selected (triggers when upper tab changes activeChuteId)
  useEffect(() => {
    if (activeChuteId && chutes.length > 0) {
      const activeIndex = chutes.findIndex((c) => c._id === activeChuteId);
      if (activeIndex !== -1) {
        const coords = getChuteCoords(chutes[activeIndex], activeIndex);
        setMapCenter(coords);
      }
    }
  }, [activeChuteId, chutes]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        /* Map tile filters by theme */
        [data-theme='dark'] .leaflet-container .leaflet-tile-container img {
          filter: grayscale(100%) invert(95%) brightness(75%) contrast(125%) hue-rotate(185deg) !important;
        }
        [data-theme='light'] .leaflet-container .leaflet-tile-container img {
          filter: grayscale(30%) brightness(105%) contrast(95%) !important;
        }
        /* Custom branded leaflet zoom controls */
        .leaflet-bar {
          border: 1px solid var(--border) !important;
          box-shadow: none !important;
          border-radius: 6px !important;
          overflow: hidden;
        }
        .leaflet-bar a {
          background: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-bottom: 1px solid var(--border-light) !important;
          transition: background 0.2s, color 0.2s;
        }
        .leaflet-bar a:hover {
          background: var(--bg-hover) !important;
          color: var(--accent-primary) !important;
        }
        /* Popup Styling */
        .leaflet-popup-content-wrapper {
          background: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border: 1px solid var(--border) !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
        }
        .leaflet-popup-tip {
          background: var(--card-bg) !important;
          border: 1px solid var(--border) !important;
        }
        /* Hide default attribution */
        .leaflet-control-attribution {
          display: none !important;
        }
      `}</style>

      {/* Map Control Filters */}
      <div 
        style={{ 
          display: 'flex', 
          gap: '6px', 
          marginBottom: '8px', 
          zIndex: 400,
          background: '#111827',
          padding: '4px',
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        {['All', 'Normal', 'Buildup', 'Blocked', 'Blasting'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '3px 8px',
              fontSize: '10px',
              borderRadius: '4px',
              border: 'none',
              background: filter === f ? '#2196F3' : '#1F2937',
              color: '#F9FAFB',
              cursor: 'pointer',
              fontWeight: filter === f ? 700 : 500,
              transition: 'background 0.2s'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Leaflet Container Wrapper */}
      <div style={{ flex: 1, minHeight: '180px', borderRadius: '8px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.08)' }}>
        <MapContainer 
          center={[mapCenter.lat, mapCenter.lng]} 
          zoom={13} 
          style={{ width: '100%', height: '100%', background: '#0B1220' }}
          attributionControl={false}
        >
          <ChangeMapView coords={mapCenter} />
          
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {filteredChutes.map((chute, idx) => {
            const coords = getChuteCoords(chute, idx);
            const color = statusColors[chute.status as keyof typeof statusColors] || '#00C853';
            const isActive = chute._id === activeChuteId;
            const icon = createSvgIcon(color, isActive);

            return (
              <Marker
                key={chute._id}
                position={[coords.lat, coords.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => {
                    setActiveChute(chute._id);
                    setMapCenter(coords);
                  },
                }}
              >
                <Popup>
                  <div style={{ color: '#F9FAFB', fontFamily: 'Outfit, sans-serif' }}>
                    <h4 style={{ margin: 0, fontWeight: 700, fontSize: '12px' }}>{chute.name}</h4>
                    <p style={{ margin: '2px 0 6px 0', fontSize: '10px', color: '#94a3b8' }}>
                      Plant: {chute.plantName}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span 
                        style={{ 
                          width: '6px', 
                          height: '6px', 
                          borderRadius: '50%', 
                          background: color, 
                          display: 'inline-block' 
                        }}
                      ></span>
                      <strong style={{ fontSize: '11px', color }}>{chute.status.toUpperCase()}</strong>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Premium Enterprise Attribution Overlay */}
        <div style={{
          position: 'absolute',
          bottom: '6px',
          left: '6px',
          zIndex: 1000,
          background: 'rgba(17, 24, 39, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '8px',
          color: '#94a3b8',
          fontFamily: "'Share Tech Mono', monospace"
        }}>
          NighaTech Global Pvt Ltd
        </div>
      </div>
    </div>
  );
};
