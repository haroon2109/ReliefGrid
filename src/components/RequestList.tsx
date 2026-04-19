import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ConsolidatedRequest } from '../types';
import {
  Search, MapPin, Package, ChevronRight, Plus, X, Loader2,
  AlertCircle, CheckCircle2, Clock, Truck, LayoutList, BarChart2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DEMO_REQUESTS: ConsolidatedRequest[] = [
  { id: 'r1', item: 'Food Packets',      totalQuantity: 250, pinCode: '600017', lat: 13.0405, lng: 80.2337, urgency: 'critical',  status: 'open',            requests: ['src1','src2','src3'], lastUpdated: new Date().toISOString() },
  { id: 'r2', item: 'Insulin (Medical)', totalQuantity: 30,  pinCode: '600006', lat: 13.0878, lng: 80.2785, urgency: 'critical',  status: 'open',            requests: ['src4'],              lastUpdated: new Date(Date.now()-600000).toISOString() },
  { id: 'r3', item: 'Water Bottles',     totalQuantity: 500, pinCode: '600032', lat: 13.1203, lng: 80.2928, urgency: 'high',      status: 'open',            requests: ['src5','src6'],       lastUpdated: new Date(Date.now()-1800000).toISOString() },
  { id: 'r4', item: 'Medical Kits',      totalQuantity: 80,  pinCode: '600001', lat: 13.0827, lng: 80.2707, urgency: 'high',      status: 'in_transit',      requests: ['src7'],              lastUpdated: new Date(Date.now()-3600000).toISOString() },
  { id: 'r5', item: 'Blankets',          totalQuantity: 120, pinCode: '600020', lat: 13.0569, lng: 80.2425, urgency: 'medium',    status: 'open',            requests: ['src8','src9'],       lastUpdated: new Date(Date.now()-7200000).toISOString() },
  { id: 'r6', item: 'ORS Packets',       totalQuantity: 200, pinCode: '600042', lat: 12.9800, lng: 80.2200, urgency: 'medium',    status: 'partially_filled', requests: ['src10'],            lastUpdated: new Date(Date.now()-10800000).toISOString() },
];

const URGENCY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const STATUS_TABS = [
  { key: 'all',            label: 'All',             icon: <LayoutList size={14} /> },
  { key: 'open',           label: 'Open',            icon: <AlertCircle size={14} /> },
  { key: 'partially_filled', label: 'Partial',       icon: <BarChart2 size={14} /> },
  { key: 'in_transit',     label: 'In Transit',      icon: <Truck size={14} /> },
  { key: 'closed',         label: 'Closed',          icon: <CheckCircle2 size={14} /> },
];

function UrgencyBadge({ urgency }: { urgency: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-50 text-red-600 border-red-100',
    high: 'bg-orange-50 text-orange-600 border-orange-100',
    medium: 'bg-blue-50 text-blue-600 border-blue-100',
    low: 'bg-slate-50 text-slate-600 border-slate-100'
  };
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${styles[urgency?.toLowerCase()] || styles.low}`}>
      {urgency}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const conf: Record<string, string> = {
    open: 'bg-blue-500', partially_filled: 'bg-amber-500',
    in_transit: 'bg-purple-500', closed: 'bg-emerald-500'
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${conf[status] || 'bg-slate-300'}`} />;
}

// ─── Create Demand Form ────────────────────────────────────────────────────
function CreateDemandForm({ onClose }: { onClose: () => void }) {
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [contact, setContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'requests'), {
        source: 'manual',
        rawContent: `Manual demand: ${item} (${quantity}) at ${pinCode}`,
        extractedData: {
          item, quantity: parseInt(quantity), urgency,
          location: pinCode, pinCode,
          contact,
          lat: 13.0827 + (Math.random() - 0.5) * 0.15,
          lng: 80.2707 + (Math.random() - 0.5) * 0.15,
          value_inr: parseInt(quantity) * 50,
        },
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      // Also add to consolidated for map display
      await addDoc(collection(db, 'consolidated'), {
        item, totalQuantity: parseInt(quantity), urgency,
        pinCode, lat: 13.0827 + (Math.random() - 0.5) * 0.15,
        lng: 80.2707 + (Math.random() - 0.5) * 0.15,
        status: 'open', requests: [], lastUpdated: new Date().toISOString(),
      });
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      console.error(err);
      alert('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="rounded-2xl border-2 border-slate-900 bg-white p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">New Demand Request</h3>
          <p className="text-[10px] text-slate-400 font-bold mt-0.5">NGO worker creates a demand in the field</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors p-1.5 rounded-lg hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>

      {done ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <CheckCircle2 size={40} className="text-emerald-500" />
          <p className="text-sm font-black text-emerald-700">Demand created & pinned to map!</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Item Needed</label>
              <input type="text" required value={item} onChange={e => setItem(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-slate-900 focus:outline-none transition-colors"
                placeholder="e.g. Water Bottles, Rice Bags" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Quantity Needed</label>
              <input type="number" required min="1" value={quantity} onChange={e => setQuantity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-slate-900 focus:outline-none transition-colors"
                placeholder="e.g. 200" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">PIN Code / Area</label>
              <input type="text" required value={pinCode} onChange={e => setPinCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-slate-900 focus:outline-none transition-colors"
                placeholder="e.g. 600017" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Contact Number</label>
              <input type="tel" value={contact} onChange={e => setContact(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-slate-900 focus:outline-none transition-colors"
                placeholder="+91 98765 43210" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Urgency Level</label>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'critical'] as const).map(u => (
                <button key={u} type="button" onClick={() => setUrgency(u)}
                  className={`rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all border ${
                    urgency === u
                      ? u === 'critical' ? 'bg-red-500 text-white border-red-500'
                        : u === 'high' ? 'bg-orange-500 text-white border-orange-500'
                        : u === 'medium' ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'
                  }`}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={isSubmitting}
            className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-black text-white hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest">
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {isSubmitting ? 'Submitting…' : 'Create Demand'}
          </button>
        </form>
      )}
    </motion.div>
  );
}

// ─── Demand Summary Bar ────────────────────────────────────────────────────
function SummaryBar({ requests }: { requests: ConsolidatedRequest[] }) {
  const totals: Record<string, number> = {};
  requests.forEach(r => {
    totals[r.item] = (totals[r.item] || 0) + r.totalQuantity;
  });
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {top.map(([item, qty]) => (
        <div key={item} className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{item}</p>
          <p className="text-2xl font-black text-slate-900 mt-0.5">{qty.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 font-bold">units needed</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function RequestList() {
  const [requests, setRequests] = useState<ConsolidatedRequest[]>(DEMO_REQUESTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'pincode' | 'urgency'>('urgency');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    try {
      const q = query(collection(db, 'consolidated'), orderBy('lastUpdated', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        if (snap.docs.length > 0) {
          setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as ConsolidatedRequest)));
        }
      }, () => {});
      return () => unsub();
    } catch (e) {}
  }, []);

  const filtered = useMemo(() => {
    let r = requests.filter(req =>
      (req.item.toLowerCase().includes(searchTerm.toLowerCase()) || req.pinCode.includes(searchTerm)) &&
      (statusFilter === 'all' || req.status === statusFilter)
    );
    if (sortBy === 'pincode') r = [...r].sort((a, b) => a.pinCode.localeCompare(b.pinCode));
    if (sortBy === 'urgency') r = [...r].sort((a, b) => (URGENCY_ORDER[a.urgency] ?? 4) - (URGENCY_ORDER[b.urgency] ?? 4));
    return r;
  }, [requests, searchTerm, sortBy, statusFilter]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: requests.length };
    requests.forEach(r => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [requests]);

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Demand Center</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            Live field intelligence — {requests.length} active demands
          </p>
        </div>
        <button onClick={() => setShowCreate(s => !s)}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all shadow-lg ${showCreate ? 'bg-slate-200 text-slate-900' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'}`}>
          {showCreate ? <X size={16} /> : <Plus size={16} />}
          {showCreate ? 'Cancel' : 'New Demand'}
        </button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && <CreateDemandForm onClose={() => setShowCreate(false)} />}
      </AnimatePresence>

      {/* Summary bar */}
      <SummaryBar requests={requests} />

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto hide-scrollbar bg-slate-100 p-1 rounded-xl">
        {STATUS_TABS.map(tab => (
          <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${statusFilter === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>
            {tab.icon} {tab.label}
            <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-black ${statusFilter === tab.key ? 'bg-slate-100 text-slate-700' : 'bg-white/50 text-slate-400'}`}>
              {statusCounts[tab.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search + sort */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-full md:max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input type="text" placeholder="Search item or PIN…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-900 transition-colors"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          aria-label="Sort demands" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 outline-none cursor-pointer">
          <option value="urgency">Sort by Urgency</option>
          <option value="date">Sort by Date</option>
          <option value="pincode">Sort by PIN Code</option>
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Resource / Item</th>
              <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">How Much Needed</th>
              <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Location</th>
              <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Urgency</th>
              <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
              <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Sources</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center text-slate-300">
                  <Package size={40} className="mb-3 mx-auto opacity-30" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No demands match your filters</p>
                </td>
              </tr>
            ) : filtered.map(req => (
              <motion.tr key={req.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="group hover:bg-slate-50/70 transition-colors cursor-pointer">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      req.urgency === 'critical' ? 'bg-red-50 text-red-600' :
                      req.urgency === 'high' ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-500'
                    }`}>
                      <Package size={15} />
                    </div>
                    <p className="text-sm font-bold text-slate-900">{req.item}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-black text-slate-900">{req.totalQuantity.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 font-bold">units</p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <MapPin size={13} className="text-slate-400 shrink-0" />
                    <span className="text-sm font-bold">{req.pinCode}</span>
                  </div>
                </td>
                <td className="px-6 py-4"><UrgencyBadge urgency={req.urgency} /></td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <StatusDot status={req.status} />
                    <span className="text-xs font-bold text-slate-600 capitalize">{req.status.replace(/_/g, ' ')}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs font-black text-slate-400">{req.requests.length} src</span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map(req => (
          <motion.div key={req.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  req.urgency === 'critical' ? 'bg-red-50 text-red-600' :
                  req.urgency === 'high' ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-500'
                }`}>
                  <Package size={20} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900">{req.item}</h4>
                  <p className="text-[10px] text-slate-400 font-bold">{req.requests.length} source{req.requests.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <UrgencyBadge urgency={req.urgency} />
            </div>
            <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-50">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Needed</p>
                <p className="font-black text-slate-900">{req.totalQuantity.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Location</p>
                <p className="font-black text-slate-900 flex items-center gap-1"><MapPin size={11} /> {req.pinCode}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</p>
                <div className="flex items-center gap-1 mt-0.5"><StatusDot status={req.status} /><span className="text-[10px] font-black text-slate-600 capitalize">{req.status.replace(/_/g, ' ')}</span></div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
