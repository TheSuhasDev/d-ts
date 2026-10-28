# Denika & Team Solutions — AI Warehouse Management System (WMS)

An enterprise-grade, intelligent local warehouse operations platform combining **real-time computer vision tool recognition (YOLO)** with hands-free auto-receiving, a **generative AI warehouse assistant (Gemini 2.5 Flash)** with voice & function-calling capabilities, a **Decentralised Intelligence Sentinel Engine** (Demand spikes, slow-moving idle capital, ledger discrepancies, stuck order flow, and 0-100 credit risk scoring), **Direct Customer WhatsApp PDF Tax Invoice delivery with clickable sslip.io links**, **GST compliance with sequential financial-year numbering**, and **role-based inventory & order lifecycle management**.

---

## 1. Project Overview & Brand Identity

* **Brand / Operating Entity**: **Denika & Team Solutions**
* **GSTIN**: `29AABCU9603R1ZM` (Karnataka, India)
* **Registered Address**: Plot 42, Peenya Industrial Area, Phase II, Bengaluru, Karnataka 560058
* **Design Philosophy**: High-contrast, dark-mode cockpit aesthetic tailored for warehouse workstations and rugged tablets with instant visual status indicators, Recharts data analytics, and audible/visual alert drawers.

### Key Capabilities

1. **Hands-Free Computer Vision Auto-Receive (YOLO)**:
   - Detects 5 physical mechanical tool classes: `Drill`, `Hammer`, `Pliers`, `Screwdriver`, and `Wrench`.
   - **Hands-Free Auto-Receive**: Stable detection over consecutive frames automatically receives +1 unit into stock immediately without manual clicking.
   - **Leave-Frame Cooldown & Return Re-trigger**: Once a tool is received, the system waits for the item to leave the camera frame before re-arming. Presenting the tool again automatically increments the count (+1). Switching to a different tool detects and increments immediately.
   - **Undo Buffer**: 5-second undo toast calling `/api/products/undo-receive` allows immediate reversal of accidental scans.
   - **Live HUD Overlay**: Real-time bounding boxes, class badges, and confidence metrics rendered directly over the live camera video stream.
   - **Signed Proxy Architecture**: Browser streams pass through Node.js (`/api/vision/predict`) signed with `X-AI-API-KEY` to prevent direct exposure of the Python vision microservice.

2. **Decentralised Intelligence Sentinel Engine**:
   - 100% deterministic, statistical and rule-based engine running on Express cron (`INTELLIGENCE_CRON`, default `*/15 * * * *`). Zero external LLM latency for warehouse floor surveillance.
   - **5 Sentinel Modules**:
     - `DEMAND_SPIKE`: Computes rolling 30-day $Z$-scores for 24h dispatches. Flags unusual surges ($Z \ge 2.0$ Warning, $Z \ge 3.0$ Critical).
     - `SLOW_STOCK`: Evaluates idle capital ($\text{Stock} \times \text{Cost}$) without movement for $>30\text{d}$ (Warning) or $>60\text{d}$ (Critical).
     - `STOCK_INTEGRITY`: Validates physical recorded stock against the immutable StockMovement ledger ($\text{Opening} + \text{In} - \text{Out}$). Flags discrepancies immediately.
     - `ORDER_FLOW`: Flags stuck pipeline orders (`PROCESSING` $>2\text{d}$, `ADVANCE_RECEIVED` not packed $>2\text{d}$, `PACKED` not dispatched $>3\text{d}$) and manages a 3/7/14-day payment reminder escalation ladder with 48h debouncing.
     - `PAYMENT_RISK`: Computes a 0–100 credit risk score based on outstanding debt, average days to pay, and unpaid order counts. Categorizes customers into `LOW` (30% advance), `MEDIUM` (50% advance), or `HIGH` (70% advance).
   - **Self-Healing / Auto-Resolve**: Resolved insights are automatically marked resolved with timestamp and reason when metrics normalize.

3. **Visual Analytics & Operational Telemetry (Recharts)**:
   - **Stock Valuation & ATP**: Real-time cards for Total Valuation (₹), On-Hand Stock, Allocated/Reserved units, and Available to Promise (ATP).
   - **30-Day Dispatch Velocity**: Interactive area chart showing daily dispatch quantities across the past 30 days with peaks and trends.
   - **Fast Movers vs Slow Movers**: Dual bar charts ranking top fast-moving items against stagnant items.
   - **Orders by Status**: Donut breakdown of current pipeline stages (`PROCESSING`, `ADVANCE_RECEIVED`, `PACKED`, `DISPATCHED`, `CANCELLED`).
   - **Overdue Payment Ageing**: Categorized payment exposure buckets (0–3d, 4–7d, 8–14d, 15+d).

4. **GST Tax Invoices & Sequential FY Numbering**:
   - Sequential, gap-free financial year numbering backed by atomic Mongoose `Counter` documents: `ORD/26-27/0001`, `INV/26-27/0001`, `CN/26-27/0001`.
   - Professional A4 PDF generation using `pdfkit`: includes company header, customer billing details, HSN/SAC table, CGST/SGST breakdown, payment receipt ledger, bank details, and dynamic UPI QR code.

5. **Direct Customer WhatsApp Delivery & Clickable Links**:
   - **Direct-to-Customer Deep Link**: Automatically targets the exact customer phone number recorded during billing (`https://api.whatsapp.com/send?phone=...`), eliminating manual contact selection.
   - **Clickable PDF Links with `sslip.io`**: Resolves local LAN addresses into public-resolving hostnames (`http://<LAN_IP>.sslip.io:5000/api/orders/public/.../invoice.pdf`), enabling WhatsApp to render active blue clickable preview links on mobile and desktop.
   - **Tier 1 WhatsApp Cloud API**: Headless server-to-server PDF dispatch when Meta Cloud API credentials are configured.
   - **Public Unauthenticated Invoice Preview**: Customers can click the link to view/print their official invoice PDF without logging into the warehouse system.

6. **Unified Predictive Restock & AI Assistant**:
   - **Single Source of Truth**: Both the **Smart Reorder** screen and the **AI Assistant** (`get_reorder_suggestions` tool) share identical calculation logic in `reorderService.js` (accounting for lead times, minimum order quantities, and reserved stock).
   - **Conversational Assistant (Gemini 2.5 Flash)**: Supports voice queries (Web Speech API), live DB stock lookups, customer credit risk evaluations, and human-in-the-loop staged payment actions with 5-minute TTL.

---

## 2. Architecture Diagram

```text
                                  ┌─────────────────────────────────────────┐
                                  │   React 19 + TypeScript + Vite Frontend │
                                  │   - Tailwind CSS v4 & Framer Motion     │
                                  │   - Recharts Visualizations Cockpit     │
                                  │   - Hands-Free YOLO Auto-Receive HUD    │
                                  │   - WhatsApp Direct Deep-Link Dispatch  │
                                  │   http://localhost:5173                 │
                                  └───────────────┬─────────────────┬───────┘
                                                  │                 │
                           Signed REST API / JWT  │                 │ Proxy Vision Stream
                                                  ▼                 ▼
               ┌────────────────────────────────────────────────────────────────────────┐
               │ Node.js 22 + Express 5 Backend (PORT 5000)                             │
               │ - JWT Auth & Role-Based Access Control (ADMIN vs STAFF)                │
               │ - Decentralised Intelligence Sentinel Engine (5 Modules)               │
               │ - Sequential Gap-Free FY Numbering (Counter Service)                   │
               │ - PDFKit Tax Invoice Generator & Dynamic UPI QR Codes                  │
               │ - Public Invoice Endpoint + sslip.io Clickable Link Generator          │
               │ - Unified Reorder Service (Smart Reorder + Gemini Tool Calling)        │
               │ - Gemini 2.5 Flash Tool-Calling Engine + Live DB Fallback              │
               │ - Express 5 In-Place Query Sanitization & Rate Limiting                │
               └─────────────────────┬────────────────────────────────────┬─────────────┘
                                     │                                    │
                     Mongoose 9 ODM  ▼                                    ▼ Proxy Header Auth
               ┌───────────────────────────────────────────┐    ┌───────────────────────────────┐
               │ MongoDB (Replica Set mode active)         │    │ FastAPI + Ultralytics YOLO    │
               │ - products, customers, orders, payments   │    │ - 5 Tool Classes: Drill,      │
               │ - stockmovements, insights, counters      │    │   Hammer, Pliers, Screwdriver,│
               │ - pendingactions (5-min TTL)              │    │   Wrench                      │
               │ mongodb://localhost:27017?replicaSet=rs0  │    │ http://127.0.0.1:8001         │
               └───────────────────────────────────────────┘    └───────────────────────────────┘
```

---

## 3. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Framer Motion 14, Recharts 3, Tabler Icons, Lucide React, Base UI (`@base-ui/react`), Vitest 4 |
| **Backend API** | Node.js 22, Express 5, Mongoose 9, MongoDB 7/8 Replica Set, PDFKit, Sharp, QRCode, Node-Cron, Pino, Zod, Helmet, Express-Rate-Limit, Jest 30 |
| **Computer Vision** | Python 3.10+, FastAPI, Uvicorn, Ultralytics YOLO, PyTorch, Pillow |
| **Database** | MongoDB Atlas / Local Replica Set (Mongoose 9) |

---

## 4. Quick Start (No Docker Needed)

You do **not** need Docker to run this project. You can run all 3 services natively on your machine:

### Option A: 1-Click Launch (Windows)
Double-click [`start-all.bat`](file:///c:/Users/suhas/Desktop/ai-w-s-main/start-all.bat) or run from your terminal:
```cmd
start-all.bat
```
This automatically launches all 3 services in separate terminal windows.

### Option B: Run in Separate Terminals

1. **AI Vision Service (Port 8001)**:
   ```bash
   cd ai-model
   .venv\Scripts\activate
   uvicorn api:app --host 127.0.0.1 --port 8001
   ```

2. **Express Backend (Port 5000)**:
   ```bash
   cd backend
   npm run dev
   ```

3. **React Frontend (Port 5173)**:
   ```bash
   cd frontend/warehouse-system
   npm run dev
   ```

Access the services:
* **Frontend Web App**: [http://localhost:5173](http://localhost:5173)
* **Backend REST API**: [http://localhost:5000/api](http://localhost:5000/api)
* **Backend Health & Network Discovery**: [http://localhost:5000/api/health](http://localhost:5000/api/health)
* **Vision Service Health**: [http://127.0.0.1:8001/health](http://127.0.0.1:8001/health)

---

## 5. Local Development Setup (Manual)

### Prerequisites
* **Node.js**: v20+ / v22+
* **Python**: v3.10+
* **MongoDB**: MongoDB Atlas (already configured in `backend/.env`) or a local MongoDB replica set

### Step 1: Clone and Configure Environment Files
```bash
# Backend
cd backend
cp .env.example .env

# Frontend
cd ../frontend/warehouse-system
cp .env.example .env

# AI Model
cd ../../ai-model
cp .env.example .env
```

### Step 2: Start MongoDB Replica Set
For local MongoDB installations, start `mongod` with replica set enabled:
```bash
mongod --replSet rs0 --dbpath /data/db
```
Initiate the replica set in `mongosh`:
```javascript
rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] });
```

### Step 3: Install & Start YOLO AI Vision Service
```bash
cd ai-model
python -m venv .venv

# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn api:app --host 127.0.0.1 --port 8001
```

### Step 4: Install & Seed Backend
```bash
cd ../backend
npm install

# Seed realistic warehouse data (5 products, 30 days of movements, orders, customers):
npm run seed:realistic

# Start backend dev server:
npm run dev
```

### Step 5: Install & Start Frontend
```bash
cd ../frontend/warehouse-system
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 6. Seed Credentials & Demo Mode

When `VITE_DEMO_MODE=true` is set, pre-filled credential chips appear on the login screen for testing:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@warehouse.local` | `adminpassword123` | Full Access: Catalog, Manual Stock Adjustments, Acknowledge/Resolve Insights, Financial Confirmations |
| **Staff** | `staff@warehouse.local` | `staffpassword123` | Operations: Hands-Free Camera Receive, Order Packing & Dispatch, Payment Entry, Reading Inventory & Insights |

*Note: In production (`VITE_DEMO_MODE=false`), demo chips are hidden, and users with `mustChangePassword: true` are prompted to change their temporary credentials.*

---

## 7. Product Catalog & Tool Classes

The system is pre-configured for 5 mechanical hardware tool classes:

| Tool | SKU | Category | HSN Code | GST % | Default Location | Lead Time | Min Order Qty (MOQ) |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: | :---: |
| **Drill** | `DRL001` | Power Tools | `8467` | 18% | Bay A - Shelf 01 | 5 days | 10 units |
| **Hammer** | `HAM001` | Hand Tools | `8205` | 18% | Bay A - Shelf 02 | 3 days | 15 units |
| **Pliers** | `PLR001` | Hand Tools | `8203` | 18% | Bay B - Shelf 01 | 4 days | 12 units |
| **Screwdriver** | `SCR001` | Hand Tools | `8205` | 18% | Bay B - Shelf 02 | 2 days | 20 units |
| **Wrench** | `WRN001` | Hand Tools | `8204` | 18% | Bay C - Shelf 01 | 4 days | 10 units |

---

## 8. Role-Based Access Control (RBAC) Matrix

| Feature / Endpoint | Method | Route | STAFF | ADMIN |
| :--- | :---: | :--- | :---: | :---: |
| Authenticate / Login | `POST` | `/api/auth/login` | ✅ | ✅ |
| Change Password | `POST` | `/api/auth/change-password` | ✅ | ✅ |
| System Health & Network Info | `GET` | `/api/health` | ✅ | ✅ |
| List Products & Stock | `GET` | `/api/products` | ✅ | ✅ |
| Stock Movements History | `GET` | `/api/products/movements` (or `/history`) | ✅ | ✅ |
| Unified Reorder Suggestions | `GET` | `/api/products/reorder-suggestions` | ✅ | ✅ |
| Camera Vision Inference | `POST` | `/api/vision/predict` | ✅ | ✅ |
| Camera Undo Receive (+1 Reversal) | `POST` | `/api/products/undo-receive` | ✅ | ✅ |
| Update Product Metadata | `PUT` | `/api/products/:id` | ❌ | ✅ |
| Manual Stock Adjustment | `POST` | `/api/products/:id/adjust-stock` | ❌ | ✅ |
| Create Order / Dispatch | `POST` | `/api/orders` | ✅ | ✅ |
| View Orders & Pipeline | `GET` | `/api/orders` | ✅ | ✅ |
| Update Order (Pack, Cancel, Return) | `PATCH` | `/api/orders/:id/*` | ✅ | ✅ |
| Generate Tax Invoice PDF (Auth) | `GET` | `/api/orders/:id/invoice.pdf` | ✅ | ✅ |
| Public Clickable Invoice PDF | `GET` | `/api/orders/public/:invoiceNumber/invoice.pdf` | ✅ | ✅ |
| Send WhatsApp Cloud Invoice | `POST` | `/api/orders/:id/send-invoice-whatsapp` | ✅ | ✅ |
| Record Customer Payment | `POST` | `/api/payments` | ✅ | ✅ |
| View Sentinel Insights | `GET` | `/api/insights` | ✅ | ✅ |
| Acknowledge Insight | `PATCH` | `/api/insights/:id/ack` | ❌ | ✅ |
| Resolve Insight | `PATCH` | `/api/insights/:id/resolve` | ❌ | ✅ |
| Trigger Manual Intelligence Run | `POST` | `/api/insights/run` | ❌ | ✅ |
| Confirm AI Assistant Action | `POST` | `/api/assistant/pending-actions/confirm` | ❌ | ✅ |

---

## 9. Decentralised Intelligence Engine Formulas

### 1. Demand Spike ($Z$-Score)
Calculates the standard score of dispatches in the past 24 hours against the 30-day baseline:
$$\mu = \frac{1}{N} \sum_{i=1}^N x_i, \quad \sigma = \sqrt{\frac{1}{N} \sum_{i=1}^N (x_i - \mu)^2}$$
$$Z = \frac{x_{\text{today}} - \mu}{\sigma}$$
* **Warning**: $Z \ge 2.0$ (Significant surge)
* **Critical**: $Z \ge 3.0$ (Severe spike)

### 2. Slow-Moving Stock Valuation
Identifies products with zero dispatches over an extended period:
$$\text{Idle Capital} = \text{Stock on Hand} \times \text{Purchase Price}$$
* **Warning**: Inactive for $\ge 30$ days
* **Critical**: Inactive for $\ge 60$ days

### 3. Stock Integrity Ledger Reconciliation
Reconciles physical on-hand stock with the sequential movement ledger:
$$\text{Expected Stock} = \text{Opening Stock} + \sum \text{RECEIVE} + \sum \text{RETURN} - \sum \text{DISPATCH} - \sum \text{ADJUST\_REDUCE}$$
$$\text{Discrepancy} = \text{Recorded Stock} - \text{Expected Stock}$$
* If $\text{Discrepancy} \ne 0$, an insight is generated with the exact unit shortage/surplus.

### 4. Customer Credit Risk Scoring (0 – 100)
Evaluates credit exposure across 3 dimensions:
1. **Outstanding Balance ($B$)**: $\min\left(40, \frac{\text{Total Balance}}{50,000} \times 40\right)$
2. **Payment Delay ($D$)**: $\min\left(35, \frac{\text{Average Days to Pay}}{30} \times 35\right)$
3. **Unpaid Orders ($U$)**: $\min\left(25, \text{Unpaid Count} \times 8.33\right)$
$$\text{Risk Score} = \min(100, B + D + U)$$
* **LOW (0 – 34)**: Standard 30% advance required.
* **MEDIUM (35 – 69)**: 50% advance suggested.
* **HIGH (70 – 100)**: 70% advance mandatory, warning displayed during dispatch.

---

## 10. Running Automated Tests

### Backend Unit & Integration Tests (Jest)
Tests cover RBAC, sequential numbering, payment calculations, reorder suggestions, order state machine, and intelligence mathematics:
```bash
cd backend
npm test
```
*Expected: 6 test suites, 31 passed.*

### Frontend Tests (Vitest)
Tests cover currency formatting, date utilities, phone validation, and WhatsApp message/link builders:
```bash
cd frontend/warehouse-system
npm test
```
*Expected: 2 test suites, 9 passed.*

### Type-Checking & Production Bundling
```bash
cd frontend/warehouse-system
npx tsc --noEmit
npm run build
```

---

## 11. Environment Variable Reference

### Backend (`backend/.env`)

| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `PORT` | `5000` | Express HTTP server port |
| `MONGO_URI` | `mongodb://localhost:27017/warehouse?replicaSet=rs0` | MongoDB connection string (Replica set required for transactions) |
| `JWT_SECRET` | `secret_key_at_least_16_chars` | Secret key for signing user session JWTs |
| `JWT_EXPIRES_IN` | `8h` | Token expiration duration |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origins |
| `GEMINI_API_KEY` | `your_gemini_api_key` | Google Gemini API key for assistant |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Primary Gemini model |
| `GEMINI_FALLBACK_MODELS`| `gemini-1.5-flash,gemini-2.0-flash` | Fallback models on quota exhaustion |
| `AI_API_URL` | `http://127.0.0.1:8001` | FastAPI YOLO service endpoint |
| `AI_API_KEY` | `shared_secret` | Secret key sent in `X-AI-API-KEY` header |
| `INTELLIGENCE_CRON` | `*/15 * * * *` | Frequency of decentralized surveillance cycles |
| `DEMAND_SPIKE_Z_WARN` | `2.0` | Z-score warning threshold |
| `DEMAND_SPIKE_Z_CRIT` | `3.0` | Z-score critical threshold |
| `SLOW_STOCK_WARN_DAYS`| `30` | Days without dispatches for warning |
| `SLOW_STOCK_CRIT_DAYS`| `60` | Days without dispatches for critical |
| `COMPANY_NAME` | `Denika & Team Solutions` | Legal company name on invoices |
| `COMPANY_GSTIN` | `29AABCU9603R1ZM` | Official GSTIN |
| `COMPANY_ADDRESS` | `Plot 42, Peenya Industrial Area...` | Official billing address |
| `UPI_VPA` | `denikasolutions@upi` | UPI Virtual Payment Address for QR code |
| `WHATSAPP_CLOUD_API_ENABLED` | `false` | Enable/disable direct Cloud API delivery |

### Frontend (`frontend/warehouse-system/.env`)

| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:5000/api` | Backend base API URL |
| `VITE_DEMO_MODE` | `true` | Show/hide demo login chips and preset quick actions |
| `VITE_AI_CONFIDENCE` | `0.70` | Default YOLO confidence filter threshold |
| `VITE_AI_STABLE_FRAMES` | `3` | Required consecutive frames before detection triggers |

---

## 12. Maintenance & Troubleshooting

* **MongoDB Replica Set Warning**: If running a standalone MongoDB instance, transactions fallback to atomic single-document updates. To enable multi-document transactions, run `rs.initiate()` in `mongosh`.
* **Clickable WhatsApp Links on Mobile**: WhatsApp requires a valid domain or dotted IPv4 address (e.g. `192.168.1.X` or `.sslip.io`). `localhost` is ignored by WhatsApp's link detector. The server automatically generates a `.sslip.io` hostname to ensure clickable links for mobile customers.
* **Camera Not Detecting**: Ensure `ai-model` is running on port 8001 and `AI_API_KEY` matches between `backend/.env` and `ai-model/.env`.
* **Dispatch Velocity Graph Zero Line**: Ensure `/api/products/movements` is reachable and authenticated. The frontend includes automatic fallback to `/api/products/movements/history`.

---

© 2026 Denika & Team Solutions. All rights reserved.
