# ReliefGRID 
###  AI-Powered Unified Aid Logistics


**ReliefGRID** is an intelligence-driven logistics platform designed to bridge the gap between donors, NGOs, and ground-level field operations. ReliefGRID centralizes fragmented data, providing a single source of truth for resource allocation during disasters.

---

## 🧭 The Vision
Traditional disaster relief often suffers from overlapping efforts and "dark spots." 
- **Information Asymmetry**: NGOs often lack local situational awareness.
- **Data Ingestion Bottlenecks**: Critical needs are often trapped in voice notes or paper surveys.
- **Lack of Transparency**: Donors lose track of where contributions end up.

ReliefGRID solves this by **automating field intel ingestion** and providing **real-time geospatial visualization** of demand saturation.

---

## 🛠️ Core Capabilities

### 🎙️ Multimodal Intel Ingestion
ReliefGRID uses **Gemini 1.5 Flash** to extract actionable data from unstructured inputs:
- **Voice-to-Task**: Processing voice notes with regional language support.
- **Paper-to-Digital**: AI-powered OCR for handwritten field surveys.
- **Messaging Integration**: Direct ingestion from WhatsApp and field reports.

### 🧠 Smart Matching & Deduplication
Automatically deduplicates aid requests within a 500m radius and scores them based on urgency, preventing resource waste.

### 🗺️ Geospatial Command Center
- **Proximity Heatmaps**: Visualizing high-demand zones in real-time.
- **Dispatch Tracker**: 5-stage monitoring (Pending -> Picked -> In Transit -> Near -> Delivered).
- **Resource Pins**: Live status of warehouses and supply points.

### 🔐 Transparent Impact Ledger
- **QR Handshake**: Mutual verification loop between drivers and field volunteers.
- **Audit Trail**: A transparent record for donors to verify their aid reached its destination.

---

## 🚀 Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS, Framer Motion |
| **Mapping** | Leaflet.js, React-Leaflet |
| **Backend** | Express.ts, Node.js |
| **Database** | Firebase Firestore |
| **AI Engine** | Google Gemini 1.5 Flash |

---

## 👥 Contributors
Proudly developed by the **ReliefGRID Core Team**:
- **Mohammed Absal** ([@mohammedabsal](https://github.com/mohammedabsal))
- **Madhavan** ([@madhavan-366](https://github.com/madhavan-366))
- **Mohamed A Haroon** ([@haroon2109](https://github.com/haroon2109))

---

## 💻 Local Development

1. **Clone & Install**:
   ```bash
   git clone https://github.com/haroon2109/ReliefGrid.git
   cd ReliefGrid
   npm install

