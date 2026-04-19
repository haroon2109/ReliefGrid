import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider, 
  signOut,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  sendEmailVerification
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, serverTimestamp, onSnapshot, collection, addDoc } from 'firebase/firestore';
import { Notification } from './types';


import { 
  LayoutDashboard, 
  Map as MapIcon, 
  Truck, 
  AlertCircle, 
  LogOut, 
  LogIn,
  Layers,
  Package,
  Plus,
  Mail,
  Phone,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  UserCircle,
  Heart,
  Globe,
  Users,
  X,
  Loader2,
  Menu,
  ChevronLeft,
  ChevronRight,
  Bot,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Bell,
  Clock
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import RequestList from './components/RequestList';
import SupplyMap from './components/SupplyMap';
import ReliefAssistant from './components/ReliefAssistant';
import AIDocumentIngestion from './components/AIDocumentIngestion';
import VolunteerPortal from './components/VolunteerPortal';
import SafeRegistry from './components/SafeRegistry';
import DispatchTracker from './components/DispatchTracker';
import UserProfile from './components/UserProfile';



class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          message = "You don't have permission to access this data. Please ensure your email is verified and you have the correct role.";
        }
      } catch (e) {
        message = this.state.error.message || message;
      }

      return (
        <div className="flex h-screen flex-col items-center justify-center bg-white p-4 text-center">
          <AlertCircle size={48} className="mb-4 text-slate-900" />
          <h1 className="text-xl font-bold text-slate-900">Application Error</h1>
          <p className="mt-2 text-slate-500 max-w-md">{message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 rounded-md bg-slate-900 px-6 py-2 font-bold text-white hover:bg-slate-800 transition-colors"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');


  const [error, setError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authMode, setAuthMode] = useState<'select' | 'email' | 'phone'>('select');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+91');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [verifying, setVerifying] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: '1', title: 'Critical Demand', message: 'T. Nagar: Urgent water shortage detected.', timestamp: 'Just now', type: 'critical', read: false },
    { id: '2', title: 'Drone Dispatched', message: 'RG-Drone #22 carrying Insulin to Sector 4.', timestamp: '12m ago', type: 'success', read: false },
    { id: '3', title: 'Field Report', message: 'New CSV ingestion: 45 units added to South Hub.', timestamp: '1h ago', type: 'info', read: true },
  ]);
  const [showNotifications, setShowNotifications] = useState(false);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log('Auth state changed:', u?.email || 'No user');
      setUser(u);
      setLoading(false);
    }, (err) => {
      console.error('Auth error:', err);
      setError(err.message);
      setLoading(false);
    });
    
    // Safety timeout
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Auth state check timed out');
        setLoading(false);
      }
    }, 8000);


    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);


  const [profileData, setProfileData] = useState<{ displayName: string | null, photoURL: string | null, role: string } | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => {};
    
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      unsubscribe = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setProfileData({
            displayName: data.displayName || user.displayName,
            photoURL: data.photoURL || user.photoURL,
            role: data.role || 'staff'
          });
        } else {
          setProfileData({
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: 'staff'
          });
        }
      });
    } else {
      setProfileData(null);
    }

    return () => unsubscribe();
  }, [user]);



  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white p-4 text-center">
        <AlertCircle size={48} className="mb-4 text-slate-900" />
        <h1 className="text-xl font-bold text-slate-900">Initialization Error</h1>
        <p className="mt-2 text-slate-500 max-w-md">{error}</p>
        <p className="mt-4 text-sm text-slate-400">Please check your Firebase configuration in firebase-applet-config.json</p>
      </div>
    );
  }

  const login = async () => {
    setLoginError(null);
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      handleAuthError(error);
      setIsLoggingIn(false);
    }
  };

  const handleAuthError = (error: any) => {
    console.error('Auth failed:', error);
    let msg = error.message || 'Authentication failed. Please try again.';
    if (error.code === 'auth/popup-blocked') {
      msg = 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
    } else if (error.code === 'auth/unauthorized-domain') {
      msg = 'This domain is not authorized in Firebase. Please add this URL to "Authorized Domains" in Firebase Console.';
    } else if (error.code === 'auth/popup-closed-by-user') {
      msg = 'Sign-in was cancelled. If you didn\'t close the popup, your browser might be blocking third-party cookies or the iframe communication.';
    } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      msg = 'Invalid email or password.';
    } else if (error.code === 'auth/email-already-in-use') {
      msg = 'This email is already registered.';
    } else if (error.code === 'auth/invalid-phone-number') {
      msg = 'Please enter a valid phone number (e.g., +919876543210).';
    }
    setLoginError(msg);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Automatically send verification email for new registrations
        if (userCredential.user) {
          await sendEmailVerification(userCredential.user);
          console.log('Verification email sent to:', userCredential.user.email);
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      handleAuthError(error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible'
      });
    }
  };

  const handlePhoneSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    const digits = phoneNumber.replace(/\D/g, '');
    const formatted = digits.startsWith('91') ? `+${digits}` : `+91${digits}`;
    try {
      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, formatted, appVerifier);
      setConfirmationResult(result);
    } catch (error: any) {
      handleAuthError(error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      await confirmationResult.confirm(verificationCode);
    } catch (error: any) {
      handleAuthError(error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = () => signOut(auth);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-8 w-8 border-2 border-slate-900 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white p-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-10"
        >
          <div className="mb-10 flex flex-col items-center text-center">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-md bg-slate-900 text-white">
              <Layers size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">ReliefGrid</h1>
            <p className="mt-2 text-slate-500 text-sm">Smart Resource Allocation for Indian NGOs</p>
          </div>
          
          <div className="flex bg-slate-50 p-1 rounded-xl mb-8">
            <button 
              onClick={() => { setIsRegistering(false); setAuthMode('email'); }}
              className={`flex-1 py-3 text-[10px] font-black tracking-widest rounded-lg transition-all ${!isRegistering && authMode === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600 font-bold'}`}
            >
              LOGIN
            </button>
            <button 
              onClick={() => { setIsRegistering(true); setAuthMode('email'); }}
              className={`flex-1 py-3 text-[10px] font-black tracking-widest rounded-lg transition-all ${isRegistering && authMode === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600 font-bold'}`}
            >
              REGISTER
            </button>
          </div>

          <AnimatePresence mode="wait">
            {authMode === 'select' && (
              <motion.div 
                key="select"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-3"
              >
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest"><span className="bg-white px-4 text-slate-300">Quick Access</span></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={login}
                    disabled={isLoggingIn}
                    title="Sign in with Google"
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98]"
                  >
                    <Globe size={16} /> Google
                  </button>
                  <button
                    onClick={() => setAuthMode('phone')}
                    title="Sign in with Phone"
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98]"
                  >
                    <Phone size={16} /> Phone
                  </button>
                </div>
              </motion.div>
            )}

            {authMode === 'email' && (
              <motion.div 
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <button 
                  onClick={() => { setAuthMode('select'); setLoginError(null); }}
                  className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
                <h2 className="mb-6 text-xl font-bold text-slate-900">
                  {isRegistering ? 'Create Account' : 'Sign In'}
                </h2>
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Email Address</label>
                    <input 
                      type="email" 
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-md border border-slate-200 px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-0 transition-colors"
                      placeholder="name@ngo.org"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Password</label>
                    <input 
                      type="password" 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-md border border-slate-200 px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-0 transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full rounded-md bg-slate-900 py-3.5 text-sm font-bold text-white hover:bg-slate-800 transition-all disabled:opacity-50"
                  >
                    {isLoggingIn ? 'Processing...' : (isRegistering ? 'Register' : 'Sign In')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRegistering(!isRegistering)}
                    className="w-full text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    {isRegistering ? 'Already have an account? Sign In' : 'Need an account? Register'}
                  </button>
                </form>
              </motion.div>
            )}

            {authMode === 'phone' && (
              <motion.div 
                key="phone"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <button 
                  onClick={() => { setAuthMode('select'); setLoginError(null); setConfirmationResult(null); }}
                  className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
                <h2 className="mb-6 text-xl font-bold text-slate-900">Phone Authentication</h2>
                
                {!confirmationResult ? (
                  <form onSubmit={handlePhoneSignIn} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Phone Number</label>
                      <div className="flex items-center gap-2 rounded-md border border-slate-200 px-4 py-3 text-sm focus-within:border-slate-900 transition-colors">
                        <span className="text-slate-500 font-semibold shrink-0">+91</span>
                        <div className="w-px h-4 bg-slate-200" />
                        <input 
                          type="tel" 
                          required
                          maxLength={10}
                          pattern="[0-9]{10}"
                          value={phoneNumber.replace(/^\+?91/, '')}
                          onChange={(e) => setPhoneNumber('+91' + e.target.value.replace(/\D/g, '').slice(0, 10))}
                          className="flex-1 outline-none bg-transparent placeholder:text-slate-400"
                          placeholder="98765 43210"
                        />
                      </div>
                      <p className="mt-1.5 text-[10px] text-slate-400">Enter your 10-digit mobile number</p>
                    </div>
                    <div id="recaptcha-container"></div>
                    <button
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full rounded-md bg-slate-900 py-3.5 text-sm font-bold text-white hover:bg-slate-800 transition-all disabled:opacity-50"
                    >
                      {isLoggingIn ? 'Sending Code...' : 'Send Verification Code'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyCode} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Verification Code</label>
                      <input 
                        type="text" 
                        required
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-0 transition-colors"
                        placeholder="123456"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full rounded-md bg-slate-900 py-3.5 text-sm font-bold text-white hover:bg-slate-800 transition-all disabled:opacity-50"
                    >
                      {isLoggingIn ? 'Verifying...' : 'Verify & Sign In'}
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {loginError && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p>{loginError}</p>
              </div>
            </motion.div>
          )}
          <p className="mt-6 text-center text-xs text-slate-400">
            Authorized NGO Personnel Only
          </p>
          
        </motion.div>
      </div>
    );
  }

  const resendVerification = async () => {
    if (user && !user.emailVerified) {
      setResending(true);
      setResendStatus('idle');
      try {
        await sendEmailVerification(user);
        setResendStatus('success');
        setTimeout(() => setResendStatus('idle'), 5000);
      } catch (error: any) {
        console.error('Failed to resend:', error);
        setResendStatus('error');
        // If it's a too-many-requests error, let the user know
        if (error.code === 'auth/too-many-requests') {
          alert("Too many requests. Please wait a few minutes before trying again.");
        }
      } finally {
        setResending(false);
      }
    }
  };

  const checkVerification = async () => {
    if (!user) return;
    setVerifying(true);
    try {
      await user.reload();
      const updatedUser = auth.currentUser;
      if (updatedUser?.emailVerified) {
        setUser({ ...updatedUser } as User);
      } else {
        alert("Email still not verified. Please check your inbox.");
      }
    } catch (error) {
      console.error('Failed to reload user:', error);
    } finally {
      setVerifying(false);
    }
  };

  if (user && user.email && !user.emailVerified) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-3xl bg-white p-10 shadow-2xl text-center border border-slate-100"
        >
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-inner">
            <Mail size={48} className="animate-pulse" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Verify Your Email</h2>
          <p className="mt-6 text-slate-600 leading-relaxed text-lg">
            We've sent a secure link to <br/>
            <span className="font-bold text-blue-600">{user.email}</span>
          </p>
          <p className="mt-4 text-sm text-slate-400">
            Please check your inbox (and <b>spam folder</b>) to activate your ReliefGrid account.
          </p>
          
          <div className="mt-6 rounded-xl bg-amber-50 p-4 text-left border border-amber-100">
            <div className="flex gap-3">
              <AlertCircle className="text-amber-500 shrink-0" size={20} />
              <div>
                <p className="text-xs font-bold text-amber-900">Still no email?</p>
                <ul className="mt-1 text-[10px] text-amber-700 list-disc pl-4 space-y-1">
                  <li>Double check for typos in your email address.</li>
                  <li>Wait 2-5 minutes as some providers are slow.</li>
                  <li>Ensure your inbox isn't full.</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="mt-10 space-y-4">
            <button 
              onClick={checkVerification}
              disabled={verifying}
              className="w-full rounded-2xl bg-blue-600 px-6 py-5 font-bold text-white shadow-xl shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {verifying ? (
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="h-5 w-5 border-2 border-white border-t-transparent rounded-full"
                />
              ) : <ShieldCheck size={20} />}
              {verifying ? 'Checking Status...' : "I've Verified My Email"}
            </button>
            
            <button 
              onClick={resendVerification}
              disabled={resending}
              className={`w-full rounded-2xl border px-6 py-5 font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-3 ${
                resendStatus === 'success' 
                  ? 'border-green-200 bg-green-50 text-green-600' 
                  : resendStatus === 'error'
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {resending ? (
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="h-5 w-5 border-2 border-current border-t-transparent rounded-full"
                />
              ) : <RefreshCw size={20} />}
              {resending ? 'Resending...' : 
               resendStatus === 'success' ? 'Verification Sent!' :
               resendStatus === 'error' ? 'Failed to Resend' :
               'Resend Verification Email'}
            </button>

            <div className="pt-4">
              <button 
                onClick={logout}
                className="w-full rounded-2xl border border-transparent px-6 py-2 font-bold text-slate-400 hover:text-slate-600 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <LogOut size={16} />
                Sign Out & Try Different Email
              </button>
            </div>
          </div>

          <button 
            onClick={logout}
            className="mt-8 flex items-center justify-center gap-2 mx-auto text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
          >
            <LogOut size={16} />
            Sign Out and Try Another Account
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-slate-50/30 overflow-hidden font-sans">
        {/* Sidebar */}
        <motion.aside 
          initial={false}
          animate={{ width: isSidebarCollapsed ? 80 : 280 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative z-20 hidden md:flex flex-col border-r border-slate-200 bg-white/80 backdrop-blur-xl"
        >
          {/* Sidebar Header */}
          <div className={`flex items-center p-6 mb-8 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow-lg">
                  <Layers size={18} />
                </div>
                <span className="text-lg font-bold tracking-tight text-slate-900">ReliefGrid</span>
              </div>
            )}
            {isSidebarCollapsed && (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-lg">
                <Layers size={20} />
              </div>
            )}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="absolute -right-3 top-8 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-slate-900 transition-colors z-30"
            >
              {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
            <NavItem 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')}
              icon={<LayoutDashboard size={18} />}
              label={isSidebarCollapsed ? "" : "Dashboard"}
              collapsed={isSidebarCollapsed}
            />
            <NavItem 
              active={activeTab === 'requests'} 
              onClick={() => setActiveTab('requests')}
              icon={<AlertCircle size={18} />}
              label={isSidebarCollapsed ? "" : "Demands Center"}
              collapsed={isSidebarCollapsed}
              badge={notifications.filter(n => !n.read && n.type === 'critical').length || undefined}
            />
            <NavItem 
              active={activeTab === 'map'} 
              onClick={() => setActiveTab('map')}
              icon={<MapIcon size={18} />}
              label={isSidebarCollapsed ? "" : "Supply Map"}
              collapsed={isSidebarCollapsed}
            />
            <NavItem 
              active={activeTab === 'dispatches'} 
              onClick={() => setActiveTab('dispatches')}
              icon={<Truck size={18} />}
              label={isSidebarCollapsed ? "" : "Dispatches"}
              collapsed={isSidebarCollapsed}
            />
            
            <div className={`pt-6 pb-2 ${isSidebarCollapsed ? 'flex justify-center' : 'px-3'}`}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {isSidebarCollapsed ? "AI" : "Advanced AI"}
              </p>
            </div>
            
            <NavItem 
              active={activeTab === 'ai_ingestion'} 
              onClick={() => setActiveTab('ai_ingestion')}
              icon={<Sparkles size={18} />}
              label={isSidebarCollapsed ? "" : "AI Ingestion"}
              collapsed={isSidebarCollapsed}
            />
            <NavItem 
              active={activeTab === 'volunteer'} 
              onClick={() => setActiveTab('volunteer')}
              icon={<UserCircle size={18} />}
              label={isSidebarCollapsed ? "" : "Volunteer Portal"}
              collapsed={isSidebarCollapsed}
            />
            <NavItem 
              active={activeTab === 'safe_registry'} 
              onClick={() => setActiveTab('safe_registry')}
              icon={<Heart size={18} />}
              label={isSidebarCollapsed ? "" : "Safe Registry"}
              collapsed={isSidebarCollapsed}
            />
          </nav>

          <div className="mt-auto p-4 border-t border-slate-100">
            <div 
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-3 mb-6 cursor-pointer group ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Edit Profile"
            >
              <div className="relative">
                <img 
                  src={profileData?.photoURL || `https://ui-avatars.com/api/?name=${profileData?.displayName || 'User'}`} 
                  alt={profileData?.displayName || 'User'} 
                  className="h-8 w-8 rounded-full border border-slate-200 group-hover:border-blue-400 transition-colors object-cover"
                />

                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus size={8} className="text-blue-600" />
                </div>
              </div>
              {!isSidebarCollapsed && (
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors uppercase tracking-tight">{profileData?.displayName || 'Relief Worker'}</p>
                </div>
              )}
            </div>

            <button 
              onClick={logout}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 hover:bg-slate-50 hover:text-red-600 transition-all ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <LogOut size={16} />
              {!isSidebarCollapsed && "Sign Out"}
            </button>
          </div>
        </motion.aside>

        {/* Main Content Area */}
        <div className="main-content-layout">
          {/* Mobile Header */}
          <header className="md:hidden sticky top-0 z-20 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-900 text-white shadow-md">
                <Layers size={14} />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-900 uppercase">ReliefGrid</span>
            </div>
            <div className="flex items-center gap-3">
               <button onClick={() => setActiveTab('profile')} className="relative">
                 <img 
                   src={profileData?.photoURL || `https://ui-avatars.com/api/?name=${profileData?.displayName || 'User'}`} 
                   alt="User" 
                   className="h-7 w-7 rounded-full border border-slate-200"
                 />
               </button>
            </div>
          </header>

          {/* Desktop Header */}
          <header className={`hidden md:flex sticky top-0 z-10 border-b border-slate-200 bg-white/70 backdrop-blur-xl px-8 py-4 items-center justify-between`}>
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">{activeTab.replace('_', ' ')}</h2>
            </div>
            <div className="flex items-center gap-3">
               <button 
                 onClick={() => setIsChatOpen(!isChatOpen)}
                 className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${isChatOpen ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
               >
                 <Bot size={16} />
                 AI Assistant
               </button>
               <div className="h-4 w-px bg-slate-200 mx-1" />
                <div className="relative">
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    title="Notifications" 
                    className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all shadow-sm relative ${showNotifications ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white'}`}
                  >
                    <Bell size={18} />
                    {notifications.length > 0 && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 border-2 border-white" />}
                  </button>

                  <AnimatePresence>
                    {showNotifications && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-4 w-80 rounded-2xl border-2 border-slate-900 bg-white shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <Clock size={14} className="text-slate-400" />
                             <span className="text-[10px] font-black uppercase tracking-widest">Incident History</span>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setNotifications([]); }}
                            className="text-[9px] font-black uppercase tracking-widest bg-white/10 hover:bg-red-500 px-2 py-1 rounded-md transition-colors"
                          >
                            Clear All
                          </button>
                        </div>
                        <div className="max-h-96 overflow-y-auto custom-scrollbar">
                          {notifications.length > 0 ? (
                            notifications.map(n => (
                              <div key={n.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors group cursor-default">
                                <div className="flex items-center gap-2 mb-1">
                                  {n.type === 'critical' && <div className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                                  {n.type === 'success' && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                                  {n.type === 'info' && <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                                  <span className="text-[10px] font-black uppercase tracking-tighter text-slate-900">{n.title}</span>
                                  <span className="ml-auto text-[8px] font-bold text-slate-300 uppercase">{n.timestamp}</span>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed">{n.message}</p>
                              </div>
                            ))
                          ) : (
                            <div className="p-12 text-center">
                              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No New Intelligence</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto custom-scrollbar p-0 px-0 md:p-8 md:px-8">
            <div className="max-w-7xl mx-auto py-6 px-4 md:py-0 md:px-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'dashboard' && <Dashboard />}
                  {activeTab === 'requests' && <RequestList />}
                  {activeTab === 'map' && <SupplyMap />}
                  {activeTab === 'dispatches' && <DispatchTracker />}
                  {activeTab === 'ai_ingestion' && <AIDocumentIngestion />}
                  {activeTab === 'volunteer' && <VolunteerPortal />}
                  {activeTab === 'safe_registry' && <SafeRegistry />}
                  {activeTab === 'profile' && <UserProfile user={user} />}

                  {activeTab === 'alliance' && (
                    <div className="space-y-12">
                      <div className="rounded-3xl border border-slate-200 bg-white p-12 overflow-hidden relative shadow-xl shadow-slate-100">
                        <div className="relative z-10">
                          <h2 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">NGO Alliance Network</h2>
                          <p className="text-slate-500 text-lg max-w-xl mb-10 leading-relaxed">
                            ReliefGrid Interoperability Protocol (RGIP) enabled. Share resources, tasks, and intelligence across verified humanitarian organizations.
                          </p>
                          <div className="flex gap-4">
                            <button className="rounded-xl bg-slate-900 px-8 py-4 text-sm font-bold text-white shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all">
                              Federate Resources
                            </button>
                            <button className="rounded-xl border border-slate-200 bg-white px-8 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all">
                              View Global Map
                            </button>
                          </div>
                        </div>
                        <div className="absolute top-0 right-0 w-1/3 h-full opacity-[0.03] pointer-events-none">
                           <Globe size={400} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <AllianceCard name="Red Cross" tasks={12} status="active" />
                        <AllianceCard name="UNICEF" tasks={5} status="active" />
                        <AllianceCard name="Doctors Without Borders" tasks={8} status="active" />
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>

          {/* Mobile Bottom Navigation */}
          <nav className="mobile-bottom-nav">
            <MobileNavItem 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
              icon={<LayoutDashboard size={20} />} 
              label="Home"
            />
            <MobileNavItem 
              active={activeTab === 'requests'} 
              onClick={() => setActiveTab('requests')} 
              icon={<AlertCircle size={20} />} 
              label="Alerts"
            />
            <MobileNavItem 
              active={activeTab === 'map'} 
              onClick={() => setActiveTab('map')} 
              icon={<MapIcon size={20} />} 
              label="Map"
            />
            <MobileNavItem 
              active={activeTab === 'volunteer'} 
              onClick={() => setActiveTab('volunteer')} 
              icon={<UserCircle size={20} />} 
              label="Portal"
            />
            <MobileNavItem 
              active={isChatOpen} 
              onClick={() => setIsChatOpen(!isChatOpen)} 
              icon={<Bot size={20} />} 
              label="AI"
            />
          </nav>
        </div>

        {/* Integrated AI Assistant */}
        <ReliefAssistant isOpen={isChatOpen} onToggle={() => setIsChatOpen(!isChatOpen)} />

        <AnimatePresence>
          {showNewRequestModal && (
            <NewRequestModal onClose={() => setShowNewRequestModal(false)} />
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}


function NewRequestModal({ onClose }: { onClose: () => void }) {
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'requests'), {
        source: 'manual',
        rawContent: `Manual entry: ${item} (${quantity}) at ${pinCode}`,
        extractedData: {
          item,
          quantity: parseInt(quantity),
          urgency,
          location: pinCode,
          pinCode,
          lat: 13.0827 + (Math.random() - 0.5) * 0.1,
          lng: 80.2707 + (Math.random() - 0.5) * 0.1,
        },
        status: 'pending',
        createdAt: serverTimestamp()
      });
      onClose();
    } catch (err) {
      console.error('Error adding request:', err);
      alert('Failed to add request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-10"
      >
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-lg font-bold text-slate-900">New Relief Request</h3>
             <button 
               onClick={onClose} 
               aria-label="Close assistant" 
               title="Close Assistant" 
               className="text-slate-400 hover:bg-slate-100 transition-all p-2 rounded-lg"
             >
               <X size={20} />
             </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Item Needed</label>
            <input 
              type="text" 
              required 
              value={item}
              onChange={(e) => setItem(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-0 transition-colors"
              placeholder="e.g. Water Bottles, Rice"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Quantity</label>
              <input 
                type="number" 
                required 
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-0 transition-colors"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">PIN Code</label>
              <input 
                type="text" 
                required 
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-0 transition-colors"
                placeholder="600001"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Urgency</label>
            <select 
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as any)}
              aria-label="Sort requests"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 outline-none cursor-pointer w-full"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-slate-900 py-4 text-sm font-bold text-white hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Create Request'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function AllianceCard({ name, tasks, status }: { name: string, tasks: number, status: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 transition-all hover:border-slate-300">
      <div className="flex justify-between items-start mb-6">
        <div className="h-10 w-10 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-900">
          <Users size={20} />
        </div>
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
      </div>
      <h4 className="font-bold text-slate-900 mb-1">{name}</h4>
      <p className="text-xs text-slate-400 font-medium">{tasks} active federated tasks</p>
    </div>
  );
}

function MobileNavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-slate-900 scale-110' : 'text-slate-400 opacity-60'}`}
    >
      <div className={`${active ? 'text-slate-900' : ''}`}>
        {icon}
      </div>
      <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}

function NavItem({ 
  active, 
  onClick, 
  icon, 
  label, 
  collapsed,
  badge 
}: { 
  active: boolean, 
  onClick: () => void, 
  icon: React.ReactNode, 
  label: string, 
  collapsed?: boolean,
  badge?: number
}) {
  return (
    <button 
      onClick={onClick}
      className={`group relative flex w-full items-center gap-3 rounded-xl px-4 py-2.5 transition-all active:scale-[0.98] ${
        active 
          ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      } ${collapsed ? 'justify-center' : ''}`}
    >
      <div className={`shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-900 transition-colors'}`}>
        {icon}
      </div>
      {!collapsed && <span className="text-xs font-black uppercase tracking-widest">{label}</span>}
      
      {badge !== undefined && (
        <span className={`absolute ${collapsed ? 'top-1 right-1' : 'right-3'} flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-black text-white ring-2 ring-white shadow-lg`}>
          {badge}
        </span>
      )}

      {active && (
        <motion.div 
          layoutId="sidebar-active"
          className="absolute left-0 h-4 w-1 rounded-r-full bg-blue-500"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
    </button>
  );
}
