import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { SafePerson } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, ShieldCheck, MapPin, Clock, Phone, Heart, AlertCircle, X, Users } from 'lucide-react';

// Demo data so the page isn't empty without Firebase
const DEMO_PEOPLE: SafePerson[] = [
  { id: 'demo1', name: 'Priya Shankar', age: 34, location: 'Anna Nagar Shelter, Block C', status: 'safe', contact: '+91 98400 12345', registeredAt: new Date().toISOString() },
  { id: 'demo2', name: 'Rajan Kumar', age: 67, location: 'St. John\'s School Camp', status: 'injured', contact: '+91 94400 67890', registeredAt: new Date(Date.now() - 3600000).toISOString(), lastSeen: 'Flood relief camp, T. Nagar' },
  { id: 'demo3', name: 'Meena & Family (5)', age: 28, location: 'Corporation Shelter 4', status: 'safe', contact: '+91 97890 11223', registeredAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'demo4', name: 'Arjun Selvam', age: 19, location: 'Unknown', status: 'missing', contact: '+91 90000 44556', registeredAt: new Date(Date.now() - 10800000).toISOString(), lastSeen: 'Last seen near Velachery subway, 6AM' },
];

const statusConfig = {
  safe:    { label: 'Safe & Sound',      bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700', icon: ShieldCheck },
  injured: { label: 'Needs Attention',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   iconBg: 'bg-amber-100',   iconColor: 'text-amber-700',   icon: Heart },
  missing: { label: 'Missing / Search',  bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     iconBg: 'bg-red-100',     iconColor: 'text-red-700',     icon: AlertCircle },
};

const inputClass = 'w-full rounded-md border border-slate-200 px-4 py-3 text-sm focus:border-slate-900 focus:outline-none transition-colors bg-white placeholder:text-slate-300';

export default function SafeRegistry() {
  const [people, setPeople] = useState<SafePerson[]>(DEMO_PEOPLE);
  const [isLive, setIsLive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '', age: '', location: '', status: 'safe' as 'safe' | 'injured' | 'missing', contact: '', lastSeen: ''
  });

  useEffect(() => {
    try {
      const q = query(collection(db, 'safe_registry'), orderBy('registeredAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.docs.length > 0) {
          setPeople(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafePerson)));
          setIsLive(true);
        }
      }, () => {});
      return () => unsubscribe();
    } catch (e) {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'safe_registry'), {
        ...formData,
        age: parseInt(formData.age),
        registeredAt: new Date().toISOString()
      });
      setShowAddForm(false);
      setFormData({ name: '', age: '', location: '', status: 'safe', contact: '', lastSeen: '' });
    } catch (err) {
      // Demo mode: add locally
      const newPerson: SafePerson = {
        id: `demo_${Date.now()}`,
        ...formData,
        age: parseInt(formData.age),
        registeredAt: new Date().toISOString()
      };
      setPeople(prev => [newPerson, ...prev]);
      setShowAddForm(false);
      setFormData({ name: '', age: '', location: '', status: 'safe', contact: '', lastSeen: '' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = people.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const counts = { safe: people.filter(p => p.status === 'safe').length, injured: people.filter(p => p.status === 'injured').length, missing: people.filter(p => p.status === 'missing').length };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Safe Registry</h2>
          <p className="text-xs text-slate-400 font-medium mt-1">Public status board for evacuated individuals and families</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-[0.98]"
        >
          <UserPlus size={15} />
          Register as Safe
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(counts).map(([status, count]) => {
          const cfg = statusConfig[status as keyof typeof statusConfig];
          return (
            <div key={status} className={`rounded-lg border ${cfg.border} ${cfg.bg} px-5 py-4 flex items-center gap-4`}>
              <div className={`h-9 w-9 rounded-md ${cfg.iconBg} ${cfg.iconColor} flex items-center justify-center`}>
                <cfg.icon size={18} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{count}</p>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${cfg.text}`}>{cfg.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          placeholder="Search by name or location..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm focus:border-slate-900 focus:outline-none transition-colors shadow-sm"
        />
      </div>

      {/* People grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Users size={48} className="mb-4 opacity-10" />
          <p className="text-sm font-medium">No records found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(person => {
            const cfg = statusConfig[person.status as keyof typeof statusConfig] || statusConfig.safe;
            return (
              <motion.div
                key={person.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-slate-200 bg-white p-6 hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-md ${cfg.iconBg} ${cfg.iconColor} flex items-center justify-center shrink-0`}>
                      <cfg.icon size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{person.name}, {person.age}</h4>
                      <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${cfg.border} ${cfg.text} ${cfg.bg} mt-0.5`}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] font-medium text-slate-400 flex items-center gap-1 shrink-0">
                    <Clock size={10} />
                    {new Date(person.registeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="space-y-1.5 text-xs text-slate-500">
                  <p className="flex items-center gap-2"><MapPin size={12} className="text-slate-300 shrink-0" />{person.location}</p>
                  <p className="flex items-center gap-2"><Phone size={12} className="text-slate-300 shrink-0" />{person.contact}</p>
                  {person.lastSeen && (
                    <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-50">Last seen: {person.lastSeen}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Person Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-7">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Register Person as Safe</h3>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">This will appear on the public status board</p>
                </div>
                <button
                  onClick={() => setShowAddForm(false)}
                  aria-label="Close"
                  title="Close"
                  className="p-2 hover:bg-slate-50 rounded-md transition-colors text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Priya Sharma" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Age</label>
                    <input required type="number" min="0" max="120" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} placeholder="e.g. 34" className={inputClass} />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Current Location / Shelter</label>
                  <input required type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="e.g. Anna Nagar Shelter, Block C" className={inputClass} />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value as any})}
                    title="Person status"
                    aria-label="Person status"
                    className={inputClass}
                  >
                    <option value="safe">✅ Safe &amp; Sound</option>
                    <option value="injured">⚠️ Injured / Needs Attention</option>
                    <option value="missing">🔴 Missing / Being Searched</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Contact Number</label>
                  <input required type="text" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} placeholder="+91 98400 XXXXX" className={inputClass} />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Last Seen <span className="normal-case font-normal text-slate-300">(optional)</span></label>
                  <textarea
                    value={formData.lastSeen}
                    onChange={e => setFormData({...formData, lastSeen: e.target.value})}
                    placeholder="e.g. Near Velachery bus stop at 6 AM"
                    className={`${inputClass} h-20 resize-none`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-md bg-slate-900 py-3.5 text-sm font-bold text-white hover:bg-slate-800 transition-all disabled:opacity-50 active:scale-[0.99]"
                >
                  {isSubmitting ? 'Registering...' : 'Confirm Registration'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
