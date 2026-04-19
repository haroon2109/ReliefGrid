# 🚀 ReliefGRID: Final Deployment & Handover Guide

ReliefGRID is now a fully integrated, AI-powered disaster response logistics platform. This guide explains how the four core modules interact and how to deploy them to production.

## 🏗️ System Architecture

1. **Intake (Python Cloud Function)**: Multimodal ingestion (Gemini 1.5 Flash) processes surveys/voice notes and saves them to Firestore.
2. **Brain (Node.js Cloud Function)**: Smart Matching Engine handles deduplication (500m radius) and priority scoring.
3. **Command (React Dashboard)**: High-precision Geo-Heatmaps and NGO approval feed.
4. **Execution (QR Scanner)**: Field volunteer verification loop with a transparent impact ledger.

---

## 📦 Deployment Instructions

### 1. Cloud Function: AI Ingestion
Located in `functions/aid_ingestion/`.
- **Trigger**: GCS bucket `OBJECT_FINALIZE`.
- **Runtime**: Python 3.10.
- **Environment Variables**:
  - `GOOGLE_MAPS_API_KEY`: Required for geocoding area names to GPS coordinates.
- **Commands**:
```bash
gcloud functions deploy handle_aid_ingestion \
  --runtime python310 \
  --trigger-resource [YOUR_BUCKET_NAME] \
  --trigger-event google.storage.object.finalize \
  --entry-point handle_aid_ingestion \
  --set-env-vars GOOGLE_MAPS_API_KEY=your_key
```

### 2. Cloud Function: Matching Engine
Located in `functions/matching_engine/`.
- **Trigger**: Firestore document onCreate in `aid_requests`.
- **Runtime**: Node.js 18.
- **Commands**:
```bash
gcloud functions deploy processMatching \
  --runtime nodejs18 \
  --trigger-event providers/cloud.firestore/eventTypes/document.create \
  --trigger-resource "projects/[PROJECT_ID]/databases/(default)/documents/aid_requests/{requestId}" \
  --entry-point processMatching
```

### 3. Frontend: React Dashboard
Ensure your `.env` file contains the following (no longer shows "Demo Mode" warning):
```env
VITE_GOOGLE_MAPS_API_KEY=your_key
VITE_GEMINI_API_KEY=your_key
# Firebase Config
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

---

## 🛡️ Transparency & Verification Flow

1. **NGO Dispatch**: Approved requests generate a QR code in the **Operations Tracker**.
2. **Volunteer Verification**: Field workers use the mobile-optimized **QR Scanner** (`/verify` or `QRScanner.tsx`) to scan the driver's code on-site.
3. **Status Update**: Firestore status flips to `delivered` automatically.
4. **Audit**: All actions are immutably logged to the `ledger` collection for donor transparency.

## 🏆 Presentation Highlights for Judges
- **Gemini NLP**: Show it extracting "5 boxes of water" from a Tamil voice note.
- **Heatmap**: Demonstrate the real-time demand saturation (Red/Orange zones).
- **Matching Efficiency**: Highlight the 500m radius deduplication to prevent resource waste.
- **Sustainable Budget**: Emphasize the use of client-side logic to stay within the ₹12,000 budget.

**ReliefGRID is ready for field deployment. Good luck with the Hackathon!**
