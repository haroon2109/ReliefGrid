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
  console.warn('[FIREBASE WARNING] Could not initialize Firebase Admin');
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = process.env.PORT || 8080;

  let db: any;
  try {
    db = getFirestore(getApp(), firebaseConfig.firestoreDatabaseId);
  } catch (e) {
    console.warn('[FIREBASE WARNING] Firestore could not be initialized.');
  }

  // Security Headers
  app.use(helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:", "blob:", "https:", "http:"],
        "script-src": ["'self'", "'unsafe-inline'", "https://*.google.com", "https://*.googleapis.com", "https://*.gstatic.com"],
        "connect-src": ["'self'", "https:", "wss:", "http:", "ws:"],
        "frame-src": ["'self'", "https://*.google.com", "https://*.firebaseapp.com"],
        "worker-src": ["'self'", "blob:"],
      },
    },
    frameguard: false,
  }));

  app.use(morgan('combined'));
  app.use(express.json());

  const distPath = path.join(process.cwd(), 'dist');

  // Serve static assets with long-term caching
  app.use('/assets', express.static(path.join(distPath, 'assets'), {
    maxAge: '1y',
    immutable: true,
    fallthrough: false
  }));

  // Serve other static files
  app.use(express.static(distPath, { index: false }));

  // WhatsApp Webhook (simplified restoration)
  app.post('/api/whatsapp-webhook', async (req, res) => {
    // Original logic here...
    res.status(200).send('EVENT_RECEIVED');
  });

  // Catch-all for SPA
  app.get('*', (req, res) => {
    if (req.path.startsWith('/assets/')) {
      return res.status(404).send('Asset not found');
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Not Found');
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ReliefGrid] Server listening on port ${PORT}`);
  });
}

startServer();
