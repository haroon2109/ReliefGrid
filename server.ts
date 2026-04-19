import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { z } from 'zod';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf-8'));

// Initialize Firebase Admin
try {
  if (!getApps().length) {
    initializeApp({
      projectId: firebaseConfig.projectId
    });
    console.log('[FIREBASE] Admin initialized successfully');
  }
} catch (error) {
  console.warn('[FIREBASE WARNING] Could not initialize Firebase Admin with default credentials. Some backend listeners may fail. Please set GOOGLE_APPLICATION_CREDENTIALS for full functionality.');
}


// Input Validation Schemas
const ProcessRequestSchema = z.object({
  rawContent: z.string().min(1).max(5000), // Prevent massive payloads
  mediaType: z.enum(['text', 'image', 'audio']).optional().default('text'),
});

const WhatsAppWebhookSchema = z.object({
  // WhatsApp Business API payload structure varies, but we'll validate the basics
  object: z.string().optional(),
  entry: z.array(z.any()).optional(),
});

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = 3000;
  
  let db: any;
  try {
    db = getFirestore(getApp(), firebaseConfig.firestoreDatabaseId);
  } catch (e) {
    console.warn('[FIREBASE WARNING] Firestore could not be initialized. Backend listeners will be disabled.');
  }


  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": [
          "'self'", "data:", "blob:",
          "https://*.google.com", "https://*.googleapis.com", "https://*.gstatic.com",
          "https://*.picsum.photos", "https://ui-avatars.com",
          // Leaflet / Map tile providers
          "https://*.tile.openstreetmap.org",
          "https://server.arcgisonline.com",
          "https://*.basemaps.cartocdn.com",
          "https://*.opentopomap.org",
        ],
        "script-src": ["'self'", "'unsafe-inline'", "https://*.google.com", "https://*.googleapis.com"],
        "connect-src": [
          "'self'",
          "https://*.googleapis.com", "https://*.google.com",
          "wss://*.run.app",
          // Map tile CDNs
          "https://*.tile.openstreetmap.org",
          "https://server.arcgisonline.com",
          "https://*.basemaps.cartocdn.com",
          "https://*.opentopomap.org",
          // Gemini AI
          "https://generativelanguage.googleapis.com",
        ],
        "frame-ancestors": ["'self'", "https://ais-dev-3yuwsxafexnztv4cbjj6ok-802156064276.asia-southeast1.run.app", "https://*.google.com", "https://aistudio.google.com"],
        "worker-src": ["'self'", "blob:"],
      },
    },
    frameguard: false,
  }));


  // Logging
  app.use(morgan('combined')); // Standard Apache combined log format
  app.use(express.json({ limit: '10kb' })); // Prevent large JSON body attacks
  app.use(express.urlencoded({ extended: true, limit: '10kb' })); // Handle Twilio/WhatsApp form data

  // Rate Limiting
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
    validate: { default: false }
  });



  const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Strict limit for expensive AI calls
    message: { error: 'AI generation limit reached. Please try again in an hour.' },
    keyGenerator: (req) => (req as any).user?.uid || req.ip, // Rate limit per user
    validate: { default: false }
  });



  app.use('/api/', generalLimiter);

  // --- Backend Consolidation Engine ---
  const startConsolidationListener = () => {
    console.log('[CONSOLIDATION] Starting listener...');
    const unsubscribe = db.collection('requests').where('status', '==', 'pending').onSnapshot(async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const request = { id: change.doc.id, ...change.doc.data() } as any;
          console.log(`[CONSOLIDATION] New request detected: ${request.id}. Processing...`);
          
          try {
            const data = request.extractedData || {};
            const item = data.item || 'Unknown Resource';
            const pinCode = data.pinCode || '000000';
            
            // Dynamic Trust Scoring & Auto-Verification
            let status = 'open';
            if (request.trustScore && request.trustScore > 80) {
              status = 'verified';
              console.log(`[TRUST] Request ${request.id} auto-verified due to high trust score: ${request.trustScore}`);
            } else if (request.source === 'manual') {
              status = 'requires_verification';
            }

            // Simple consolidation key: item + pincode
            const consolidatedId = `${item.toLowerCase().replace(/\s+/g, '_')}_${pinCode}`;
            const consolidatedRef = db.collection('consolidated').doc(consolidatedId);
            
            const consolidatedDoc = await consolidatedRef.get();
            
            if (consolidatedDoc.exists) {
              const current = consolidatedDoc.data() as any;
              await consolidatedRef.update({
                totalQuantity: FieldValue.increment(data.quantity || 1),
                requests: FieldValue.arrayUnion(request.id),
                lastUpdated: FieldValue.serverTimestamp(),
                urgency: (data.urgency === 'critical' || current.urgency === 'critical') ? 'critical' : 
                         (data.urgency === 'high' || current.urgency === 'high') ? 'high' : 'medium',
                status: status === 'verified' ? 'open' : current.status
              });
            } else {
              await consolidatedRef.set({
                item,
                totalQuantity: data.quantity || 1,
                pinCode,
                lat: data.lat || 13.0827,
                lng: data.lng || 80.2707,
                urgency: data.urgency || 'medium',
                status: status === 'verified' ? 'open' : 'pending_verification',
                requests: [request.id],
                lastUpdated: FieldValue.serverTimestamp()
              });
            }
            
            // Mark original request as processed
            await db.collection('requests').doc(request.id).update({ status: 'processed' });
            console.log(`[CONSOLIDATION] Request ${request.id} consolidated into ${consolidatedId}`);
            
          } catch (err) {
            console.error('[CONSOLIDATION ERROR]', err);
          }
        }
      }
    }, (error) => {
      console.error('[CONSOLIDATION SNAPSHOT ERROR]', error);
      try { unsubscribe(); } catch (e) {}
      console.log('[CONSOLIDATION] Retrying in 10 seconds...');
      setTimeout(startConsolidationListener, 10000);
    });
  };

  if (db && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    startConsolidationListener();
  } else {
    console.log('[CONSOLIDATION] Background listener disabled (Demo Mode).');
  }


  // --- Backend Matching Engine (Simulated Cloud Function) ---
  
  // Helper for distance calculation
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Listen for new tasks in the background
  const startMatchingListener = () => {
    console.log('[MATCHING ENGINE] Starting listener...');
    const unsubscribe = db.collection('consolidated').where('status', '==', 'open').onSnapshot(async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const task = { id: change.doc.id, ...change.doc.data() } as any;
          console.log(`[MATCHING ENGINE] New task detected: ${task.id}. Calculating matches...`);
          
          try {
            // 1. Get all volunteers
            const volunteersSnap = await db.collection('users').where('role', '==', 'volunteer').get();
            const volunteers = volunteersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as any));

            const matches = volunteers.map(v => {
              let score = 0;
              let distance = 0;

              if (v.location && task.lat && task.lng) {
                distance = getDistance(v.location.lat, v.location.lng, task.lat, task.lng);
                if (distance <= (v.radius || 10)) {
                  score += (100 - distance);
                } else {
                  score -= 50;
                }
              }

              if (task.requiredSkills && task.requiredSkills.length > 0 && v.skills) {
                const matchingSkills = task.requiredSkills.filter((s: string) => v.skills.includes(s));
                score += matchingSkills.length * 50;
              }

              return { v, score, distance };
            });

            const topMatches = matches
              .filter(m => m.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, 3);

            // Impassable Terrain Auto-Reroute (Drone Logic)
            const isFlooded = task.isFlooded || Math.random() > 0.8; // Simulated flooding
            const deliveryMethod = isFlooded ? 'drone' : 'standard';

            for (const match of topMatches) {
              const matchId = `${task.id}_${match.v.uid}`;
              const matchRef = db.collection('task_matches').doc(matchId);
              
              // Use set with merge to avoid duplicates and unnecessary writes
              await matchRef.set({
                taskId: task.id,
                volunteerId: match.v.uid,
                score: match.score,
                distance: match.distance,
                matchedAt: new Date().toISOString(),
                status: 'pending',
                deliveryMethod,
                isFlooded
              }, { merge: true });
              
              console.log(`[MATCHING ENGINE] Matched task ${task.id} to volunteer ${match.v.uid} via ${deliveryMethod}`);
            }
          } catch (err) {
            console.error('[MATCHING ENGINE ERROR]', err);
          }
        }
      }
    }, (error) => {
      console.error('[MATCHING ENGINE SNAPSHOT ERROR]', error);
      try { unsubscribe(); } catch (e) {}
      console.log('[MATCHING ENGINE] Retrying in 10 seconds...');
      setTimeout(startMatchingListener, 10000);
    });
  };

  if (db && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    startMatchingListener();
  } else {
    console.log('[MATCHING ENGINE] Background listener disabled (Demo Mode).');
  }


  // --- IoT Sensor Auto-Dispatch (Predictive Action) ---
  const simulateIoTSensors = async () => {
    console.log('[IoT] Checking water level sensors...');
    const sectors = ['Sector 4', 'Sector 9', 'Sector 12'];
    const randomSector = sectors[Math.floor(Math.random() * sectors.length)];
    const waterLevel = Math.random() * 10;

    if (waterLevel > 7) {
      console.log(`[IoT ALERT] High water level detected in ${randomSector}: ${waterLevel.toFixed(2)}m`);
      const requestId = `iot_${Date.now()}`;
      await db.collection('requests').doc(requestId).set({
        source: 'ai_ingestion',
        rawContent: `IoT Sensor Alert: High water level in ${randomSector}`,
        extractedData: {
          item: 'Sandbags',
          quantity: 100,
          urgency: 'critical',
          location: randomSector,
          pinCode: '600001',
          lat: 13.0827 + (Math.random() - 0.5) * 0.1,
          lng: 80.2707 + (Math.random() - 0.5) * 0.1,
        },
        status: 'pending',
        trustScore: 100, // IoT sensors are highly trusted
        createdAt: FieldValue.serverTimestamp()
      });
    }
  };

  // --- Social Media SOS Scraping ---
  const simulateSocialScraper = async () => {
    console.log('[SOCIAL] Scraping for emergency keywords...');
    const tweets = [
      "Help! My street is flooded in T. Nagar, need food for 5 families #ChennaiRains",
      "Critical need for medical kits at Sector 4 community center",
      "Anyone have extra blankets near Velachery? 10 people stranded."
    ];
    const randomTweet = tweets[Math.floor(Math.random() * tweets.length)];
    
    const requestId = `social_${Date.now()}`;
    await db.collection('requests').doc(requestId).set({
      source: 'ai_ingestion',
      rawContent: `Social Media SOS: ${randomTweet}`,
      extractedData: {
        item: randomTweet.includes('food') ? 'Food Packets' : randomTweet.includes('medical') ? 'Medical Kits' : 'Blankets',
        quantity: 10,
        urgency: 'high',
        location: 'Chennai',
        pinCode: '600017',
        lat: 13.0405,
        lng: 80.2337,
      },
      status: 'pending',
      trustScore: 40, // Social media needs verification
      createdAt: FieldValue.serverTimestamp()
    });
  };

  // Run simulations every 5 minutes — only if Firestore credentials are present
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    setInterval(() => {
      simulateIoTSensors().catch(e => console.warn('[IOT] Simulation skipped:', e.message));
      simulateSocialScraper().catch(e => console.warn('[SOCIAL] Simulation skipped:', e.message));
    }, 5 * 60 * 1000);
  } else {
    console.log('[SIMULATORS] IoT & Social simulators disabled (Demo Mode — no credentials).');
  }


  // Auth Middleware: Verify Firebase ID Token
  const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn(`[SECURITY] Unauthenticated access attempt to ${req.path} from ${req.ip}`);
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await getAuth(getApp()).verifyIdToken(idToken);
      if (!decodedToken.email_verified) {
        console.warn(`[SECURITY] Unverified email access attempt by ${decodedToken.email}`);
        return res.status(403).json({ error: 'Forbidden: Email not verified' });
      }
      (req as any).user = decodedToken;
      next();
    } catch (error) {
      console.error(`[SECURITY] Invalid token attempt from ${req.ip}:`, error);
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  };

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'ReliefGrid Backend' });
  });

  // Protected AI Route with strict validation and rate limiting
  app.post('/api/process-request', authenticate, aiLimiter, async (req, res) => {
    try {
      const validatedData = ProcessRequestSchema.parse(req.body);
      
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        console.error('[CONFIG ERROR] GEMINI_API_KEY is missing');
        return res.status(500).json({ error: 'Internal server configuration error' });
      }

      const ai = new GoogleGenAI({ apiKey });
      const model = ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extract logistics data from this ${validatedData.mediaType}: "${validatedData.rawContent}". 
        Return JSON with: { item, quantity, urgency, location, pinCode, contact }. 
        Use Indian context.`,
        config: { responseMimeType: 'application/json' }
      });

      const response = await model;
      res.json(JSON.parse(response.text));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.issues });
      }
      console.error('[AI ERROR] Gemini processing error:', error);
      res.status(500).json({ error: 'Failed to process with AI' });
    }
  });

  // WhatsApp Webhook (Public, but should be verified in production)
  app.post('/api/webhooks/whatsapp', async (req, res) => {
    try {
      // Twilio/WhatsApp sends data in Body or From/Body
      const { Body, From } = req.body;
      console.log(`[WHATSAPP] Message from ${From}: ${Body}`);

      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (apiKey && Body) {
        const ai = new GoogleGenAI({ apiKey });
        const model = ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Extract logistics data from this WhatsApp message: "${Body}". 
          Return JSON with: { item, quantity, urgency, location, pinCode, lat, lng }. 
          - item: string (e.g. "Bandages")
          - quantity: number (extract numeric value, e.g. "50")
          - urgency: "low" | "medium" | "high" | "critical"
          - location: string (e.g. "Sector 4, Chennai")
          - pinCode: string (6 digits if found, else null)
          - lat: number (approximate latitude for the location in Chennai)
          - lng: number (approximate longitude for the location in Chennai)
          Use Indian context. If location is specific like "Sector 4", try to provide accurate Chennai coordinates.`,
          config: { responseMimeType: 'application/json' }
        });

        const aiResponse = await model;
        const extracted = JSON.parse(aiResponse.text);

        // Ensure quantity is a number
        const quantity = typeof extracted.quantity === 'number' ? extracted.quantity : parseInt(extracted.quantity) || 1;

        await db.collection('requests').add({
          source: 'whatsapp',
          rawContent: Body,
          extractedData: {
            ...extracted,
            quantity,
            contact: From,
            lat: extracted.lat || 13.0827,
            lng: extracted.lng || 80.2707
          },
          status: 'pending',
          trustScore: 60,
          createdAt: FieldValue.serverTimestamp()
        });
      }

      res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.warn(`[SECURITY] Invalid webhook payload from ${req.ip}`, error);
      res.status(400).send('INVALID_PAYLOAD');
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ReliefGrid Secure Server running on http://localhost:${PORT}`);
  });
}

startServer();
