import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { ConsolidatedRequest, SupplyPoint, TaskMatch, UserProfile, Dispatch } from '../types';
import { 
  Package, Warehouse, Layers, Droplets, Navigation, 
  Target, Zap, Activity, Info, AlertCircle, ChevronRight, 
  Map as MapIcon, Crosshair, Search, Users, Layout, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types & Constants ---
const CHENNAI_CENTER: [number, number] = [13.0827, 80.2707];

const HOTSPOTS = [
  { id: 'sector-4', name: 'Sector 4', coords: [13.0827, 80.2707] as [number, number], level: 'Critical' },
  { id: 't-nagar', name: 'T. Nagar', coords: [13.0405, 80.2337] as [number, number], level: 'High' },
  { id: 'velachery', name: 'Velachery', coords: [12.9800, 80.2200] as [number, number], level: 'Warning' },
  { id: 'anna-nagar', name: 'Anna Nagar', coords: [13.0850, 80.2100] as [number, number], level: 'Safe' },
];

// --- Custom Components ---

function MapController({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 1 });
  }, [center, zoom, map]);
  return null;
}

function HeatmapLayer({ data }: { data: [number, number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !data.length) return;
    // @ts-ignore
    const heat = L.heatLayer(data, { radius: 25, blur: 15, maxZoom: 17 }).addTo(map);
    return () => { map.removeLayer(heat); };
  }, [map, data]);
  return null;
}

function DroneSimulation({ from, to, duration = 10000 }: { from: [number, number], to: [number, number], duration?: number }) {
  const [pos, setPos] = useState<[number, number]>(from);

  useEffect(() => {
    let start: number | null = null;
    let animFrame: number;

    const animate = (time: number) => {
      if (!start) start = time;
      const progress = (time - start) / duration;

      if (progress < 1) {
        const lat = from[0] + (to[0] - from[0]) * progress;
        const lng = from[1] + (to[1] - from[1]) * progress;
        setPos([lat, lng]);
        animFrame = requestAnimationFrame(animate);
      } else {
        start = null;
        animFrame = requestAnimationFrame(animate);
      }
    };

    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [from, to, duration]);

  const droneIcon = L.divIcon({
    html: `<div class="relative">
      <div class="absolute -inset-2 bg-amber-400/20 rounded-full animate-ping"></div>
      <div class="bg-slate-900 p-1 rounded-lg border border-amber-400 shadow-lg shadow-amber-900/50">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c-2 2-3 3-5 5l-4-4 3-3 2 2 3-3-2-2 3-3 5 5-3 3z"/><path d="M7 11h.01"/><path d="M11 7h.01"/><path d="M10 10l.01.01"/></svg>
      </div>
    </div>`,
    className: '',
    iconSize: [20, 20],
  });

  return <Marker position={pos} icon={droneIcon} zIndexOffset={1000} />;
}

// ─── Map Legend ──────────────────────────────────────────────────────────────
function MapLegend() {
  return (
    <div className="bg-white/90 backdrop-blur-md rounded-xl border border-slate-200 p-3 shadow-lg pointer-events-auto">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Map Legend</h4>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-600 border border-white shadow-sm" />
          <span className="text-[10px] font-bold text-slate-600 uppercase">Critical Demand</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500 border border-white shadow-sm" />
          <span className="text-[10px] font-bold text-slate-600 uppercase">High Demand</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 border border-white shadow-sm" />
          <span className="text-[10px] font-bold text-slate-600 uppercase">Low/Medium Demand</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-600 border border-white shadow-sm" />
          <span className="text-[10px] font-bold text-slate-600 uppercase">Supply Hub</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500 border border-white shadow-sm" />
          <span className="text-[10px] font-bold text-slate-600 uppercase">Active Volunteer</span>
        </div>
        <div className="flex items-center gap-2 font-medium">
          <div className="w-3 h-0.5 bg-amber-400 border border-amber-400/50" />
          <span className="text-[10px] font-bold text-slate-400 uppercase italic">Supply Line</span>
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function SupplyMap() {
  const [demands, setDemands] = useState<ConsolidatedRequest[]>([]);
  const [supplies, setSupplies] = useState<SupplyPoint[]>([]);
  const [activeVolunteers, setActiveVolunteers] = useState<UserProfile[]>([]);
  const [activeDispatches, setActiveDispatches] = useState<Dispatch[]>([]);
  const [activeCenter, setActiveCenter] = useState<[number, number]>(CHENNAI_CENTER);
  const [activeZoom, setActiveZoom] = useState(12);
  const [isLive, setIsLive] = useState(false);
  
  // Layer Toggles
  const [layers, setLayers] = useState({
    demandHeatmap: true,
    supplyPoints: true,
    volunteerMarkers: true,
    floodZones: true,
    drones: true,
    sat: false,
    dark: true
  });

  const floodedZones: [number, number][][] = [
    [[13.0305, 80.2237], [13.0505, 80.2537], [13.0605, 80.2237], [13.0405, 80.2137]],
    [[13.0727, 80.2607], [13.0927, 80.2907], [13.1027, 80.2607], [13.0827, 80.2507]],
  ];

  useEffect(() => {
    try {
      const unsubD = onSnapshot(collection(db, 'consolidated'), (s) => {
        setDemands(s.docs.map(d => ({ id: d.id, ...d.data() } as ConsolidatedRequest)));
        setIsLive(true);
      });
      const unsubS = onSnapshot(collection(db, 'supply_points'), (s) => {
        setSupplies(s.docs.map(d => ({ id: d.id, ...d.data() } as SupplyPoint)));
      });
      const unsubV = onSnapshot(query(collection(db, 'users'), where('role', '==', 'volunteer')), (s) => {
        setActiveVolunteers(s.docs.map(d => d.data() as UserProfile).filter(v => v.location));
      });
      const unsubDisp = onSnapshot(query(collection(db, 'dispatches'), where('status', '==', 'in_transit')), (s) => {
        setActiveDispatches(s.docs.map(d => ({ id: d.id, ...d.data() } as Dispatch)));
      });

      return () => { unsubD(); unsubS(); unsubV(); unsubDisp(); };
    } catch (e) {}
  }, []);

  const heatmapData = useMemo(() => 
    demands.map(d => [d.lat, d.lng, Math.min(d.totalQuantity || 1, 500)] as [number, number, number]),
    [demands]
  );

  const getUrgencyColor = (u: string) => {
    if (u === 'critical') return 'bg-red-500';
    if (u === 'high') return 'bg-orange-500';
    return 'bg-blue-500';
  };

  const demandIcon = (id: string, urgency: string) => L.divIcon({
    html: `<div class="relative marker-demand-${id}">
      ${urgency === 'critical' ? `
        <div class="absolute -inset-4 bg-red-500/20 rounded-full animate-ping opacity-75"></div>
        <div class="absolute -inset-1.5 bg-red-600/40 rounded-full blur-[4px]"></div>
      ` : urgency === 'high' ? `
        <div class="absolute -inset-3 bg-amber-500/20 rounded-full animate-ping opacity-60"></div>
        <div class="absolute -inset-1.5 bg-amber-500/40 rounded-full blur-[2px]"></div>
      ` : `
        <div class="absolute -inset-2 bg-blue-500/10 rounded-full animate-ping opacity-40"></div>
      `}
      <div class="${
        urgency === 'critical' ? 'bg-red-600' :
        urgency === 'high' ? 'bg-amber-500' :
        'bg-blue-500'
      } w-4 h-4 rounded-full border-2 border-white shadow-2xl shadow-slate-900/50"></div>
    </div>`,
    className: '',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  const warehouseIcon = L.divIcon({
    html: `<div class="bg-blue-600 p-1.5 rounded-lg border-2 border-white shadow-xl ring-4 ring-blue-500/10">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7"/><path d="M4 21V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v17"/></svg>
    </div>`,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  const volunteerIcon = (photoURL?: string) => L.divIcon({
    html: `<div class="relative">
      <div class="absolute -inset-1 bg-emerald-400/40 rounded-full blur-[2px] animate-pulse"></div>
      <img src="${photoURL || 'https://ui-avatars.com/api/?background=10b981&color=fff'}" 
        class="w-6 h-6 rounded-full border-2 border-emerald-500 bg-white object-cover" />
    </div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  const tileUrl = layers.sat 
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : layers.dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full md:h-[calc(100vh-180px)]">
      {/* Left Sidebar: Command Center */}
      <div className="w-full md:w-72 flex flex-col gap-4">
        {/* Hotspot Navigator */}
        <div className="glass-panel-map rounded-2xl p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Target size={16} className="text-blue-500" />
              Strategic Nodes
            </h3>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Chennai</span>
          </div>
          <div className="space-y-2 overflow-y-auto custom-scrollbar pr-2">
            {HOTSPOTS.map(h => (
              <button
                key={h.id}
                onClick={() => { setActiveCenter(h.coords); setActiveZoom(15); }}
                className="w-full text-left p-3 rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">{h.name}</span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" />
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    h.level === 'Critical' ? 'bg-red-500' : h.level === 'High' ? 'bg-orange-500' : 'bg-emerald-500'
                  }`} />
                  <span className="text-[10px] font-medium text-slate-400 capitalize">{h.level} Priority</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Live Ticker */}
        <div className="command-bridge rounded-2xl p-4 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-2 text-blue-400">
            <Activity size={14} className="animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Global Field News</span>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2 overflow-hidden h-12">
            <div className="animate-marquee whitespace-nowrap text-[11px] text-slate-300 font-medium">
              🚨 New critical request in T. Nagar | 🚁 Drone dispatch successfully delivered to Sector 4 | 🗺️ {activeVolunteers.length} Volunteers actively moving in radius...
            </div>
          </div>
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xl min-h-[500px] md:min-h-0">
        <MapContainer
          key={`${layers.sat}-${layers.dark}`}
          center={activeCenter}
          zoom={activeZoom}
          className="h-full w-full"
          zoomControl={false}
        >
          <MapController center={activeCenter} zoom={activeZoom} />
          <TileLayer url={tileUrl} attribution="" />
          
          {layers.demandHeatmap && <HeatmapLayer data={heatmapData} />}
          
          {layers.floodZones && floodedZones.map((zone, i) => (
            <Polygon
              key={i}
              positions={zone}
              pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, dashArray: '8, 8', weight: 2 }}
            >
              <Popup>
                <p className="text-xs font-bold text-red-600">Flood Impact Zone</p>
              </Popup>
            </Polygon>
          ))}

          {/* Supply Lines for active dispatches */}
          {activeDispatches.map(d => {
            const target = demands.find(req => req.id === d.requestId);
            const source = supplies.find(s => s.id === d.supplyPointId);
            if (target && source) {
              return (
                <Polyline 
                  key={`line-${d.id}`}
                  positions={[[source.lat, source.lng], [target.lat, target.lng]]}
                  pathOptions={{ color: '#fbbf24', weight: 2, dashArray: '5, 10', opacity: 0.6 }}
                />
              );
            }
            return null;
          })}

          {layers.supplyPoints && supplies.map(s => (
            <Marker key={s.id} position={[s.lat, s.lng]} icon={warehouseIcon}>
              <Popup>
                <div className="min-w-[150px]">
                  <h4 className="text-xs font-bold text-slate-900">{s.name}</h4>
                  <p className="text-[10px] text-emerald-600 font-bold mb-2">Operational Hub</p>
                  {s.inventory?.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-[10px]">
                      <span className="text-slate-500">{item.item}</span>
                      <span className="font-bold">{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </Popup>
            </Marker>
          ))}

          {!layers.demandHeatmap && demands.map(d => (
            <Marker key={d.id} position={[d.lat, d.lng]} icon={demandIcon(d.id, d.urgency)}>
              <Popup>
                <div className="min-w-[150px]">
                  <div className="flex justify-between items-start">
                    <h4 className="text-xs font-black text-slate-900">{d.item}</h4>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                      d.urgency === 'critical' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                    }`}>{d.urgency}</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-700 mt-1">{d.totalQuantity} Units needed</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">{d.pinCode}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {layers.volunteerMarkers && activeVolunteers.map((v, i) => (
            <Marker key={i} position={[v.location!.lat, v.location!.lng]} icon={volunteerIcon(v.photoURL)}>
              <Popup>
                <div className="text-center">
                  <p className="text-xs font-black text-slate-900">{v.displayName}</p>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">Active Volunteer</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {layers.drones && supplies.map(s => {
            const target = demands.find(d => d.urgency === 'critical');
            if (target) {
              return <DroneSimulation key={`drone-${s.id}`} from={[s.lat, s.lng]} to={[target.lat, target.lng]} />;
            }
            return null;
          })}
        </MapContainer>

        {/* Floating Controls Overlay */}
        <div className="absolute top-5 right-5 z-[1000] flex flex-col gap-3">
          <div className="command-bridge rounded-2xl p-1.5 flex flex-col gap-1.5 shadow-2xl">
            <ControlButton active={layers.demandHeatmap} onClick={() => setLayers(l => ({ ...l, demandHeatmap: !l.demandHeatmap }))} icon={Target} title="Demand Heatmap" />
            <ControlButton active={layers.supplyPoints} onClick={() => setLayers(l => ({ ...l, supplyPoints: !l.supplyPoints }))} icon={Warehouse} title="Supply Points" />
            <ControlButton active={layers.volunteerMarkers} onClick={() => setLayers(l => ({ ...l, volunteerMarkers: !l.volunteerMarkers }))} icon={Users} title="Volunteers" />
            <ControlButton active={layers.floodZones} onClick={() => setLayers(l => ({ ...l, floodZones: !l.floodZones }))} icon={Droplets} title="Flood Zones" />
            <ControlButton active={layers.drones} onClick={() => setLayers(l => ({ ...l, drones: !l.drones }))} icon={Navigation} title="Live Drones" />
          </div>
          
          <div className="command-bridge rounded-2xl p-1.5 flex flex-col gap-1.5">
            <ControlButton active={layers.sat} onClick={() => setLayers(l => ({ ...l, sat: !l.sat, dark: !l.sat ? false : l.dark }))} icon={MapIcon} title="Satellite" />
            <ControlButton active={layers.dark} onClick={() => setLayers(l => ({ ...l, dark: !l.dark, sat: !l.dark ? false : l.sat }))} icon={Zap} title="Dark Mode" />
          </div>

          <div className="command-bridge rounded-2xl p-1.5">
            <button 
              onClick={() => { setActiveCenter(CHENNAI_CENTER); setActiveZoom(12); }}
              className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <Crosshair size={18} title="Recenter View" />
            </button>
          </div>
        </div>

        {/* Legend Overlay */}
        <div className="absolute bottom-5 left-5 z-[1000] hidden md:block">
          <MapLegend />
        </div>

        {/* Live Status Badge */}
        <div className="absolute bottom-5 right-5 z-[1000]">
          <div className={`glass-panel-map px-4 py-2 rounded-full border shadow-xl flex items-center gap-3 ${
            isLive ? 'border-emerald-200' : 'border-slate-100'
          }`}>
            <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            <span className="text-[10px] font-black text-slate-600 tracking-widest uppercase">
              ReliefGrid Field Mesh
            </span>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Live Updates</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlButton({ active, onClick, icon: Icon, title }: { active: boolean, onClick: () => void, icon: any, title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2.5 rounded-xl transition-all ${
        active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
      }`}
    >
      <Icon size={18} />
    </button>
  );
}
