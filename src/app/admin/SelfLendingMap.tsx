'use client';

import 'leaflet/dist/leaflet.css';

import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';

import { type LoginGeoPoint, getLoginGeo } from './adminSupabase';

function pointColor(p: LoginGeoPoint): string {
   if (p.is_hosting) return '#f5a524'; // datacenter
   if (p.account_count > 1) return '#ff4d5e'; // multiple accounts, one place
   return '#4f8cff';
}

export default function SelfLendingMap() {
   const [points, setPoints] = useState<LoginGeoPoint[]>([]);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
      let active = true;
      getLoginGeo()
         .then((p) => active && setPoints(p))
         .catch(() => active && setPoints([]))
         .finally(() => active && setLoading(false));
      return () => {
         active = false;
      };
   }, []);

   // Center on the busiest point, else a neutral world view.
   const center = useMemo<[number, number]>(() => {
      if (!points.length) return [20, 0];
      return [points[0].lat, points[0].lon];
   }, [points]);

   if (loading) {
      return (
         <div className="flex h-[300px] items-center justify-center rounded-2xl border border-[#2a1453] bg-[#160a2e] text-xl font-black text-[#a89bb8]">
            Loading map…
         </div>
      );
   }

   if (!points.length) {
      return (
         <div className="flex h-[200px] items-center justify-center rounded-2xl border border-[#2a1453] bg-[#160a2e] text-center text-xl font-black text-[#6f6385]">
            No geo data yet — needs the record-session-ip edge function (GeoLite2) deployed and users to log in.
         </div>
      );
   }

   return (
      <div className="overflow-hidden rounded-2xl border border-[#2a1453]">
         <MapContainer center={center} zoom={points.length > 1 ? 2 : 5} style={{ height: 420, width: '100%' }} scrollWheelZoom>
            <TileLayer
               attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
               url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map((p, i) => (
               <CircleMarker
                  key={`${p.lat},${p.lon},${i}`}
                  center={[p.lat, p.lon]}
                  radius={Math.min(6 + p.account_count * 3, 22)}
                  pathOptions={{ color: pointColor(p), fillColor: pointColor(p), fillOpacity: 0.45, weight: 2 }}
               >
                  <Tooltip>
                     <div style={{ fontWeight: 700 }}>
                        {[p.city, p.country].filter(Boolean).join(', ') || 'Unknown'}
                        {p.is_hosting ? ' · datacenter' : ''}
                     </div>
                     <div>
                        {p.account_count} account{p.account_count === 1 ? '' : 's'}:{' '}
                        {p.accounts.map((a) => a.username ?? a.user_id.slice(0, 6)).join(', ')}
                     </div>
                  </Tooltip>
               </CircleMarker>
            ))}
         </MapContainer>
      </div>
   );
}
