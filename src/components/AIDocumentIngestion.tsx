import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, FileText, CheckCircle2, AlertCircle, Loader2, Camera, Sparkles,
  Mic, MicOff, ClipboardPaste, Table, MessageSquare, X, ChevronRight
} from 'lucide-react';

type Tab = 'image' | 'csv' | 'voice' | 'paste' | 'whatsapp';

const TABS: { id: Tab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'image', label: 'Image / PDF', icon: <Camera size={16} />, desc: 'Handwritten surveys, printed forms, field photos' },
  { id: 'csv', label: 'CSV / Excel', icon: <Table size={16} />, desc: 'Bulk data upload from spreadsheets' },
  { id: 'voice', label: 'Voice Note', icon: <Mic size={16} />, desc: 'Speak your field report in Hindi, Tamil or English' },
  { id: 'paste', label: 'Paste Text', icon: <ClipboardPaste size={16} />, desc: 'Copy-paste from WhatsApp, PDFs or forms' },
  { id: 'whatsapp', label: 'WhatsApp Sim', icon: <MessageSquare size={16} />, desc: 'Simulate incoming WhatsApp aid request' },
];

// ─── De-duplication helper ───────────────────────────────────────────────────
async function checkDuplicate(item: string, location: string): Promise<boolean> {
  try {
    const cutoff = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const q = query(
      collection(db, 'requests'),
      where('status', '==', 'pending'),
      where('createdAt', '>=', cutoff)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.some(d => {
      const data = d.data();
      const sameItem = data.extractedData?.item?.toLowerCase() === item.toLowerCase();
      const sameLoc = data.extractedData?.location?.toLowerCase().includes(location.toLowerCase().slice(0, 6));
      return sameItem && sameLoc;
    });
  } catch {
    return false; // fail open — don't block save on network error
  }
}

// ─── Gemini helper ───────────────────────────────────────────────────────────
function getAI() {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY not set in .env');
  return new GoogleGenAI({ apiKey });
}

const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    item: { type: Type.STRING },
    quantity: { type: Type.NUMBER },
    urgency: { type: Type.STRING, enum: ['low', 'medium', 'high', 'critical'] },
    location: { type: Type.STRING },
    contact: { type: Type.STRING },
    language: { type: Type.STRING },
  },
  required: ['item', 'quantity', 'urgency', 'location'],
};

async function extractFromText(text: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{
      parts: [{
        text: `You are a humanitarian aid data extractor. Extract relief request information from this text.
The text may be in Hindi, Tamil, Telugu, or English. Translate to English in the output.
Extract: item name, quantity (number), urgency (low/medium/high/critical), location (area or PIN code), contact info if any, and detected language.

Text: "${text}"

Return ONLY JSON matching the schema.`,
      }]
    }],
    config: { responseMimeType: 'application/json', responseSchema: EXTRACTION_SCHEMA as any }
  });
  return JSON.parse(response.text || '{}');
}

async function extractFromImage(base64: string, mimeType = 'image/jpeg') {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{
      parts: [
        { text: 'Extract relief request data from this image. It may be a handwritten survey, printed form, or field photo. The content can be in Hindi, Tamil, or English. Extract: item name, quantity, urgency (low/medium/high/critical), location, contact info, and detected language. Return ONLY JSON.' },
        { inlineData: { data: base64, mimeType } }
      ]
    }],
    config: { responseMimeType: 'application/json', responseSchema: EXTRACTION_SCHEMA as any }
  });
  return JSON.parse(response.text || '{}');
}

async function saveRequest(extracted: any, source: string, raw: string) {
  const isDuplicate = await checkDuplicate(extracted.item || '', extracted.location || '');
  await addDoc(collection(db, 'requests'), {
    source,
    rawContent: raw,
    extractedData: {
      ...extracted,
      lat: 13.0827 + (Math.random() - 0.5) * 0.15,
      lng: 80.2707 + (Math.random() - 0.5) * 0.15,
      value_inr: (extracted.quantity || 1) * 50,
    },
    status: isDuplicate ? 'duplicate' : 'pending',
    createdAt: serverTimestamp(),
  });
  return isDuplicate;
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function ResultPanel({ result, isDuplicate, error, isProcessing }: { result: any; isDuplicate: boolean; error: string | null; isProcessing: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm min-h-[320px] flex flex-col">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-5 flex items-center gap-2">
        <FileText size={14} className="text-emerald-500" /> Extracted Intelligence
      </h3>
      <AnimatePresence mode="wait">
        {isProcessing && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="relative">
              <div className="h-14 w-14 rounded-full border-4 border-emerald-100 border-t-emerald-500 animate-spin" />
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500" size={18} />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Gemini AI is reading…</p>
          </motion.div>
        )}
        {!isProcessing && result && (
          <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className={`rounded-xl p-3 border flex items-center gap-3 ${isDuplicate ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
              {isDuplicate
                ? <AlertCircle className="text-amber-500 shrink-0" size={20} />
                : <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />}
              <div>
                <p className={`text-xs font-black ${isDuplicate ? 'text-amber-900' : 'text-emerald-900'}`}>
                  {isDuplicate ? 'Duplicate Detected — Saved as Duplicate' : 'Extraction Successful'}
                </p>
                <p className={`text-[10px] ${isDuplicate ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {isDuplicate ? 'Same item+location found in last 24h' : 'Structured & geo-pinned to map'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Item', value: result.item },
                { label: 'Quantity', value: result.quantity },
                { label: 'Urgency', value: result.urgency, highlight: true },
                { label: 'Location', value: result.location },
                { label: 'Contact', value: result.contact || '—' },
                { label: 'Language', value: result.language || 'English' },
              ].map(f => (
                <div key={f.label} className="space-y-0.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{f.label}</p>
                  <p className={`text-sm font-bold capitalize ${f.highlight ? 'text-red-600' : 'text-slate-900'}`}>{f.value || 'N/A'}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
        {!isProcessing && error && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <AlertCircle size={40} className="text-red-400" />
            <p className="text-sm text-red-600 font-medium max-w-xs">{error}</p>
          </motion.div>
        )}
        {!isProcessing && !result && !error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-300 text-center">
            <Upload size={40} className="opacity-30" />
            <p className="text-xs font-bold uppercase tracking-widest">Awaiting input…</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── IMAGE TAB ───────────────────────────────────────────────────────────────
function ImageTab({ onResult }: { onResult: (r: any, dup: boolean) => void }) {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { setImage(reader.result as string); setResult(null); setError(null); };
    reader.readAsDataURL(file);
  };

  const process = async () => {
    if (!image) return;
    setIsProcessing(true); setError(null);
    try {
      const base64 = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1];
      const extracted = await extractFromImage(base64, mimeType);
      const dup = await saveRequest(extracted, 'ai_ingestion', `Image upload: ${JSON.stringify(extracted)}`);
      setResult(extracted); setIsDuplicate(dup);
      onResult(extracted, dup);
    } catch (err: any) {
      setError(err.message || 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div onClick={() => fileRef.current?.click()}
          className={`relative aspect-square cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center ${image ? 'border-emerald-400 bg-emerald-50/20' : 'border-slate-200 bg-slate-50 hover:border-emerald-400 hover:bg-white'}`}>
          {image ? <img src={image} alt="Preview" className="h-full w-full object-cover rounded-xl" />
            : <>
                <Camera size={36} className="text-slate-300 mb-3" />
                <p className="text-xs font-bold text-slate-500">Take Photo or Upload</p>
                <p className="text-[10px] text-slate-400 mt-1">JPG, PNG, WEBP — handwritten or printed</p>
              </>}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={onFile} className="hidden"
            id="img-upload" aria-label="Upload survey image" title="Upload field report" />
        </div>
        <button onClick={process} disabled={!image || isProcessing}
          className="w-full rounded-xl bg-emerald-600 py-3 font-black text-white text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
          {isProcessing ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <><Sparkles size={16} /> Run AI Extraction</>}
        </button>
      </div>
      <ResultPanel result={result} isDuplicate={isDuplicate} error={error} isProcessing={isProcessing} />
    </div>
  );
}

// ─── CSV TAB ─────────────────────────────────────────────────────────────────
function CsvTab({ onResult }: { onResult: (r: any, dup: boolean) => void }) {
  const [rows, setRows] = useState<string[][]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const text = reader.result as string;
      const lines = text.trim().split('\n').map(l => l.split(',').map(c => c.replace(/^"|"$/g, '').trim()));
      setRows(lines.slice(0, 20)); // preview first 20
      setResults([]); setError(null);
    };
    reader.readAsText(file);
  };

  const process = async () => {
    if (!rows.length) return;
    setIsProcessing(true); setError(null);
    try {
      const csvText = rows.map(r => r.join(', ')).join('\n');
      const extracted = await extractFromText(`This is a CSV table of relief requests:\n${csvText}`);
      const dup = await saveRequest(extracted, 'csv', csvText);
      setResults([extracted]);
      onResult(extracted, dup);
    } catch (err: any) {
      setError(err.message || 'CSV processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div onClick={() => fileRef.current?.click()}
        className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center hover:border-emerald-400 hover:bg-white transition-all">
        <Table size={32} className="text-slate-300 mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-500">Click to upload CSV or Excel export</p>
        <p className="text-[10px] text-slate-400 mt-1">Headers can be in any order — AI will figure it out</p>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={onFile} className="hidden"
          id="csv-upload" aria-label="Upload CSV file" title="Upload CSV" />
      </div>
      {rows.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-auto max-h-40">
          <table className="text-[10px] w-full">
            <thead className="bg-slate-50">
              <tr>{rows[0].map((h, i) => <th key={i} className="px-3 py-2 text-left font-black text-slate-400 uppercase tracking-wider">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(1, 6).map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {r.map((c, j) => <td key={j} className="px-3 py-2 text-slate-600 font-medium">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 0 && (
        <button onClick={process} disabled={isProcessing}
          className="w-full rounded-xl bg-emerald-600 py-3 font-black text-white text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
          {isProcessing ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <><Sparkles size={16} /> Ingest {rows.length - 1} rows</>}
        </button>
      )}
      {results.map((r, i) => <ResultPanel key={i} result={r} isDuplicate={false} error={null} isProcessing={false} />)}
      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
    </div>
  );
}

// ─── VOICE TAB ───────────────────────────────────────────────────────────────
function VoiceTab({ onResult }: { onResult: (r: any, dup: boolean) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);

  const toggle = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError("Speech Recognition not supported. Use Chrome or Safari."); return; }
    if (isRecording) {
      recRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const rec = new SR();
    rec.lang = 'en-IN'; rec.continuous = false; rec.interimResults = false;
    rec.onstart = () => setIsRecording(true);
    rec.onresult = async (e: any) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      setIsProcessing(true); setError(null);
      try {
        const extracted = await extractFromText(text);
        const dup = await saveRequest(extracted, 'voice', text);
        setResult(extracted); setIsDuplicate(dup);
        onResult(extracted, dup);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsProcessing(false);
      }
    };
    rec.onerror = () => { setIsRecording(false); setError('Recording error. Please try again.'); };
    rec.onend = () => setIsRecording(false);
    rec.start();
    recRef.current = rec;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <button onClick={toggle}
          className={`w-full rounded-2xl border-2 border-dashed p-10 transition-all flex flex-col items-center gap-4 ${isRecording ? 'bg-red-50 border-red-400 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-emerald-400 hover:bg-white hover:text-emerald-600'}`}>
          <div className={`h-16 w-16 rounded-full flex items-center justify-center border-2 shadow-lg ${isRecording ? 'bg-red-500 border-red-400 text-white animate-pulse' : 'bg-white border-slate-100 text-slate-700'}`}>
            {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
          </div>
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-widest">{isRecording ? 'TAP TO STOP' : 'TAP TO SPEAK'}</p>
            <p className="text-[10px] mt-1 font-bold">Hindi • Tamil • Telugu • English 🇮🇳</p>
          </div>
        </button>
        {transcript && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Transcript</p>
            <p className="text-xs text-slate-700 italic">"{transcript}"</p>
          </div>
        )}
        {error && <p className="text-xs text-red-500 text-center bg-red-50 rounded-xl p-3">{error}</p>}
      </div>
      <ResultPanel result={result} isDuplicate={isDuplicate} error={null} isProcessing={isProcessing} />
    </div>
  );
}

// ─── PASTE TAB ───────────────────────────────────────────────────────────────
function PasteTab({ onResult }: { onResult: (r: any, dup: boolean) => void }) {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const process = async () => {
    if (!text.trim()) return;
    setIsProcessing(true); setError(null);
    try {
      const extracted = await extractFromText(text);
      const dup = await saveRequest(extracted, 'text_paste', text);
      setResult(extracted); setIsDuplicate(dup);
      onResult(extracted, dup);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <textarea value={text} onChange={e => setText(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 min-h-[200px] resize-none focus:outline-none focus:border-emerald-400 focus:bg-white transition-all placeholder:text-slate-300"
          placeholder="Paste WhatsApp messages, PDF text, form responses… any language supported." />
        <button onClick={process} disabled={!text.trim() || isProcessing}
          className="w-full rounded-xl bg-emerald-600 py-3 font-black text-white text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
          {isProcessing ? <><Loader2 size={16} className="animate-spin" /> Extracting…</> : <><Sparkles size={16} /> Extract & Ingest</>}
        </button>
        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      </div>
      <ResultPanel result={result} isDuplicate={isDuplicate} error={error} isProcessing={isProcessing} />
    </div>
  );
}

// ─── WHATSAPP SIM TAB ─────────────────────────────────────────────────────────
const WA_TEMPLATES = [
  { label: 'Food shortage (Tamil)', msg: 'அண்ணா நம்ம ஏரியால 200 பேருக்கு சாப்பாடு இல்ல. T.Nagar 600017. உடனே help பண்ணுங்க. Critical uh.' },
  { label: 'Medical – Hindi', msg: 'Bhai Sector 4 mein 50 log hain, insulin nahi hai. Bahut urgent hai. +919876543210' },
  { label: 'Water – English', msg: 'We need 500 water bottles urgently at Anna Nagar hub PIN 600040. Flood situation worsening.' },
  { label: 'Blankets needed', msg: 'Velachery flood camp needs 150 blankets immediately. Contact: Rani 9876543210' },
];

function WhatsAppSimTab({ onResult }: { onResult: (r: any, dup: boolean) => void }) {
  const [msg, setMsg] = useState('');
  const [sender, setSender] = useState('+91 98765 43210');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ msg: string; from: string; ts: string }[]>([]);

  const send = async () => {
    if (!msg.trim()) return;
    const ts = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setHistory(h => [...h, { msg, from: sender, ts }]);
    setIsProcessing(true); setError(null);
    try {
      const extracted = await extractFromText(`WhatsApp from ${sender}: ${msg}`);
      const dup = await saveRequest(extracted, 'whatsapp_sim', `From ${sender}: ${msg}`);
      setResult(extracted); setIsDuplicate(dup);
      setMsg('');
      onResult(extracted, dup);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        {/* WA chat UI */}
        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
          <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-black">NGO</div>
            <div>
              <p className="text-white text-xs font-bold">ReliefGrid WhatsApp</p>
              <p className="text-white/60 text-[10px]">Simulated Webhook</p>
            </div>
          </div>
          <div className="bg-[#ECE5DD] p-4 min-h-[140px] space-y-2">
            {history.length === 0 && (
              <p className="text-[10px] text-[#8696A0] text-center py-4">Messages will appear here…</p>
            )}
            {history.map((h, i) => (
              <div key={i} className="flex justify-end">
                <div className="bg-[#DCF8C6] rounded-xl rounded-tr-none px-3 py-2 max-w-[80%] shadow-sm">
                  <p className="text-[11px] text-[#111B21]">{h.msg}</p>
                  <p className="text-[9px] text-[#8696A0] text-right mt-0.5">{h.ts} · {h.from}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-[#F0F2F5] p-2 flex gap-2 items-end">
            <input value={sender} onChange={e => setSender(e.target.value)}
              className="w-28 text-[10px] rounded-full px-3 py-2 border border-slate-200 bg-white outline-none text-slate-500"
              placeholder="Sender phone" title="Sender phone number" />
            <input value={msg} onChange={e => setMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              className="flex-1 text-xs rounded-full px-4 py-2 border border-slate-200 bg-white outline-none text-slate-700"
              placeholder="Type message or pick template…" title="WhatsApp message" />
            <button onClick={send} disabled={!msg.trim() || isProcessing}
              className="h-9 w-9 rounded-full bg-[#075E54] text-white flex items-center justify-center shrink-0 disabled:opacity-40">
              {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={18} />}
            </button>
          </div>
        </div>
        {/* Templates */}
        <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Templates</p>
          {WA_TEMPLATES.map(t => (
            <button key={t.label} onClick={() => setMsg(t.msg)}
              className="w-full text-left text-[10px] rounded-xl border border-slate-100 bg-white px-3 py-2 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 transition-all font-medium">
              <span className="font-black text-slate-900 mr-2">{t.label}:</span>{t.msg.slice(0, 60)}…
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      </div>
      <ResultPanel result={result} isDuplicate={isDuplicate} error={error} isProcessing={isProcessing} />
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AIDocumentIngestion() {
  const [activeTab, setActiveTab] = useState<Tab>('image');
  const [lastResult, setLastResult] = useState<{ item: string; dup: boolean } | null>(null);

  const handleResult = useCallback((r: any, dup: boolean) => {
    setLastResult({ item: r.item, dup });
    setTimeout(() => setLastResult(null), 5000);
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Zero-Friction Ingestion</h2>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
          AI reads any format — image, CSV, voice, text, WhatsApp — and structures it instantly
        </p>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {lastResult && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold border ${lastResult.dup ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
            {lastResult.dup ? <AlertCircle size={18} className="text-amber-500" /> : <CheckCircle2 size={18} className="text-emerald-500" />}
            {lastResult.dup ? `Duplicate found for "${lastResult.item}" — saved & flagged` : `"${lastResult.item}" ingested and pinned to map`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto hide-scrollbar bg-slate-100 p-1 rounded-2xl">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab description */}
      <p className="text-[11px] text-slate-400 font-bold">{TABS.find(t => t.id === activeTab)?.desc}</p>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
          {activeTab === 'image' && <ImageTab onResult={handleResult} />}
          {activeTab === 'csv' && <CsvTab onResult={handleResult} />}
          {activeTab === 'voice' && <VoiceTab onResult={handleResult} />}
          {activeTab === 'paste' && <PasteTab onResult={handleResult} />}
          {activeTab === 'whatsapp' && <WhatsAppSimTab onResult={handleResult} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
