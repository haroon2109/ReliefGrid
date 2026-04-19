import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  GoogleMap, 
  useJsApiLoader, 
  HeatmapLayer, 
  Marker, 
  InfoWindow 
} from '@react-google-maps/api';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  updateDoc, 
  doc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Request, SupplyPoint } from '../types';
import { 
  Shield, 
  Zap, 
  Map as MapIcon, 
  Activity, 
  CheckCircle, 
  Truck, 
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  LayoutDashboard
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const containerStyle = {
  width: '100%',
  height: '100%'
};

const center = {
  lat: 13.0827,
  lng: 80.2707 // Default to Chennai
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: [
    {
      "elementType": "geometry",
      "stylers": [{ "color": "#212121" }]
    },
    {
      "elementType": "labels.icon",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#757575" }]
    },
    {
      "elementType": "labels.text.stroke",
      "stylers": [{ "color": "#212121" }]
    },
    {
      "featureType": "administrative",
      "elementType": "geometry",
      "stylers": [{ "color": "#757575" }]
    },
    {
      "featureType": "water",
      "elementType": "geometry",
      "stylers": [{ "color": "#000000" }]
    },
    {
      "featureType": "road",
      "elementType": "geometry.fill",
      "stylers": [{ "color": "#2c2c2c" }]
    }
  ]
};

export default function CommandCenter() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [supplyPoints, setSupplyPoints] = useState<SupplyPoint[]>([]);
  const [isPredictive, setIsPredictive] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<any>(null);
  const [showCrisisSentinel, setShowCrisisSentinel] = useState(false);
  const [activeGaps, setActiveGaps] = useState<any[]>([]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: ['visualization']
  });

  // Real-time Listeners
  useEffect(() => {
    const q = query(
      collection(db, 'aid_requests'), 
      orderBy('processed_at', 'desc'), 
      limit(50)
    );
    const unsubReqs = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    const unsubSupply = onSnapshot(collection(db, 'supply_points'), (snapshot) => {
      setSupplyPoints(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplyPoint)));
    });

    return () => {
      unsubReqs();
      unsubSupply();
    };
  }, []);

  // Prepare Heatmap Data
  const heatmapData = useMemo(() => {
    if (!isLoaded || requests.length === 0) return [];
    return requests.map(req => {
      const lat = Number(req.extractedData?.lat) || 13.0827;
      const lng = Number(req.extractedData?.lng) || 80.2707;
      const urgency = Number(req.extractedData?.urgency) || 1;
      
      // Weight: Critical (5) gets highest weight for intense red
      return {
        location: new google.maps.LatLng(lat, lng),
        weight: urgency >= 4 ? 5 : urgency >= 3 ? 2 : 1
      };
    }).filter(p => !isNaN(p.location.lat()) && !isNaN(p.location.lng()));
  }, [requests, isLoaded]);

  const handleApprove = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'aid_requests', requestId), { status: 'approved' });
      await addDoc(collection(db, 'ledger'), {
        action: 'ALLOCATION_APPROVED',
        actorId: 'NGO_WORKER_01',
        resourceId: requestId,
        details: `Approved aid allocation for request ${requestId}`,
        timestamp: serverTimestamp(),
        hash: `0x${Math.random().toString(16).slice(2, 10)}`
      });
    } catch (e) {
      console.error('Approval failed:', e);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-80 border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl flex flex-col h-full shadow-2xl z-10 transition-all duration-500 ease-in-out">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]">
              <Shield className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tighter uppercase">ReliefGrid</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Command Center</p>
            </div>
          </div>

          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-all shadow-lg group">
              <span className="text-xs font-black uppercase tracking-tight">Approve Allocation</span>
              <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 transition-all text-slate-300">
              <span className="text-xs font-black uppercase tracking-tight">Dispatch Instructions</span>
              <Truck size={14} />
            </button>
          </div>
        </div>

        {/* Global Feed */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Live Ingestion Feed</h2>
            <Activity size={14} className="text-emerald-500 animate-pulse" />
          </div>
          
          <div className="space-y-4">
            {requests.slice(0, 8).map(req => (
              <div key={req.id} className="p-4 rounded-xl border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 transition-all group cursor-pointer relative overflow-hidden">
                {Number(req.extractedData?.urgency || 0) >= 4 && (
                   <div className="absolute top-0 left-0 h-full w-1 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                )}
                <div className="flex justify-between items-start mb-2">
                  <span className={cn(
                    "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                    Number(req.extractedData?.urgency) >= 4 ? "bg-red-500/20 text-red-500" : "bg-amber-500/20 text-amber-500"
                  )}>
                    {Number(req.extractedData?.urgency) >= 4 ? 'Critical' : 'Warning'}
                  </span>
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Just Now</span>
                </div>
                <p className="text-xs font-bold text-slate-200 line-clamp-1">{req.extractedData?.item || "Resource Request"}</p>
                <p className="text-[10px] text-slate-500 mt-1 font-medium">{req.extractedData?.location || "Unknown Location"}</p>
                
                <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleApprove(req.id)} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300">Quick Approve</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Crisis Sentinel Predictions */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/80 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Crisis Sentinel</p>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">Predictive Gap Analysis</p>
            </div>
            <button 
              onClick={() => setShowCrisisSentinel(!showCrisisSentinel)}
              className={cn(
                "h-6 w-11 rounded-full transition-all duration-300 relative border border-slate-800",
                showCrisisSentinel ? "bg-red-600" : "bg-slate-800"
              )}
            >
              <div className={cn(
                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-all duration-300 shadow-lg",
                showCrisisSentinel ? "translate-x-5" : "translate-x-0"
              )} />
            </button>
          </div>
          
          {showCrisisSentinel && (
            <div className="p-3 rounded-lg bg-red-950/20 border border-red-500/30">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={12} className="text-red-500 animate-pulse" />
                <span className="text-[9px] font-black text-red-300 uppercase tracking-tighter">Impact Gap Alert</span>
              </div>
              <p className="text-[10px] text-red-200/70 font-medium">Velachery: Critical supply isolation detected. Historical flood recurrence risk: High.</p>
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            <div>
              <p className="text-[10px] font-black text-slate-100 uppercase tracking-tight">Predictive Stockpiling</p>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">AI Forecasting enabled</p>
            </div>
            <button 
              onClick={() => setIsPredictive(!isPredictive)}
              className={cn(
                "h-6 w-11 rounded-full transition-all duration-300 relative border border-slate-800",
                isPredictive ? "bg-indigo-600" : "bg-slate-800"
              )}
            >
              <div className={cn(
                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-all duration-300 shadow-lg",
                isPredictive ? "translate-x-5" : "translate-x-0"
              )} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Map View */}
      <main className="flex-1 relative">
        {!isLoaded ? (
          <div className="h-full w-full flex items-center justify-center bg-slate-950">
             <div className="space-y-4 text-center">
               <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
               <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 animate-pulse">Initializing Geospatial Mesh...</p>
             </div>
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={12}
            options={mapOptions}
          >
            {/* Heatmap Layer */}
            <HeatmapLayer
              data={heatmapData}
              options={{
                radius: 40,
                opacity: 0.8,
                gradient: [
                  'rgba(0, 255, 255, 0)',
                  'rgba(0, 255, 255, 1)',
                  'rgba(0, 191, 255, 1)',
                  'rgba(0, 127, 255, 1)',
                  'rgba(0, 63, 255, 1)',
                  'rgba(0, 0, 255, 1)',
                  'rgba(0, 0, 223, 1)',
                  'rgba(0, 0, 191, 1)',
                  'rgba(0, 0, 159, 1)',
                  'rgba(0, 0, 127, 1)',
                  'rgba(63, 0, 91, 1)',
                  'rgba(127, 0, 63, 1)',
                  'rgba(191, 0, 31, 1)',
                  'rgba(255, 0, 0, 1)'
                ]
              }}
            />

            {/* Predictive Supply Points */}
            {isPredictive && supplyPoints.map(point => (
              <Marker
                key={point.id}
                position={{ lat: point.lat, lng: point.lng }}
                onClick={() => setSelectedPoint(point)}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: "#4f46e9",
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: "#ffffff",
                }}
              />
            ))}

            {selectedPoint && (
              <InfoWindow
                position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
                onCloseClick={() => setSelectedPoint(null)}
              >
                <div className="p-3 text-slate-900 bg-white">
                  <h3 className="text-xs font-black uppercase tracking-tight mb-2 border-b pb-1">{selectedPoint.name}</h3>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Inventory Saturation</p>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-indigo-600 w-[78%]" />
                    </div>
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}

        {/* Map Overlays */}
        <div className="absolute top-8 right-8 flex flex-col gap-4">
           <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 p-4 rounded-xl shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                 <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Real-time Demand Heat</span>
              </div>
              <div className="space-y-2">
                 <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <span>Critical Saturated</span>
                    <span className="text-red-500 font-black tracking-tight">{requests.filter(r => Number(r.extractedData?.urgency || 0) >= 4).length} Nodes</span>
                 </div>
                 <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 w-[65%]" />
                 </div>
              </div>
           </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-xl px-10 py-5 rounded-full border border-slate-700 shadow-2xl flex items-center gap-12">
           <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Critical Demand</span>
           </div>
           <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Warning Signal</span>
           </div>
           <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Supply Hubs</span>
           </div>
        </div>
      </main>
    </div>
  );
}
