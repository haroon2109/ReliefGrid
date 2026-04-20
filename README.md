# 🌍 ReliefGRID
**AI-Powered Unified Aid Logistics**


*ReliefGRID is an intelligence-driven logistics platform designed to bridge the gap between donors, NGOs, and ground-level field operations. We centralize fragmented data, providing a single source of truth for resource allocation during disasters.*

---

## 🎥 Quick Links for Judges
* **Live MVP:** [Link to working prototype]
* **Pitch Video:** [Link to YouTube demo]
* **Presentation Deck:** [Link to PDF]


---

## 🧭 The Vision: Why We Built This

Traditional disaster relief often suffers from overlapping efforts and neglected "dark spots." 
* **Information Asymmetry:** NGOs often lack real-time local situational awareness.
* **Data Bottlenecks:** Critical cries for help are often trapped in unsearchable WhatsApp voice notes or wet paper surveys.
* **Lack of Transparency:** Donors lose track of where their contributions actually end up.

**ReliefGRID solves this** by automating the ingestion of chaotic field intelligence and providing a real-time, geospatial visual map of exactly who needs what, and where.

---

## 🛠️ Core Capabilities (How It Works)

We built ReliefGRID so NGOs don't have to change their behavior. They keep using WhatsApp and paper, and our AI does the heavy lifting.

### 🎙️ 1. Multimodal Intel Ingestion
*Turning chaotic field noise into organized digital tasks.*
ReliefGRID uses **Google Gemini 1.5 Flash** to instantly extract actionable data from unstructured, messy inputs:
* **Voice-to-Task:** Translates and structures frantic voice notes with regional language support.
* **Paper-to-Digital:** AI-powered OCR digitizes handwritten field surveys instantly.
* **Messaging Integration:** Directly ingests data from WhatsApp and web forms.

### 🧠 2. Smart Matching & Deduplication
*Ensuring maximum efficiency with zero waste.*
* The system automatically flags and deduplicates overlapping aid requests within a **500m radius**.
* It scores every request based on urgency, preventing two delivery trucks from going to the same house while another street gets nothing.

### 🗺️ 3. Geospatial Command Center
*A live bird's-eye view for NGO coordinators.*
* **Proximity Heatmaps:** Visualizes high-demand crisis zones in real-time.
* **Dispatch Tracker:** 5-stage monitoring pipeline (Pending ➔ Picked ➔ In Transit ➔ Near ➔ Delivered).
* **Resource Pins:** Live status mapping of available warehouses and supply points.

### 🔐 4. Transparent Impact Ledger
*Rebuilding trust with donors.*
* **QR Handshake:** A secure, mutual verification loop between delivery drivers and field volunteers.
* **Audit Trail:** A transparent, digital record proving to donors exactly where and when their aid reached its destination.

---

## 🚀 Technology Stack

*(Drop your Architecture Diagram image right here!)*
`![Architecture Diagram](./assets/architecture_diagram.png)`

| Layer | Technology Used |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS, Framer Motion |
| **Mapping** | Leaflet.js, React-Leaflet |
| **Backend** | Express.ts, Node.js |
| **Database** | Firebase Firestore (Real-time NoSQL) |
| **AI Engine** | Google Gemini 1.5 Flash |

---

## 👥 Contributors
Proudly developed by the **ReliefGRID Core Team**:
- **Mohammed Absal** ([@mohammedabsal](https://github.com/mohammedabsal))
- **Haroon** ([@haroon2109](https://github.com/haroon2109))
- **Madhavan** ([@madhavan-366](https://github.com/madhavan-366))

  
---

## 💻 Local Development

Want to run ReliefGRID locally? Follow these steps:

**1. Clone & Install:**
```bash
git clone [https://github.com/haroon2109/ReliefGrid.git](https://github.com/haroon2109/ReliefGrid.git)
cd ReliefGrid
npm install
