'use client';

import 'leaflet/dist/leaflet.css';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';

import { type MapPoint, rateColor } from '@/app/admin/borrowerProfileModel';

// The Philippines fills the view; points elsewhere (Indonesia, abroad) are a scroll away.
const PH_CENTER: [number, number] = [12.3, 122.3];

export default function BorrowerProfileMap({ points }: { points: MapPoint[] }) {
   return (
      <div className="overflow-hidden rounded-2xl border border-[#2a1453] bg-[#0e0620]">
         <style>{'.bp-dark-tiles { filter: invert(1) hue-rotate(200deg) brightness(0.85) contrast(0.9) saturate(0.6); }'}</style>
         <MapContainer center={PH_CENTER} zoom={5} minZoom={3} style={{ height: 520, width: '100%' }} scrollWheelZoom={false}>
            {/* OpenStreetMap tiles (CARTO's dark tiles now need an API key), darkened to fit the admin theme. */}
            <TileLayer
               attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
               url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
               className="bp-dark-tiles"
            />
            {points.map((p) => {
               const color = rateColor(p.due, p.onTime);
               return (
                  <CircleMarker
                     key={`${p.lat},${p.lng}`}
                     center={[p.lat, p.lng]}
                     radius={Math.min(5 + Math.sqrt(p.people) * 4, 26)}
                     pathOptions={{ color, fillColor: color, fillOpacity: 0.5, weight: 1.5 }}
                  >
                     <Tooltip>
                        <div style={{ fontWeight: 700 }}>{p.label}</div>
                        <div>
                           {p.people} {p.people === 1 ? 'person' : 'people'} · {p.borrowers} borrowed
                        </div>
                        <div>{p.due ? `${p.onTime} of ${p.due} loans paid on time` : 'No loans due yet'}</div>
                     </Tooltip>
                  </CircleMarker>
               );
            })}
         </MapContainer>
      </div>
   );
}
