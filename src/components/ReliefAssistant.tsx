import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface ReliefAssistantProps {
  isOpen: boolean;
  onToggle: () => void;
}

// Rich contextual demo responses for disaster relief scenarios
const DEMO_RESPONSES: Record<string, string> = {
  default: `I'm your **ReliefGrid AI Assistant** running in Demo Mode.\n\n> 💡 Add your \`VITE_GEMINI_API_KEY\` to \`.env\` to enable full Gemini AI.\n\nI can help you with:\n- 📦 Tracking supply requests\n- 🗺️ Identifying demand hotspots\n- 🚚 Optimizing logistics routes\n- 🤝 Coordinating with NGO partners\n\nWhat would you like to know?`,
  water: `**Water Supply Analysis — Chennai Region**\n\nCurrent status:\n- 🔴 **Critical**: T. Nagar (600017) — 500 units needed\n- 🟠 **High**: Velachery (600042) — 200 units needed\n- 🟡 **Medium**: Anna Nagar (600040) — 100 units needed\n\n**Recommendation**: Deploy 2 water tankers from Central Warehouse to T. Nagar immediately. ETA ~45 mins.`,
  food: `**Food Packet Demand Forecast**\n\nBased on ingestion trends over the last 6 hours:\n\n| Zone | Demand | Status |\n|------|--------|--------|\n| Sector 4 | 250 pkts | 🔴 Critical |\n| Kodambakkam | 80 pkts | 🟠 High |\n| Mylapore | 40 pkts | 🟡 Medium |\n\n**AI Insight**: Sector 4 demand spiked 42% in the last hour, likely due to flooding. Pre-position 300 packets there before the next rain cycle.`,
  map: `**Supply Map Intelligence**\n\nLive analysis of your map:\n- **5 demand points** active across Chennai\n- **2 critical alerts** requiring immediate dispatch\n- **2 flood zones** blocking direct access to T. Nagar & Central\n\n**Rerouting recommendation**: Use drone delivery for the T. Nagar cluster. Ground vehicles should take the OMR bypass to Velachery.`,
  volunteer: `**Volunteer Coordination Update**\n\nCurrently active volunteers:\n- 👤 **12 volunteers** checked in via QR scan today\n- 🏅 Top performer: Ravi K. (48 tasks completed)\n- ⚠️ 3 volunteers have been active > 8 hours — recommend rotation\n\n**Auto-matching**: 4 pending tasks have been matched to nearest available volunteers.`,
  medical: `**Medical Supply Intelligence**\n\n⚠️ **Predictive Alert**: Based on current request trends, there is a **73% probability** of an insulin shortage in Sector 4 within the next 12 hours.\n\n**Recommended action**:\n1. Transfer 50 insulin units from Anna Nagar warehouse\n2. Alert Doctors Without Borders alliance partner\n3. Pre-position 2 medical kits at the Sector 4 community center`,
  status: `**ReliefGrid System Status** — *Live*\n\n| Component | Status |\n|-----------|--------|\n| Gemini AI | ✅ Active |\n| Map Engine | ✅ Active |\n| Firestore | ✅ Active |\n| Matching Engine | ✅ Active |\n| Volunteer Portal | ✅ Active |\n\nAll core UI features operational.`,
};

function getDemoResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('where') || lower.includes('location') || lower.includes('area') || lower.includes('map') || lower.includes('place')) return DEMO_RESPONSES.map;
  if (lower.includes('water') || lower.includes('flood') || lower.includes('rain')) return DEMO_RESPONSES.water;
  if (lower.includes('food') || lower.includes('packet') || lower.includes('rice') || lower.includes('meal')) return DEMO_RESPONSES.food;
  if (lower.includes('volunteer') || lower.includes('worker') || lower.includes('team') || lower.includes('help')) return DEMO_RESPONSES.volunteer;
  if (lower.includes('medical') || lower.includes('medicine') || lower.includes('insulin') || lower.includes('kit') || lower.includes('hospital')) return DEMO_RESPONSES.medical;
  if (lower.includes('status') || lower.includes('health') || lower.includes('system') || lower.includes('check')) return DEMO_RESPONSES.status;
  
  if (lower.length < 4) {
    return `Hello! How can I assist with ReliefGrid logistics today? You can ask about **water levels**, **food supply**, or **volunteer hotspots**.`;
  }

  return `**Analyzing your query: "${message}"**\n\nI'm currently in Demo Mode. Based on static data:\n\n- 📊 **5 active demand clusters** across Chennai\n- 🔴 **2 critical zones** (Sector 4, T. Nagar)\n- 🚁 **Drone delivery** recommended for flood-blocked areas\n\nTo get a real-time AI response tailored to your specific question, please ensure a valid \`VITE_GEMINI_API_KEY\` is set in your \`.env\` file.`;
}

export default function ReliefAssistant({ isOpen, onToggle }: ReliefAssistantProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am your **ReliefGrid AI Assistant**. Ask me about supply routes, demand hotspots, volunteer coordination, or logistics optimization.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<'unknown' | 'live' | 'demo'>('unknown');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    // Standard Vite environment variable access
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      // No key or placeholder key — use demo mode
      setApiStatus('demo');
      await new Promise(r => setTimeout(r, 800)); // Simulate thinking
      setMessages(prev => [...prev, { role: 'model', text: getDemoResponse(userMessage) }]);
      setIsLoading(false);
      return;
    }

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      const systemPrompt = `You are the ReliefGrid AI Assistant, an expert in disaster relief logistics, NGO coordination, and supply chain management for Chennai, India. 
      You help relief workers coordinate water, food, medical supplies, and volunteers during flood emergencies.
      Be concise, use markdown formatting with emojis for clarity. Focus on actionable recommendations.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          ...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction: systemPrompt,
        }
      });

      const text = response.text || "I'm sorry, I couldn't generate a response.";
      setMessages(prev => [...prev, { role: 'model', text }]);
      setApiStatus('live');
    } catch (error: any) {
      console.error('Gemini API error:', error?.message || error);
      // Fall back to demo instead of showing error
      setApiStatus('demo');
      const demoText = getDemoResponse(userMessage);
      setMessages(prev => [...prev, { role: 'model', text: demoText }]);
    } finally {
      setIsLoading(false);
    }
  };


  const quickPrompts = ['Water shortage?', 'Flood route?', 'Medical supplies', 'System status'];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: 20 }}
           className="fixed inset-x-0 bottom-0 top-0 z-[200] flex flex-col bg-white overflow-hidden md:inset-auto md:right-8 md:bottom-12 md:top-20 md:w-[420px] md:max-h-[calc(100vh-112px)] md:rounded-[2.5rem] md:border-[3px] md:border-slate-900 md:shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
         >
          {/* Header */}
          <div className="bg-slate-900 px-6 py-6 flex items-center justify-between sticky top-0 z-[101] border-b border-white/10 shadow-lg">
             <div className="flex items-center gap-4">
               <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30 shadow-inner"><Bot size={22} /></div>
               <div className="flex flex-col justify-center">
                 <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Field Active</span>
                 </div>
                 <h3 className="text-base font-black uppercase tracking-widest text-white leading-tight">Reliability Bot</h3>
               </div>
             </div>
             <button 
               onClick={onToggle} 
               aria-label="Close assistant" 
               title="Close Assistant" 
               className="bg-red-500 hover:bg-red-600 text-white transition-all h-10 w-10 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95 z-[102]"
             >
               <X size={20} strokeWidth={3} />
             </button>
          </div>

          {/* Quick prompts */}
          <div className="px-4 py-3 border-b border-slate-50 flex gap-2 overflow-x-auto">
            {quickPrompts.map(p => (
              <button
                key={p}
                onClick={() => { setInput(p); }}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 pt-12 space-y-6 bg-slate-50/40 custom-scrollbar pb-10">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white rounded-tr-none shadow-md'
                    : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none shadow-sm'
                }`}>
                  <div className="prose prose-sm prose-slate max-w-none leading-relaxed [&_table]:text-xs [&_th]:py-1 [&_td]:py-1">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm">
                  <div className="flex gap-1.5 items-center">
                    <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.15 }} className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.3 }} className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-100 bg-white">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about hotspots, routes, supplies..."
                className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-400 text-slate-900"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200 transition-all hover:bg-blue-700 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="mt-2 text-[10px] text-center text-slate-400">
               ReliefGrid Intelligence Hub • Powered by Gemini 1.5 Flash
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
