import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) map.fitBounds(positions, { padding: [20, 20] });
  }, [map, positions]);
  return null;
}

export default function ActivityMap({ trackPoints, height = 320 }) {
  if (!trackPoints?.length) {
    return (
      <div className="rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-slate-400 text-sm" style={{ height }}>
        No GPS data
      </div>
    );
  }

  const positions = trackPoints.map((p) => [p.lat, p.lon]);
  const start = positions[0];
  const end = positions[positions.length - 1];
  const center = positions[Math.floor(positions.length / 2)];

  return (
    <div style={{ height }} className="rounded-2xl overflow-hidden border border-brand-100">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl attributionControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={positions} color="#4AAEE0" weight={3} opacity={0.9} />
        <CircleMarker center={start} radius={7} fillColor="#5DCE7A" color="#fff" weight={2} fillOpacity={1} />
        <CircleMarker center={end} radius={7} fillColor="#f87171" color="#fff" weight={2} fillOpacity={1} />
        <FitBounds positions={positions} />
      </MapContainer>
    </div>
  );
}
