import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { doc, updateDoc, addDoc, collection, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  CheckCircle, 
  Camera, 
  MapPin, 
  Package, 
  ShieldCheck, 
  AlertCircle,
  TrendingUp,
  XCircle,
  Truck
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function QRScanner() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedDispatch, setScannedDispatch] = useState<any>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // 1. Initialize the scanner
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    const onScanSuccess = async (decodedText: string) => {
      if (isProcessing) return;
      setScanResult(decodedText);
      await handleVerification(decodedText);
    };

    const onScanError = (err: any) => {
      // Intentionally quiet to prevent console flutter during scan
    };

    scanner.render(onScanSuccess, onScanError);
    scannerRef.current = scanner;

    // 2. Cleanup on unmount
    return () => {
      scanner.clear().catch((err) => {
        console.error("Failed to clear html5QrcodeScanner", err);
      });
    };
  }, []);

  const handleVerification = async (dispatchId: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      // 1. Verify Dispatch exists
      const docRef = doc(db, 'dispatches', dispatchId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Invalid Dispatch Token. QR code not recognized.");
      }

      const data = docSnap.data();
      if (data.status === 'delivered') {
         setError("This dispatch has already been verified and delivered.");
         setIsProcessing(false);
         return;
      }

      setScannedDispatch({ id: dispatchId, ...data });

      // 2. Atomic update to delivered status
      await updateDoc(docRef, {
        status: 'delivered',
        deliveredAt: new Date().toISOString(),
        verifiedAt: serverTimestamp()
      });

      // 3. Create Audit Ledger Record
      await addDoc(collection(db, 'ledger'), {
        action: 'DELIVERY_CONFIRMED',
        actorId: 'FIELD_VOLUNTEER_01', // Should be auth user ID
        resourceId: dispatchId,
        details: `Aid verified on-site for request ${data.requestId}. Delivery Successful.`,
        hash: `0x${Math.random().toString(16).slice(2, 10)}`,
        timestamp: serverTimestamp()
      });

      console.log(`[QRScanner] Successfully verified delivery for ${dispatchId}`);
      
      // Stop scanner once success
      if (scannerRef.current) {
         scannerRef.current.clear();
      }

    } catch (e: any) {
      setError(e.message || "Verification failed. Please retry.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetScanner = () => {
     window.location.reload(); // Simple reset for demo context
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-950 text-white p-6 flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="mb-8 text-center pt-8">
         <div className="h-16 w-16 bg-emerald-600/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
            <ShieldCheck size={32} />
         </div>
         <h1 className="text-xl font-black uppercase tracking-tight">Field Verification</h1>
         <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">Scan Dispatch QR to confirm delivery</p>
      </header>

      {/* Camera Stage */}
      {!scannedDispatch ? (
        <div className="flex-1 flex flex-col gap-8">
           <div className="relative rounded-3xl overflow-hidden border-4 border-slate-800 bg-slate-900 shadow-2xl">
              <div id="qr-reader" className="w-full h-auto" />
              {isProcessing && (
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-20">
                   <div className="text-center">
                      <div className="h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-xs font-black uppercase tracking-widest text-emerald-500">Decrypting Token...</p>
                   </div>
                </div>
              )}
           </div>

           {error && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500">
                 <AlertCircle size={20} className="shrink-0" />
                 <p className="text-[10px] font-bold uppercase tracking-wide leading-tight">{error}</p>
              </div>
           )}

           <div className="mt-auto space-y-4 pb-12">
              <div className="flex items-center justify-center gap-4 text-slate-500 uppercase tracking-widest text-[10px] font-black">
                 <div className="h-px flex-1 bg-slate-800" />
                 <span>Volunteer Guidelines</span>
                 <div className="h-px flex-1 bg-slate-800" />
              </div>
              <ul className="space-y-3">
                 <li className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ensure QR is centered in focus area
                 </li>
                 <li className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Hold steady until vibration confirmation
                 </li>
              </ul>
           </div>
        </div>
      ) : (
        /* Success Stage */
        <div className="flex-1 flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in duration-500">
           <div className="h-24 w-24 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.4)] mb-8">
              <CheckCircle size={48} />
           </div>
           
           <h2 className="text-2xl font-black uppercase tracking-tighter text-emerald-500 mb-2">Delivery Verified</h2>
           <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-center px-12 leading-relaxed">
             Impact loop updated. NGO headquarters has received confirmation.
           </p>

           <div className="mt-12 w-full space-y-4">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                       <Package size={20} />
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Item Received</p>
                       <p className="text-sm font-bold text-slate-100">{scannedDispatch.item}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                       <MapPin size={20} />
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Verified Location</p>
                       <p className="text-sm font-bold text-slate-100">{scannedDispatch.to}</p>
                    </div>
                 </div>
              </div>
              
              <button 
                onClick={resetScanner}
                className="w-full flex items-center justify-center gap-3 p-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 transition-all font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-600/20"
              >
                Scan Next Dispatch <ChevronRight size={16} />
              </button>
           </div>
        </div>
      )}

      {/* Navbar overlay logic for Field App Feel */}
      <nav className="fixed bottom-0 left-0 right-0 p-6 bg-slate-950/80 backdrop-blur-xl border-t border-slate-900 flex justify-around">
         <div className="flex flex-col items-center gap-1 text-slate-500">
            <LayoutDashboard size={20} />
            <span className="text-[8px] font-black uppercase tracking-widest">Dashboard</span>
         </div>
         <div className="flex flex-col items-center gap-1 text-emerald-500">
            <Camera size={20} className="scale-125" />
            <span className="text-[8px] font-black uppercase tracking-widest">Verify</span>
         </div>
         <div className="flex flex-col items-center gap-1 text-slate-500">
            <Truck size={20} />
            <span className="text-[8px] font-black uppercase tracking-widest">Inventory</span>
         </div>
      </nav>
    </div>
  );
}

function ChevronRight(props: any) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function LayoutDashboard(props: any) {
   return (
     <svg 
       xmlns="http://www.w3.org/2000/svg" 
       width="24" height="24" 
       viewBox="0 0 24 24" 
       fill="none" 
       stroke="currentColor" 
       strokeWidth="2" 
       strokeLinecap="round" 
       strokeLinejoin="round" 
       {...props}
     >
       <rect width="7" height="9" x="3" y="3" rx="1" />
       <rect width="7" height="5" x="14" y="3" rx="1" />
       <rect width="7" height="9" x="14" y="12" rx="1" />
       <rect width="7" height="5" x="3" y="16" rx="1" />
     </svg>
   );
 }
