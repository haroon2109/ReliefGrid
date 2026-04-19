# ReliefGRID 🌐
### Precision Logistics for Crisis Coordination & Disaster Response

ReliefGRID is an intelligence-driven logistics platform designed to bridge the gap between donors, NGOs, and ground-level field operations. In the chaos of a disaster, data fragmentation is the greatest barrier to aid. ReliefGRID centralizes this data, providing a single source of truth for resource allocation.

---

## 🧭 The "Why"
Traditional disaster relief often suffers from overlapping efforts and "dark spots" where aid never reaches. 
- **Information Asymmetry**: NGOs often don't know what is happening two blocks away.
- **Data Ingestion Bottlenecks**: Important needs are trapped in messy WhatsApp voice notes, paper surveys, and disparate spreadsheets.
- **Lack of Transparency**: Donors often lose track of where their contributions end up.

ReliefGRID solves this by automating the ingestion of field intel and providing real-time geospatial visualization of demand saturation.

---

## 🛠️ The "What": Core Capabilities

### 1. Multimodal Intel Ingestion
ReliefGRID uses advanced NLP to extract actionable data (e.g., "5 boxes of water needed at Sector 4") from unstructured inputs:
- **Voice-to-Task**: Processing voice notes (supporting regional languages like Tamil).
- **Paper-to-Digital**: OCR for handwritten field surveys.
- **Messaging Integration**: Direct ingestion from WhatsApp and field reports.

### 2. Smart Matching & Deduplication
The "Brain" of ReliefGRID automatically deduplicates aid requests within a 500m radius and scores them based on urgency, preventing resource waste and ensuring critical needs are prioritized.

### 3. Geospatial Demand Center
A high-precision Leaflet-based command center featuring:
- **Proximity Heatmaps**: Visualizing high-demand zones in real-time.
- **Dispatch Tracker**: Monitoring drones and trucks in the field.
- **Resource Pins**: Live status of warehouses and supply points.

### 4. Transparent Impact Ledger
Every delivery is logged to an immutable ledger. 
- **QR Handshake**: Verification loop between drivers and field volunteers.
- **Cryptographic Audit**: A transparent record for donors to verify that their aid reached the intended destination.

---

## 🚀 Technology Stack
- **Frontend**: React 19, Vite, Tailwind CSS, Framer Motion
- **Maps**: Leaflet.js, React-Leaflet
- **Backend/Server**: Express.ts, TSX
- **Database & Auth**: Firebase Firestore, Firebase Authentication
- **AI/Intelligence**: Gemini 1.5 Flash (Extracting structured data from multimodal inputs)
- **Field Ops**: QR Scanner (HTML5-QRCode), Zod Validation

---

## 👥 Contributors
Proudly built for the smart logistics community by:
- **Mohammed Absal** ([github.com/mohammedabsal](https://github.com/mohammedabsal))
- **Madhavan** ([github.com/madhavan-366](https://github.com/madhavan-366))
- **Haroon** ([github.com/haroon2109](https://github.com/haroon2109))

---

## 💻 Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   Create a `.env` file with your keys:
   ```env
   VITE_FIREBASE_API_KEY=your_key
   VITE_GEMINI_API_KEY=your_key
   VITE_GOOGLE_MAPS_API_KEY=your_key
   ```

3. **Launch Dashboard**:
   ```bash
   npm run dev
   ```

---
*For full deployment instructions, see [DEPLOYMENT_GUIDE_FINAL.md](./DEPLOYMENT_GUIDE_FINAL.md).*
