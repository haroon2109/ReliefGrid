import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Dispatch, DispatchStatus } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import {
  Truck, CheckCircle2, Clock, MapPin, Package, Phone,
  ChevronDown, ChevronUp, AlertCircle, QrCode, X,
  ClipboardCheck, Archive, UserCheck
} from 'lucide-react';

// ─── 5-Stage pipeline ────────────────────────────────────────────────────────
type NormalizedStatus = 'placed' | 'packed' | 'ready_for_pickup' | 'in_transit' | 'delivered' | 'delayed';

function normalizeStatus(s: string): NormalizedStatus {
  if (s === 'preparing') return 'placed'; // backward compat
  return s as NormalizedStatus;
}

const STAGES: { key: NormalizedStatus; label: string; icon: React.ReactNode; short: string }[] = [
  { key: 'placed',           label: 'Order Placed',      short: 'Placed',   icon: <ClipboardCheck size={14} /> },
  { key: 'packed',           label: 'Packed',            short: 'Packed',   icon: <Archive size={14} /> },
  { key: 'ready_for_pickup', label: 'Ready for Pickup',  short: 'Ready',    icon: <UserCheck size={14} /> },
  { key: 'in_transit',       label: 'In Transit',        short: 'Transit',  icon: <Truck size={14} /> },
  { key: 'delivered',        label: 'Delivered',         short: 'Done',     icon: <CheckCircle2 size={14} /> },
];

const STAGE_INDEX: Record<string, number> = {
  placed: 0, preparing: 0, packed: 1, ready_for_pickup: 2, in_transit: 3, delivered: 4
};

const STATUS_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  placed:           { text: 'text-slate-600',    bg: 'bg-slate-50',    border: 'border-slate-200' },
  packed:           { text: 'text-blue-600',     bg: 'bg-blue-50',     border: 'border-blue-200' },
  ready_for_pickup: { text: 'text-purple-600',   bg: 'bg-purple-50',   border: 'border-purple-200' },
  in_transit:       { text: 'text-amber-600',    bg: 'bg-amber-50',    border: 'border-amber-200' },
  delivered:        { text: 'text-emerald-600',  bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  delayed:          { text: 'text-red-600',      bg: 'bg-red-50',      border: 'border-red-200' },
  preparing:        { text: 'text-slate-600',    bg: 'bg-slate-50',    border: 'border-slate-200' },
};

// ─── Demo data ───────────────────────────────────────────────────────────────
const DEMO_DISPATCHES: Dispatch[] = [
  { id: 'DSP-001', requestId: 'r1', supplyPointId: 's1', item: 'Food Packets', quantity: 250, from: 'Central Warehouse, Anna Nagar', to: 'T. Nagar Relief Camp', toPinCode: '600017', status: 'in_transit', driver: 'Ravi Kumar', driverContact: '+91 98400 12345', vehicle: 'TATA 407 • TN09BK2341', dispatchedAt: '2 hours ago', eta: '~20 min', progress: 70, urgency: 'critical' },
  { id: 'DSP-002', requestId: 'r2', supplyPointId: 's2', item: 'Insulin (Medical)', quantity: 30, from: 'South Hub, Tambaram', to: 'Sector 4 Medical Post', toPinCode: '600006', status: 'ready_for_pickup', driver: 'Anitha S', driverContact: '+91 99400 78901', vehicle: 'TVS Apache • TN22CD5678', dispatchedAt: '1 hour ago', eta: '~45 min', progress: 50, urgency: 'critical' },
  { id: 'DSP-003', requestId: 'r3', supplyPointId: 's1', item: 'Water Bottles', quantity: 500, from: 'Central Warehouse, Anna Nagar', to: 'Madhavaram Hub', toPinCode: '600060', status: 'packed', driver: 'Vijay M', driverContact: '+91 97400 23456', vehicle: 'Ashok Leyland • TN01AC9912', dispatchedAt: '30 min ago', eta: '~90 min', progress: 25, urgency: 'high' },
  { id: 'DSP-004', requestId: 'r4', supplyPointId: 's2', item: 'Medical Kits', quantity: 80, from: 'South Hub, Tambaram', to: 'Adyar Camp', toPinCode: '600020', status: 'delivered', driver: 'Priya D', driverContact: '+91 98765 43210', vehicle: 'Maruti Omni • TN45EF1234', dispatchedAt: '3 hours ago', deliveredAt: '1 hour ago', eta: 'Delivered', progress: 100, urgency: 'high' },
  { id: 'DSP-005', requestId: 'r5', supplyPointId: 's1', item: 'Blankets', quantity: 120, from: 'Central Warehouse, Anna Nagar', to: 'Velachery Flood Zone', toPinCode: '600042', status: 'delayed', driver: 'Manoj K', driverContact: '+91 95400 11122', vehicle: 'Force Tempo • TN06GH5566', dispatchedAt: '4 hours ago', eta: 'Delayed — Road blocked', progress: 35, urgency: 'high' },
  { id: 'DSP-006', requestId: 'r6', supplyPointId: 's1', item: 'ORS Packets', quantity: 200, from: 'Central Warehouse, Anna Nagar', to: 'Porur Distribution Point', toPinCode: '600116', status: 'placed', driver: 'TBD', driverContact: '—', vehicle: 'Pending', dispatchedAt: 'Just now', eta: 'Calculating…', progress: 5, urgency: 'medium' },
];

// ─── Stage Stepper ────────────────────────────────────────────────────────────
function StageStepper({ status }: { status: string }) {
  const norm = normalizeStatus(status);
  if (norm === 'delayed') {
    return (
      <div className="flex items-center gap-2 py-3">
        <AlertCircle size={16} className="text-red-500 shrink-0" />
        <span className="text-xs font-black text-red-600 uppercase tracking-widest">Delivery Delayed — Route blocked or vehicle issue</span>
      </div>
    );
  }

  const currentIdx = STAGE_INDEX[status] ?? 0;

  return (
    <div className="relative py-3 overflow-x-auto">
      <div className="flex items-center min-w-max gap-0">
        {STAGES.map((stage, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <React.Fragment key={stage.key}>
              {/* Step */}
              <div className={`flex flex-col items-center gap-1.5 ${active ? 'opacity-100' : done ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  done ? 'bg-emerald-500 border-emerald-500 text-white' :
                  active ? 'bg-slate-900 border-slate-900 text-white ring-4 ring-slate-900/10' :
                  'bg-white border-slate-200 text-slate-400'
                }`}>
                  {done ? <CheckCircle2 size={14} /> : stage.icon}
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${active ? 'text-slate-900' : done ? 'text-emerald-600' : 'text-slate-300'}`}>
                  {stage.short}
                </span>
              </div>
              {/* Connector */}
              {idx < STAGES.length - 1 && (
                <div className={`h-0.5 w-10 mx-1 transition-all ${idx < currentIdx ? 'bg-emerald-400' : 'bg-slate-100'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dispatch Card ────────────────────────────────────────────────────────────
function DispatchCard({ dispatch }: { dispatch: Dispatch }) {
  const [expanded, setExpanded] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const norm = normalizeStatus(dispatch.status as string);
  const col = STATUS_COLOR[dispatch.status] || STATUS_COLOR.placed;

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border-2 bg-white overflow-hidden transition-all ${col.border} shadow-sm hover:shadow-md`}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl ${col.bg} ${col.text} flex items-center justify-center shrink-0`}>
              <Package size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-black text-slate-900">{dispatch.item}</h4>
                <span className={`text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 rounded-full ${
                  dispatch.urgency === 'critical' ? 'bg-red-50 text-red-600 border-red-100' :
                  dispatch.urgency === 'high' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                  'bg-slate-50 text-slate-500 border-slate-100'
                }`}>{dispatch.urgency}</span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">{dispatch.id} · {dispatch.quantity} units</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${col.bg} ${col.text} border ${col.border}`}>
              {norm === 'ready_for_pickup' ? 'Ready' : norm.replace(/_/g, ' ')}
            </span>
            <button onClick={() => setShowQR(true)} title="Show Verification QR Code"
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-900">
              <QrCode size={16} />
            </button>
            <button onClick={() => setExpanded(!expanded)} title="Toggle Details"
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Route */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <MapPin size={12} className="text-slate-300 shrink-0" />
          <span className="truncate">{dispatch.from}</span>
          <span className="text-slate-300 shrink-0">→</span>
          <span className="font-black text-slate-700 truncate">{dispatch.to}</span>
          <span className="text-slate-300 shrink-0 hidden md:inline">({dispatch.toPinCode})</span>
        </div>

        {/* 5-Stage Stepper */}
        <StageStepper status={dispatch.status as string} />

        {/* Progress bar */}
        <div className="mt-2">
          <div className="flex justify-between text-[10px] font-black text-slate-400 mb-1.5">
            <span>{dispatch.status === 'delivered' ? `Delivered ${dispatch.deliveredAt ? 'at ' + dispatch.deliveredAt : ''}` : `ETA: ${dispatch.eta}`}</span>
            <span>{dispatch.progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${dispatch.progress}%` }} transition={{ duration: 1.2, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                norm === 'delivered' ? 'bg-emerald-500' :
                norm === 'delayed' ? 'bg-red-500' :
                norm === 'in_transit' ? 'bg-amber-500' :
                'bg-slate-400'
              }`} />
          </div>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Driver', value: dispatch.driver },
              { label: 'Contact', value: dispatch.driverContact },
              { label: 'Vehicle', value: dispatch.vehicle },
              { label: 'Dispatched', value: dispatch.dispatchedAt },
            ].map(d => (
              <div key={d.label}>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{d.label}</p>
                <p className="text-xs font-bold text-slate-700 mt-0.5">{d.value}</p>
              </div>
            ))}
            {dispatch.deliveredAt && (
              <div className="col-span-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Delivered At</p>
                <p className="text-xs font-bold text-emerald-700 mt-0.5">{dispatch.deliveredAt}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-6">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 max-w-xs w-full text-center shadow-2xl relative">
            <button onClick={() => setShowQR(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 p-1" title="Close QR">
              <X size={20} />
            </button>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-1">Delivery Verification</h3>
            <p className="text-[10px] text-slate-400 font-bold mb-5">Volunteer scans this to confirm receipt</p>
            <div className="bg-slate-50 p-5 rounded-2xl inline-block border-2 border-slate-100">
              <QRCodeSVG value={dispatch.id} size={160} />
            </div>
            <div className="mt-5 text-left space-y-2">
              <p className="text-[10px] font-black text-slate-900"><span className="text-slate-400 mr-1">ID:</span>{dispatch.id}</p>
              <p className="text-[10px] font-black text-slate-900"><span className="text-slate-400 mr-1">Item:</span>{dispatch.item} ({dispatch.quantity} units)</p>
              <p className="text-[10px] font-black text-slate-900"><span className="text-slate-400 mr-1">To:</span>{dispatch.to}</p>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function DispatchTracker() {
  const [dispatches, setDispatches] = useState<Dispatch[]>(DEMO_DISPATCHES);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const q = query(collection(db, 'dispatches'), orderBy('dispatchedAt', 'desc'), limit(30));
      const unsub = onSnapshot(q, snap => {
        if (snap.docs.length > 0) {
          setDispatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Dispatch)));
        }
        setLoading(false);
      });
      return () => unsub();
    } catch { setLoading(false); }
  }, []);

  const counts = {
    all: dispatches.length,
    placed: dispatches.filter(d => ['placed','preparing'].includes(d.status as string)).length,
    packed: dispatches.filter(d => d.status === 'packed').length,
    ready_for_pickup: dispatches.filter(d => d.status === 'ready_for_pickup').length,
    in_transit: dispatches.filter(d => d.status === 'in_transit').length,
    delivered: dispatches.filter(d => d.status === 'delivered').length,
    delayed: dispatches.filter(d => d.status === 'delayed').length,
  };

  const filtered = filter === 'all' ? dispatches :
    filter === 'placed' ? dispatches.filter(d => ['placed','preparing'].includes(d.status as string)) :
    dispatches.filter(d => d.status === filter);

  const FILTER_TABS = [
    { key: 'all',            label: 'All',               count: counts.all },
    { key: 'placed',         label: '📋 Placed',          count: counts.placed },
    { key: 'packed',         label: '📦 Packed',          count: counts.packed },
    { key: 'ready_for_pickup', label: '🚦 Ready',         count: counts.ready_for_pickup },
    { key: 'in_transit',     label: '🚛 In Transit',      count: counts.in_transit },
    { key: 'delivered',      label: '✅ Delivered',       count: counts.delivered },
    { key: 'delayed',        label: '⚠️ Delayed',         count: counts.delayed },
  ];

  const statsRow = [
    { label: 'Total', value: counts.all,        color: 'text-slate-900', icon: Package },
    { label: 'In Transit', value: counts.in_transit, color: 'text-amber-600', icon: Truck },
    { label: 'Delivered', value: counts.delivered,  color: 'text-emerald-600', icon: CheckCircle2 },
    { label: 'Delayed', value: counts.delayed,    color: 'text-red-600',     icon: AlertCircle },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Operations Tracker</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">5-Stage dispatch pipeline — real-time asset monitoring</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{counts.in_transit} active</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statsRow.map(stat => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <stat.icon size={14} className="text-slate-300" />
              <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap hide-scrollbar bg-slate-100 p-1 rounded-xl">
        {FILTER_TABS.map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>
            {tab.label}
            {tab.count > 0 && <span className="bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5 text-[9px] font-black">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="h-10 w-10 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">Syncing dispatch data…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-2xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">No dispatches in this stage</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(d => <DispatchCard key={d.id} dispatch={d} />)}
        </div>
      )}
    </div>
  );
}
