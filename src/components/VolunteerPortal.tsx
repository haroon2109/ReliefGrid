import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, doc, onSnapshot, updateDoc, setDoc, getDoc, query, where, arrayUnion, increment, serverTimestamp, addDoc, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ConsolidatedRequest, UserProfile, TaskMatch, LeaderboardEntry } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { GoogleGenAI } from '@google/genai';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

L.Marker.prototype.options.icon = L.icon({
  iconUrl: markerIcon, iconRetinaUrl: markerIconRetina, shadowUrl: markerShadow,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

import {
  Trophy, MapPin, Package, CheckCircle2, AlertCircle, Shield, Zap, Heart,
  Truck, Stethoscope, Box, Dumbbell, Star, ChevronRight, Navigation,
  Mic, QrCode, ExternalLink, Wind, Loader2, MicOff, Bell, X, Clock,
  ThumbsDown, Medal, Crown, Flame
} from 'lucide-react';

const AVAILABLE_SKILLS = [
  { id: 'medical',   label: 'Medical Support',         icon: <Stethoscope size={18} /> },
  { id: 'logistics', label: 'Logistics/Trucking',      icon: <Truck size={18} /> },
  { id: 'heavy_lifting', label: 'Heavy Lifting',       icon: <Dumbbell size={18} /> },
  { id: 'distribution', label: 'Food/Water Distribution', icon: <Box size={18} /> },
  { id: 'tech',      label: 'Tech/Communication',      icon: <Zap size={18} /> },
];

const DECLINE_REASONS = [
  'Currently unavailable / off-duty',
  'Too far — outside my radius',
  'Vehicle breakdown',
  'Already on another mission',
  'Health reasons',
];

// ─── Ola/Uber-style Pop-up Modal ─────────────────────────────────────────────
function MissionAlert({
  match, task, onAccept, onDecline
}: {
  match: TaskMatch;
  task: ConsolidatedRequest;
  onAccept: () => void;
  onDecline: (reason: string) => void;
}) {
  const [countdown, setCountdown] = useState(30);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => {
      if (c <= 1) { clearInterval(t); onDecline('Timeout — no response'); return 0; }
      return c - 1;
    }), 1000);
    return () => clearInterval(t);
  }, []);

  const handleDecline = () => {
    if (!declineReason) return;
    onDecline(declineReason);
  };

  const urgencyColor = task.urgency === 'critical' ? '#ef4444' : task.urgency === 'high' ? '#f97316' : '#3b82f6';

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/80 backdrop-blur-sm">
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Top urgency stripe */}
        <div style={{ backgroundColor: urgencyColor }} className="h-2 w-full" />

        {/* Ring animation header */}
        <div className="relative bg-slate-900 px-6 pt-6 pb-8 text-white text-center overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            {[1, 2, 3].map(i => (
              <div key={i} style={{ animationDelay: `${i * 0.4}s` }}
                className="absolute rounded-full border-2 border-white animate-ping"
                style={{ width: `${i * 80}px`, height: `${i * 80}px`, animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
          <div className="relative z-10">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: urgencyColor }}>
              <Bell size={28} className="text-white animate-bounce" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight">New Mission Alert</h2>
            <p className="text-sm text-white/60 mt-1 font-bold">AI matched you to this demand</p>
            {/* Countdown */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <Clock size={14} className="text-white/60" />
              <span className={`text-2xl font-black tabular-nums ${countdown <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                {countdown}s
              </span>
              <span className="text-white/40 text-sm">to respond</span>
            </div>
            {/* Countdown bar */}
            <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <motion.div className="h-full bg-white rounded-full"
                initial={{ width: '100%' }} animate={{ width: `${(countdown / 30) * 100}%` }}
                transition={{ duration: 1, ease: 'linear' }} />
            </div>
          </div>
        </div>

        {/* Mission details */}
        <div className="p-6 space-y-4">
          <div className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{task.item}</h3>
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full text-white`}
                style={{ backgroundColor: urgencyColor }}>
                {task.urgency}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <div className="text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Distance</p>
                <p className="text-lg font-black text-slate-900">{match.distance.toFixed(1)}<span className="text-xs ml-0.5">km</span></p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quantity</p>
                <p className="text-lg font-black text-slate-900">{task.totalQuantity}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Match</p>
                <p className="text-lg font-black text-emerald-600">{Math.round(match.score)}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <MapPin size={12} className="text-slate-400 shrink-0" />
              <span className="text-xs font-bold text-slate-600">{task.pinCode}</span>
            </div>
            {match.reasoning && (
              <p className="text-[10px] text-slate-500 italic border-t border-slate-100 pt-2">{match.reasoning}</p>
            )}
          </div>

          {/* Point reward info */}
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5">
            <Trophy size={18} className="text-emerald-600 shrink-0" />
            <p className="text-xs font-black text-emerald-800">Accept → earn <span className="text-emerald-600">+100 Impact Points</span></p>
          </div>

          {!showDecline ? (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => setShowDecline(true)}
                className="rounded-2xl border-2 border-red-200 bg-white py-4 text-sm font-black text-red-500 hover:bg-red-50 transition-all uppercase tracking-widest flex items-center justify-center gap-2">
                <ThumbsDown size={18} /> Decline
              </button>
              <button onClick={onAccept}
                className="rounded-2xl bg-emerald-500 py-4 text-sm font-black text-white hover:bg-emerald-600 transition-all uppercase tracking-widest shadow-xl shadow-emerald-200 flex items-center justify-center gap-2">
                <CheckCircle2 size={18} /> Accept
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Select decline reason <span className="text-red-500">(required)</span>
              </p>
              {DECLINE_REASONS.map(r => (
                <button key={r} onClick={() => setDeclineReason(r)}
                  className={`w-full text-left text-xs rounded-xl border px-4 py-2.5 font-bold transition-all ${declineReason === r ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>
                  {r}
                </button>
              ))}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button onClick={() => setShowDecline(false)}
                  className="rounded-2xl border-2 border-slate-200 bg-white py-3 text-xs font-black text-slate-500 hover:bg-slate-50 transition-all uppercase">
                  Back
                </button>
                <button onClick={handleDecline} disabled={!declineReason}
                  className="rounded-2xl bg-red-500 py-3 text-xs font-black text-white hover:bg-red-600 transition-all uppercase disabled:opacity-40 shadow-lg shadow-red-200">
                  Confirm Decline (−10 pts)
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────
function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('impactPoints', 'desc'), limit(5));
    const unsub = onSnapshot(q, snap => {
      setEntries(snap.docs.map((d, i) => ({
        uid: d.id,
        displayName: d.data().displayName || 'Anonymous',
        photoURL: d.data().photoURL,
        impactPoints: d.data().impactPoints || 0,
        tasksCompleted: d.data().tasksCompleted || 0,
        rank: i + 1,
      })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  // If no Firestore data, show demo
  const demo: LeaderboardEntry[] = [
    { uid: '1', displayName: 'Ravi Kumar', impactPoints: 1450, tasksCompleted: 14, rank: 1 },
    { uid: '2', displayName: 'Anitha S', impactPoints: 1200, tasksCompleted: 12, rank: 2 },
    { uid: '3', displayName: 'Vijay M', impactPoints: 950, tasksCompleted: 9, rank: 3 },
    { uid: '4', displayName: 'Priya D', impactPoints: 800, tasksCompleted: 8, rank: 4 },
    { uid: '5', displayName: 'Manoj K', impactPoints: 650, tasksCompleted: 6, rank: 5 },
  ];
  const list = entries.length > 0 ? entries : demo;

  const rankIcon = (r: number) => {
    if (r === 1) return <Crown size={16} className="text-amber-500" />;
    if (r === 2) return <Medal size={16} className="text-slate-400" />;
    if (r === 3) return <Medal size={16} className="text-amber-700" />;
    return <span className="text-[10px] font-black text-slate-400">#{r}</span>;
  };

  return (
    <div className="rounded-2xl border-2 border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Flame size={16} className="text-amber-500" />
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Monthly Leaderboard</h3>
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-2">
          {list.map(e => (
            <div key={e.uid} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${e.rank === 1 ? 'bg-amber-50 border border-amber-100' : 'hover:bg-slate-50'}`}>
              <div className="w-6 flex justify-center">{rankIcon(e.rank)}</div>
              <img
                src={e.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(e.displayName)}&background=random&size=40`}
                alt={e.displayName}
                className="h-8 w-8 rounded-full border border-slate-100 object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-900 truncate">{e.displayName}</p>
                <p className="text-[10px] text-slate-400 font-bold">{e.tasksCompleted} missions</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-slate-900">{e.impactPoints.toLocaleString()}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase">pts</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[9px] text-center text-slate-300 font-bold mt-4 uppercase tracking-widest">
        Top volunteer rewarded at month end
      </p>
    </div>
  );
}

// ─── Badge Component ──────────────────────────────────────────────────────────
function Badge({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-3 transition-all ${active ? 'opacity-100' : 'opacity-15 grayscale'}`}>
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 shadow-sm transition-all ${active ? 'bg-slate-900 border-slate-900 text-white shadow-slate-200' : 'bg-white border-slate-100 text-slate-400'}`}>
        {icon}
      </div>
      <p className="text-[9px] font-black text-center text-slate-500 uppercase tracking-tighter">{label}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function VolunteerPortal() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tasks, setTasks] = useState<ConsolidatedRequest[]>([]);
  const [matches, setMatches] = useState<TaskMatch[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeMissionAlert, setActiveMissionAlert] = useState<{ match: TaskMatch; task: ConsolidatedRequest } | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Progress bar animation
  useEffect(() => {
    if (progressBarRef.current && profile) {
      const progress = (profile.impactPoints || 0) % 100;
      progressBarRef.current.style.width = `${progress}%`;
    }
  }, [profile]);

  // Demo fallback data
  useEffect(() => {
    const mockTasks: ConsolidatedRequest[] = [
      { id: 'mock-1', item: 'Medical Kits', totalQuantity: 50, pinCode: '600004', lat: 13.0330, lng: 80.2500, status: 'open', urgency: 'high', requests: [], lastUpdated: '' },
      { id: 'mock-2', item: 'Water Gallons', totalQuantity: 200, pinCode: '600017', lat: 13.0400, lng: 80.2300, status: 'open', urgency: 'medium', requests: [], lastUpdated: '' },
    ];
    const mockMatches: TaskMatch[] = [{
      id: 'match-mock-1', taskId: 'mock-1',
      volunteerId: auth.currentUser?.uid || 'demo-uid',
      score: 94.2, distance: 1.2, status: 'pending',
      reasoning: 'Medical Skill Match + 1.2km Proximity (Sector 4 Cluster)',
      matchedAt: new Date().toISOString(),
    }];

    const timer = setTimeout(() => {
      if (tasks.length === 0) setTasks(mockTasks);
      if (matches.length === 0) {
        setMatches(mockMatches);
        // Trigger Ola-style pop-up for first pending match
        const task = mockTasks.find(t => t.id === mockMatches[0].taskId);
        if (task && mockMatches[0].status === 'pending') {
          setActiveMissionAlert({ match: mockMatches[0], task });
        }
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [tasks.length, matches.length]);

  // QR Scanner
  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scanner.render(async (decoded: string) => {
        try {
          const matchRef = doc(db, 'task_matches', decoded);
          const snap = await getDoc(matchRef);
          if (snap.exists()) {
            await updateDoc(matchRef, { status: 'in_transit', inTransitAt: serverTimestamp() });
            alert('Handshake Verified! Task marked as In-Transit.');
          } else if (decoded.startsWith('match-mock')) {
            alert('[DEMO] Handshake Verified!');
          }
          setShowScanner(false);
        } catch { }
      }, () => {});
      return () => { scanner.clear().catch(() => {}); };
    }
  }, [showScanner]);

  // Voice report
  const handleVoiceReport = async () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech Recognition not supported. Use Chrome.'); return; }
    if (isRecording) { recognition?.stop(); setIsRecording(false); return; }
    const rec = new SR();
    rec.lang = 'en-IN'; rec.continuous = false; rec.interimResults = false;
    rec.onstart = () => setIsRecording(true);
    rec.onresult = async (e: any) => {
      const text = e.results[0][0].transcript;
      setVoiceProcessing(true);
      try {
        const ai = new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY });
        const res = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [{ role: 'user', parts: [{ text: `Extract JSON {item, quantity, urgency, location, pinCode, lat, lng} from: "${text}". Return ONLY JSON.` }] }]
        });
        const result = JSON.parse(res.text || '{}');
        await addDoc(collection(db, 'requests'), {
          source: 'voice', rawContent: text,
          extractedData: { ...result, volunteerId: auth.currentUser?.uid },
          status: 'pending', createdAt: serverTimestamp(),
        });
        alert(`Report filed: ${result.item} (${result.quantity}) at ${result.location}`);
      } catch { alert('Failed to process voice report.'); }
      finally { setVoiceProcessing(false); }
    };
    rec.onerror = () => setIsRecording(false);
    rec.onend = () => setIsRecording(false);
    rec.start();
    setRecognition(rec);
  };

  // Profile + tasks subscription
  useEffect(() => {
    const cu = auth.currentUser;
    if (!cu) { setLoading(false); return; }
    let active = true;
    const userRef = doc(db, 'users', cu.uid);

    const unsubProfile = onSnapshot(userRef, async snap => {
      if (!active) return;
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: cu.uid, email: cu.email, displayName: cu.displayName || 'Volunteer',
          role: 'volunteer', skills: [], radius: 10, impactPoints: 0,
          tasksCompleted: 0, trustScore: 50, location: { lat: 13.0827, lng: 80.2707 }
        });
      } else {
        setProfile(snap.data() as UserProfile);
        setLoading(false);
      }
    }, () => setLoading(false));

    const unsubTasks = onSnapshot(query(collection(db, 'consolidated'), where('status', '==', 'open')), snap => {
      if (!active) return;
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as ConsolidatedRequest)));
    });

    const unsubMatches = onSnapshot(
      query(collection(db, 'task_matches'), where('volunteerId', '==', cu.uid), where('status', '==', 'pending')),
      snap => {
        if (!active) return;
        const newMatches = snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskMatch));
        setMatches(newMatches);
        // Auto-trigger pop-up for first pending match
        if (newMatches.length > 0) {
          const task = tasks.find(t => t.id === newMatches[0].taskId);
          if (task) setActiveMissionAlert({ match: newMatches[0], task });
        }
      }
    );

    return () => { active = false; unsubProfile(); unsubTasks(); unsubMatches(); };
  }, []);

  const handleAccept = async (matchId: string) => {
    setActiveMissionAlert(null);
    if (matchId.startsWith('mock')) {
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'accepted' } : m));
      return;
    }
    try {
      await updateDoc(doc(db, 'task_matches', matchId), { status: 'accepted', acceptedAt: serverTimestamp() });
    } catch {
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'accepted' } : m));
    }
  };

  const handleDecline = async (matchId: string, reason: string) => {
    setActiveMissionAlert(null);
    const isTimeout = reason.startsWith('Timeout');
    if (matchId.startsWith('mock')) {
      setMatches(prev => prev.filter(m => m.id !== matchId));
      if (!isTimeout) alert('Mission declined. -10 points applied.');
      return;
    }
    try {
      await updateDoc(doc(db, 'task_matches', matchId), {
        status: 'declined', declinedReason: reason, declinedAt: serverTimestamp()
      });
      if (auth.currentUser && !isTimeout) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { impactPoints: increment(-10) });
      }
      if (!isTimeout) alert('Mission declined. -10 points applied.');
    } catch {
      setMatches(prev => prev.filter(m => m.id !== matchId));
    }
  };

  const handleCompleteTask = async (taskId: string, matchId?: string) => {
    if (!profile || !auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'consolidated', taskId), { status: 'closed', lastUpdated: serverTimestamp() });
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { impactPoints: increment(100), tasksCompleted: increment(1) });
      if (matchId) await updateDoc(doc(db, 'task_matches', matchId), { status: 'completed', completedAt: serverTimestamp() });
      alert('Mission Accomplished! +100 Impact Points 🏆');
    } catch {
      if (taskId.startsWith('mock')) {
        alert('[DEMO] Mission Accomplished! +100 Points');
        setTasks(tasks.filter(t => t.id !== taskId));
      }
    }
  };

  const matchedTaskDetails = useMemo(() =>
    matches.map(m => ({ match: m, task: tasks.find(t => t.id === m.taskId) })).filter(m => m.task),
    [matches, tasks]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-slate-900" size={32} />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 px-4 md:px-0">

      {/* Ola-style Mission Pop-up */}
      <AnimatePresence>
        {activeMissionAlert && (
          <MissionAlert
            match={activeMissionAlert.match}
            task={activeMissionAlert.task}
            onAccept={() => handleAccept(activeMissionAlert.match.id)}
            onDecline={(reason) => handleDecline(activeMissionAlert.match.id, reason)}
          />
        )}
      </AnimatePresence>

      {/* Profile Card */}
      <div className="rounded-2xl border-2 border-slate-100 bg-white p-8 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative group">
            <img
              src={profile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || 'User')}&background=random&size=120`}
              alt={profile?.displayName}
              className="h-24 w-24 rounded-full border-4 border-white shadow-xl object-cover" />
            <div className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center border-4 border-white shadow-lg">
              <Shield size={18} />
            </div>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{profile?.displayName}</h2>
            <div className="flex items-center justify-center md:justify-start gap-3 mt-1.5 flex-wrap">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {profile?.ngoAffiliation || 'Chennai Relief Unit'} · Tier {Math.floor((profile?.impactPoints || 0) / 100) + 1}
              </p>
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                TRUST: {profile?.trustScore || 0}%
              </span>
            </div>
            <div className="mt-5 flex flex-wrap justify-center md:justify-start gap-2">
              {profile?.skills?.map(skillId => (
                <span key={skillId} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white px-3 py-1.5 text-[9px] font-black uppercase tracking-widest">
                  {AVAILABLE_SKILLS.find(s => s.id === skillId)?.label}
                </span>
              ))}
              <button onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="text-[10px] font-black text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-[0.2em] px-2 py-1.5 rounded-lg hover:bg-slate-50">
                {isEditingProfile ? 'CLOSE EDIT' : 'EDIT PROFILE'}
              </button>
            </div>
          </div>
          {/* Mini stats */}
          <div className="flex gap-4 md:gap-6">
            <div className="text-center">
              <p className="text-3xl font-black text-slate-900">{profile?.impactPoints || 0}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Points</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-slate-900">{profile?.tasksCompleted || 0}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Missions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Panel */}
      <AnimatePresence>
        {isEditingProfile && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border-2 border-slate-900 bg-white p-8 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Field Skills</h3>
                <div className="grid grid-cols-1 gap-2">
                  {AVAILABLE_SKILLS.map(skill => (
                    <button key={skill.id} onClick={() => {
                      const cur = profile?.skills || [];
                      const updated = cur.includes(skill.id) ? cur.filter(s => s !== skill.id) : [...cur, skill.id];
                      if (auth.currentUser) updateDoc(doc(db, 'users', auth.currentUser.uid), { skills: updated });
                    }}
                      className={`flex items-center gap-3 rounded-xl p-4 transition-all border-2 ${profile?.skills?.includes(skill.id) ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                      {skill.icon}
                      <span className="text-[10px] font-black uppercase tracking-widest">{skill.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Config</h3>
                <div className="space-y-4 rounded-2xl bg-slate-50 p-5 border border-slate-100">
                  <div className="flex justify-between items-center">
                    <label htmlFor="radius-range" className="text-[10px] font-black uppercase text-slate-400">Active Radius</label>
                    <span className="text-2xl font-black text-slate-900">{profile?.radius || 10}<span className="text-xs ml-1 text-slate-400">KM</span></span>
                  </div>
                  <input id="radius-range" type="range" min="1" max="50" title="Active radius"
                    value={profile?.radius || 10}
                    onChange={e => { if (auth.currentUser) updateDoc(doc(db, 'users', auth.currentUser.uid), { radius: parseInt(e.target.value) }); }}
                    className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-slate-900" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">NGO Affiliation</label>
                  <input type="text" placeholder="e.g. Red Cross, UNICEF, Local NGO"
                    defaultValue={profile?.ngoAffiliation || ''}
                    onBlur={e => { if (auth.currentUser) updateDoc(doc(db, 'users', auth.currentUser.uid), { ngoAffiliation: e.target.value }); }}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-slate-900 focus:outline-none transition-colors" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-10">

          {/* Accepted missions (with QR + Navigate) */}
          {matchedTaskDetails.filter(m => m.match.status === 'accepted').length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Active Missions</h3>
              {matchedTaskDetails.filter(m => m.match.status === 'accepted').map(({ match, task }) => (
                <motion.div key={match.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl border-2 border-emerald-200 bg-white p-8 shadow-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-xl font-black text-slate-900 uppercase">{task?.item}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <MapPin size={12} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-500">{task?.pinCode} · {task?.totalQuantity} units · {match.distance.toFixed(1)}km away</span>
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-xl border-2 border-slate-100 shadow-sm">
                      <QRCodeSVG value={match.id} size={60} />
                    </div>
                  </div>
                  {match.reasoning && (
                    <p className="text-[10px] text-slate-400 italic mb-4">{match.reasoning}</p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${task?.lat},${task?.lng}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-[10px] font-black text-slate-900 hover:bg-slate-50 transition-all uppercase tracking-widest">
                      <ExternalLink size={14} /> Navigate
                    </a>
                    <button onClick={() => handleCompleteTask(task!.id, match.id)}
                      className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-[10px] font-black text-white hover:bg-emerald-600 transition-all uppercase tracking-widest shadow-lg shadow-emerald-100">
                      <CheckCircle2 size={14} /> Verify Drop-Off (+100pts)
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* General task list */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Open Relief Cluster</h3>
              <button onClick={() => setShowScanner(!showScanner)}
                className="flex items-center gap-2 rounded-lg border-2 border-slate-900 bg-white px-4 py-2 text-[10px] font-black text-slate-900 hover:bg-slate-50 transition-all">
                <QrCode size={14} /> {showScanner ? 'Close Scanner' : 'Scan Handshake'}
              </button>
            </div>

            {showScanner && (
              <div className="rounded-2xl border-2 border-slate-900 bg-slate-50 p-8 relative">
                <div id="qr-reader" className="w-full max-w-sm mx-auto rounded-xl overflow-hidden border-2 border-slate-900 bg-white" />
                <p className="text-center text-[10px] text-slate-500 mt-4 font-black uppercase tracking-widest animate-pulse">Scan QR Handshake Code…</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {tasks.filter(t => !matches.some(m => m.taskId === t.id)).map(task => (
                <div key={task.id}
                  className="rounded-xl border border-slate-100 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-md flex items-center gap-5">
                  <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <Package size={22} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-slate-900 uppercase tracking-tight">{task.item}</h4>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{task.pinCode} · QTY: {task.totalQuantity}</p>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                    task.urgency === 'critical' ? 'bg-red-50 text-red-600' :
                    task.urgency === 'high' ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-500'
                  }`}>{task.urgency}</span>
                </div>
              ))}
              {tasks.length === 0 && (
                <div className="py-16 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                  <Wind size={24} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Scanning collective nodes…</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Points panel */}
          <div className="rounded-2xl border-2 border-slate-900 bg-white p-8 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03]"><Trophy size={180} /></div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-8">Volunteer Intel</h3>
            <div className="text-center mb-8">
              <p className="text-6xl font-black text-slate-900">{profile?.impactPoints || 0}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Impact Points</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <p className="text-2xl font-black text-slate-900">{profile?.tasksCompleted || 0}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Missions</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <p className="text-2xl font-black text-slate-900">LVL {Math.floor((profile?.impactPoints || 0) / 100) + 1}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Tier</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest px-1 text-slate-900">
                <span className="text-slate-400">Next Tier</span>
                <span>{(profile?.impactPoints || 0) % 100} / 100 XP</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden p-0.5">
                <div ref={progressBarRef} className="h-full bg-slate-900 rounded-full transition-all duration-1000" style={{ width: `${(profile?.impactPoints || 0) % 100}%` }} />
              </div>
            </div>
          </div>

          {/* Voice Report */}
          <div className="rounded-2xl border-2 border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-5">Field Voice Report</h3>
            <button onClick={handleVoiceReport} disabled={voiceProcessing}
              className={`w-full flex flex-col items-center gap-5 rounded-2xl p-10 transition-all border-2 border-dashed relative ${isRecording ? 'bg-red-50 border-red-300 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-900 hover:bg-white hover:text-slate-900'}`}>
              <div className={`h-14 w-14 rounded-full flex items-center justify-center border-2 ${isRecording ? 'bg-red-500 border-red-400 text-white animate-pulse' : 'bg-white border-slate-100 text-slate-700 shadow-md'}`}>
                {voiceProcessing ? <Loader2 className="animate-spin h-7 w-7" /> : isRecording ? <MicOff size={28} /> : <Mic size={28} />}
              </div>
              <div className="text-center">
                <p className="text-xs font-black uppercase tracking-widest">{isRecording ? 'Recording… Tap to Stop' : 'Tap to Speak'}</p>
                <p className="text-[10px] font-black text-emerald-600 mt-2">Hindi • Tamil • English 🇮🇳</p>
              </div>
            </button>
          </div>

          {/* Badges */}
          <div className="rounded-2xl border-2 border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6">Validation Badges</h3>
            <div className="grid grid-cols-3 gap-6">
              <Badge icon={<Heart size={22} />} label="Rescue" active />
              <Badge icon={<Zap size={22} />} label="Flash" active={(profile?.tasksCompleted ?? 0) >= 5} />
              <Badge icon={<Shield size={22} />} label="Sentinel" active={(profile?.impactPoints ?? 0) >= 500} />
              <Badge icon={<Truck size={22} />} label="Logistics" active={profile?.skills?.includes('logistics')} />
              <Badge icon={<Stethoscope size={22} />} label="Medic" active={profile?.skills?.includes('medical')} />
              <Badge icon={<Trophy size={22} />} label="Elite" active={(profile?.impactPoints ?? 0) >= 1000} />
            </div>
          </div>

          {/* Leaderboard */}
          <Leaderboard />
        </div>
      </div>
    </div>
  );
}
