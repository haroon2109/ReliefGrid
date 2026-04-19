import React, { useState, useRef, useEffect } from 'react';
import { User, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile as UserProfileType } from '../types';
import { 
  User as UserIcon, 
  Camera, 
  Mail, 
  Shield, 
  CheckCircle2, 
  Loader2, 
  Save, 
  AlertCircle,
  Sparkles,
  Building2,
  Trophy,
  Target,
  BarChart3,
  Medal,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserProfileProps {
  user: User | null;
}

export default function UserProfile({ user }: UserProfileProps) {
  const [profileData, setProfileData] = useState<UserProfileType | null>(null);
  const [name, setName] = useState(user?.displayName || '');
  const [ngo, setNgo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user?.photoURL || null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      try {
        const docRef = doc(db, 'users', user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as UserProfileType;
          setProfileData(data);
          setName(data.displayName || user.displayName || '');
          setNgo(data.ngoAffiliation || '');
          setPreviewUrl(data.photoURL || user.photoURL || null);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setError("Image size must be less than 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      // 1. Update Firebase Auth Profile
      await updateProfile(user, {
        displayName: name,
        photoURL: previewUrl
      });

      // 2. Sync to Firestore
      const updateObj: any = {
        displayName: name,
        photoURL: previewUrl,
        ngoAffiliation: ngo,
        lastUpdated: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', user.uid), updateObj, { merge: true });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setError(err.message || "Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  // Mock stats if not present
  const stats = profileData?.monthlyStats || {
    tasksThisMonth: profileData?.tasksCompleted || 4,
    pointsThisMonth: (profileData?.impactPoints || 1280) % 500,
    rank: 88, // top 12%
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      {/* Profile Identity Header */}
      <div className="relative group flex flex-col items-center">
        <div className="relative">
          <div className="w-48 h-48 rounded-[3rem] overflow-hidden border-8 border-white shadow-2xl relative bg-slate-100 transform -rotate-3 group-hover:rotate-0 transition-transform duration-500">
            {previewUrl ? (
              <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <UserIcon size={72} />
              </div>
            )}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2"
            >
              <Camera size={24} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Upload Photo</span>
            </button>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border-4 border-white transform rotate-12">
            <Shield size={22} className="text-blue-400" />
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
        </div>
        
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 mb-3">
             <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Status</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{profileData?.displayName || 'Relief Agent'}</h2>
          <p className="text-slate-400 text-sm font-bold tracking-tight mt-1">{user?.email}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl shadow-slate-200 relative overflow-hidden group">
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-4">Cumulative Impact</p>
          <div className="flex items-end gap-2">
            <span className="text-5xl font-black tracking-tighter">{profileData?.impactPoints?.toLocaleString() || '1,280'}</span>
            <span className="text-xs font-bold text-slate-400 mb-2 uppercase">Pts</span>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Trophy size={80} />
          </div>
        </div>

        <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-8 shadow-xl shadow-slate-50 relative overflow-hidden group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Monthly Quota</p>
          <div className="flex items-end gap-2 text-slate-900">
            <span className="text-5xl font-black tracking-tighter">{stats.tasksThisMonth}</span>
            <span className="text-xs font-bold text-slate-400 mb-2 uppercase">Tasks</span>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity text-slate-900">
            <BarChart3 size={80} />
          </div>
        </div>

        <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-8 shadow-xl shadow-slate-50 relative overflow-hidden group">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-4">Agent Standing</p>
          <div className="flex items-end gap-2 text-slate-900">
            <span className="text-5xl font-black tracking-tighter">{stats.rank}%</span>
            <span className="text-xs font-bold text-slate-400 mb-2 uppercase">Global</span>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity text-slate-900">
            <Medal size={80} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Personal Details Form */}
        <div className="bg-white rounded-[2rem] p-10 border-2 border-slate-100 shadow-sm space-y-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-slate-100 rounded-xl">
              <UserIcon size={20} className="text-slate-900" />
            </div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Metadata Settings</h3>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Agent Signature (Name)</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Agent Name"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-slate-100 focus:border-slate-900 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NGO / Organization Affiliation</label>
              <div className="relative">
                <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="text" 
                  value={ngo}
                  onChange={(e) => setNgo(e.target.value)}
                  placeholder="e.g. Red Cross International"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-14 pr-5 py-4 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-slate-100 focus:border-slate-900 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2 opacity-60">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Node (Email)</label>
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="email" 
                  value={user?.email || ''} 
                  readOnly
                  className="w-full bg-slate-100 border border-slate-200 rounded-2xl pl-14 pr-5 py-4 text-sm font-bold text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 text-xs font-bold"
            >
              <AlertCircle size={16} />
              <p>{error}</p>
            </motion.div>
          )}

          <div className="pt-4">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className={`w-full py-5 rounded-[1.5rem] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-2xl active:scale-[0.97] disabled:opacity-50 ${
                saveSuccess 
                  ? 'bg-emerald-500 text-white shadow-emerald-200' 
                  : 'bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800'
              }`}
            >
              {isSaving ? (
                <Loader2 size={20} className="animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle2 size={20} />
              ) : (
                <Save size={20} />
              )}
              {isSaving ? 'Syncing...' : saveSuccess ? 'Identity Synced' : 'Update Agent Identity'}
            </button>
          </div>
        </div>

        {/* Verification & Badges Side */}
        <div className="space-y-8">
          <div className="bg-slate-900 rounded-[2rem] p-10 text-white shadow-2xl space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-blue-400 flex items-center gap-2">
              <Award size={18} />
              Field Certifications
            </h4>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                  <Shield size={24} />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-tight">Verified Responder</p>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">NGO Level 2 Auth</p>
                </div>
                <div className="ml-auto">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 opacity-50 grayscale">
                <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400">
                  <Sparkles size={24} />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-tight">Elite Coordinator</p>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">1500+ XP Required</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <p className="text-[10px] text-white/40 font-bold leading-relaxed">
                Your credentials are tied to the **ReliefGrid Unified Protocol**. 
                High trust scores enable priority access to drone deployment and medical dispatch assets.
              </p>
            </div>
          </div>

          <div className="bg-emerald-50 border-2 border-emerald-100 rounded-[2rem] p-8 flex gap-6 items-center">
            <div className="h-20 w-20 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm relative shrink-0">
               <Target size={40} />
               <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[8px] font-black px-2 py-1 rounded-full border-2 border-white shadow-lg">PRO</div>
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Active Contribution</p>
              <h4 className="text-xl font-black text-slate-900 tracking-tight mt-1">Tier 3 Response Lead</h4>
              <p className="text-xs text-emerald-600/70 font-bold mt-1 uppercase tracking-tight">Top 5% in Tamil Nadu Node</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
