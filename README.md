# Denika & Team Solutions — AI Warehouse Management System (WMS)

![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7.0%2B-47A248?logo=mongodb&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)
![Ultralytics YOLO](https://img.shields.io/badge/YOLO-Ultralytics-00FFFF?logo=yolo&logoColor=black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688?logo=fastapi&logoColor=white)

An enterprise-grade, local hardware warehouse operations system combining real-time YOLO computer vision auto-receiving, a 6-module statistical Sentinel intelligence engine, GST tax invoice generation with gap-free sequential financial year numbering, direct customer WhatsApp delivery, and a Gemini conversational voice assistant.

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Screenshots](#2-screenshots)
- [3. Features](#3-features)
- [4. Architecture](#4-architecture)
- [5. Technology Stack](#5-technology-stack)
- [6. Project Structure](#6-project-structure)
- [7. Installation & Setup](#7-installation--setup)
- [8. Environment Variables](#8-environment-variables)
- [9. Demo Credentials & RBAC](#9-demo-credentials--rbac)
- [10. Usage Guide](#10-usage-guide)
- [11. API Reference](#11-api-reference)
- [12. Decentralised Sentinel Intelligence Engine](#12-decentralised-sentinel-intelligence-engine)
- [13. Testing](#13-testing)
- [14. Troubleshooting](#14-troubleshooting)
- [15. Roadmap](#15-roadmap)
- [16. Contributing](#16-contributing)
- [17. License & Author](#17-license--author)

---

## 1. Overview

### Problem
Hardware tool warehouses handle high-frequency dispatches and physical inwards without dedicated barcode scanners or fixed POS hardware. Manual physical counting causes stock ledger discrepancies, billing errors, delayed payment collections, and missed reorder thresholds on capital-intensive inventory.

### Solution
**Denika & Team Solutions AI WMS** delivers a local cockpit for hardware distribution:
- **Vision-Driven Inward**: Standard webcam streams pass through an Ultralytics YOLO model to automatically increment stock count with leave-frame cooldown and accidental scan undo buffers.
- **Sentinel Rule Engine**: Scheduled background crons compute demand spike $Z$-scores, calculate dead inventory idle capital, verify physical stock against immutable movement logs, and evaluate customer credit risk.
- **GST & Direct WhatsApp Invoicing**: Atomic sequential numbering generates PDF tax invoices with UPI QR codes, automatically deep-linking to the customer's WhatsApp phone number with clickable `sslip.io` links.
- **Gemini Assistant**: Conversational assistant with function calling executes live catalog searches, checks credit risk, and stages payment updates requiring admin confirmation.

### Target Users
- **Warehouse Floor Staff**: Hands-free camera intake, order packing, stock dispatch, invoice dispatch via WhatsApp.
- **Warehouse Supervisors & Administrators**: Manual inventory adjustments, catalog pricing/image management, insight resolutions, and commercial financial approvals.

---

## 2. Screenshots

Add the following interface captures to [`docs/screenshots/`](file:///c:/Users/suhas/Desktop/ai-w-s-main/docs/screenshots/):

| View | Screenshot File Path | Description |
| :--- | :--- | :--- |
| **Operations Dashboard** | `docs/screenshots/dashboard.png` | Real-time valuation cards, ATP metrics, and Recharts telemetry |
| **YOLO Camera Receive** | `docs/screenshots/camera-receive.png` | Live video HUD with bounding boxes, confidence badges, and leave-frame cooldown |
| **Order Pipeline** | `docs/screenshots/order-lifecycle.png` | Order progression stages (`PROCESSING` $\rightarrow$ `PACKED` $\rightarrow$ `DISPATCHED`) |
| **GST Tax Invoice** | `docs/screenshots/tax-invoice.png` | Formatted A4 PDF invoice featuring UPI QR code and CGST/SGST ledger |
| **Gemini Voice Assistant** | `docs/screenshots/ai-assistant.png` | Voice-driven chat panel executing function calls and staging payments |
| **Sentinel Drawer** | `docs/screenshots/sentinel-insights.png` | 6-module alert drawer displaying demand surges and stock integrity flags |

---

## 3. Features

### Computer Vision Auto-Receive (YOLO)
- **5 Physical Tool Classes**: Detects `Drill`, `Hammer`, `Pliers`, `Screwdriver`, and `Wrench`.
- **Hands-Free Auto-Increment**: Consistent detection across consecutive frames (`VITE_AI_STABLE_FRAMES`, default `3`) automatically receives $+1$ unit.
- **Leave-Frame Cooldown & Return Re-trigger**: Cooldown arms once an item is received, requiring the item to clear the camera bounding frame before registering subsequent units.
- **Undo Toast Buffer**: 5-second undo toast immediately calls `POST /api/products/:id/undo-receive` to reverse accidental scans.
- **Signed Backend Proxy**: Browser camera frames pass through `POST /api/vision/predict` authorized with `X-AI-API-KEY`.

### Decentralised Intelligence Sentinel Engine
- **Deterministic Surveillance**: Node-cron (`INTELLIGENCE_CRON`, default `*/15 * * * *`) executes 6 statistical modules without external LLM latency.
- **Demand Surge ($Z$-Score)**: Calculates rolling 30-day mean ($\mu$) and standard deviation ($\sigma$) to flag dispatches exceeding $Z \ge 2.0$ (Warning) and $Z \ge 3.0$ (Critical).
- **Idle Capital Calculation**: Identifies zero-movement stock exceeding 30 days (Warning) or 60 days (Critical), calculating frozen monetary capital.
- **Stock Integrity Reconciliation**: Compares current recorded stock against the immutable `StockMovement` ledger ($\text{Opening} + \text{In} - \text{Out}$).
- **Order Pipeline & Payment Ladder**: Monitors orders stuck in `PROCESSING` ($>2\text{d}$), `ADVANCE_RECEIVED` ($>2\text{d}$), or `PACKED` ($>3\text{d}$), managing a 3/7/14-day reminder ladder with 48-hour debouncing.
- **Customer Credit Risk Scoring**: 0–100 risk score determining advance payment terms ($30\%$, $50\%$, or $70\%$).

### GST Billing & WhatsApp Delivery
- **Sequential FY Numbering**: Gap-free sequence backed by atomic Mongoose `Counter` documents (`ORD/26-27/0001`, `INV/26-27/0001`, `CN/26-27/0001`).
- **PDFKit Tax Invoices**: Generates printable invoices with HSN/SAC breakdowns, Karnataka CGST/SGST vs Interstate IGST logic, bank details, and dynamic UPI QR codes.
- **Direct WhatsApp Deep-Linking**: Opens WhatsApp pre-targeted to customer phone (`api.whatsapp.com/send?phone=...`) with pre-composed billing messages.
- **`sslip.io` LAN Link Generation**: Converts local network IP addresses into public hostnames (`http://<LAN_IP>.sslip.io:5000/api/orders/public/.../invoice.pdf`) so mobile WhatsApp renders active clickable preview links.
- **Cloud API Headless Dispatch**: Server-to-server PDF invoice dispatch when Meta Cloud API credentials are provided.

### Predictive Restock & AI Assistant
- **Single Source of Truth Reordering**: Shared formula in `reorderService.js` calculates Winsorized burn rates, lead times, safety stocks, and Minimum Order Quantity (MOQ) rounding.
- **Gemini Assistant Integration**: Supports Web Speech API voice input, real-time catalog queries, customer risk lookups, and staged payment confirmations with a 5-minute TTL.

---

## 4. Architecture

```
                      ┌──────────────────────────────────────────────┐
                      │   React 19 + TypeScript + Vite Frontend      │
                      │   - Dark-mode Cockpit (Tailwind CSS v4)      │
                      │   - Live Camera Auto-Receive HUD             │
                      │   - Recharts Visualizations & Audio Cues     │
                      │   Runs on: http://localhost:5173             │
                      └──────────────┬──────────────────┬────────────┘
                                     │                  │
                JWT-Authenticated    │                  │ Signed Proxy
                REST API Calls       │                  │ Multipart Stream
                                     ▼                  ▼
       ┌────────────────────────────────────────────────────────────────────────┐
       │ Node.js 22 + Express 5 Backend (PORT 5000)                             │
       │ - Role-Based Access Control (STAFF vs ADMIN)                           │
       │ - Express 5 Query Sanitization & Rate Limiting                         │
       │ - Sentinel Engine (6 Node-Cron Modules)                                │
       │ - Gap-Free Sequential FY Counter Service                               │
       │ - PDFKit Tax Invoice & Dynamic UPI QR Generator                        │
       │ - Local IP Network Discovery (sslip.io link generation)                │
       └──────────────┬───────────────────┬─────────────────────┬───────────────┘
                      │                   │                     │
      Mongoose 9 ODM  ▼                   │ Signed Header       │ Google GenAI SDK
┌─────────────────────────────────┐       │ (X-AI-API-KEY)      ▼
│ MongoDB Replica Set             │       ▼       ┌─────────────────────────────┐
│ - Local or MongoDB Atlas        │ ┌───────────┐ │ Gemini Assistant            │
│ - Products, Orders, Movements,  │ │ Python    │ │ - Gemini 2.5 Flash          │
│   Customers, Insights, Counters │ │ FastAPI   │ │ - Real-Time Tool Calling    │
│ - Multi-Document Transactions   │ │ + YOLO    │ │ - Staged Payment Actions    │
└─────────────────────────────────┘ │ Port 8001 │ └─────────────────────────────┘
                                    └───────────┘
```

---

## 5. Technology Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `^19.2.8` | Component architecture |
| **Build Tool** | Vite | `^8.3.0` | Development server and bundler |
| **Language** | TypeScript | `^7.0.2` | Static type safety |
| **Styling** | Tailwind CSS | `^4.3.3` | Utility-first responsive dark cockpit theme |
| **Motion** | Framer Motion | `^14.0.0` | Modals, drawers, and status transitions |
| **Charts** | Recharts | `^3.10.1` | Valuation, velocity, and ageing charts |
| **Icons** | Tabler Icons / Lucide | `^3.49` / `^1.54` | User interface iconography |
| **Backend Runtime** | Node.js | `>=20.x` (v22 tested) | Server execution environment |
| **API Framework** | Express | `^5.2.1` | REST endpoints and middleware |
| **Database ODM** | Mongoose | `^9.10.4` | MongoDB schema modeling and transactions |
| **Document Processing**| PDFKit / Sharp / QRCode | `^0.20` / `^0.35` / `^1.5` | Invoices, thumbnails, and UPI QR codes |
| **Job Scheduling** | Node-Cron | `^4.6.0` | Sentinel intelligence engine scheduler |
| **LLM SDK** | `@google/genai` | `^2.30.0` | Gemini function-calling assistant |
| **Computer Vision** | Ultralytics YOLO | `8.x` / `11.x` | Hardware tool detection |
| **AI Web Server** | FastAPI / Uvicorn | `^0.110.0` | Asynchronous vision inference microservice |
| **Database** | MongoDB | `>=7.0` | Replica set (Local or MongoDB Atlas) |

---

## 6. Project Structure

```text
ai-w-s-main/
├── README.md                           # Master project documentation
├── start-all.bat                       # Windows 1-click launcher for all 3 services
├── .gitignore                          # Global exclusion rules (secrets, venv, dataset)
├── ai-model/                           # Python FastAPI + YOLO Vision Microservice
│   ├── api.py                          # FastAPI inference app (GET /, POST /predict)
│   ├── best.pt                         # Trained YOLO weights for 5 mechanical tool classes
│   ├── requirements.txt                # Python dependencies (fastapi, uvicorn, ultralytics)
│   ├── test.py                         # CLI script for local test image verification
│   ├── train.py                        # YOLO training pipeline
│   ├── .env.example                    # Vision service environment template
│   └── dataset/                        # Local training datasets (excluded from git)
├── backend/                            # Express 5 REST API & Intelligence Core
│   ├── package.json                    # Backend dependencies and scripts
│   ├── .env.example                    # Backend environment template
│   ├── src/
│   │   ├── server.js                   # Express application setup and lifecycle hooks
│   │   ├── config/                     # Database, logger, and order settings
│   │   ├── intelligence/               # Sentinel intelligence engine core & modules
│   │   │   ├── index.js                # Sentinel scheduler & auto-resolve loop
│   │   │   └── modules/                # 6 statistical surveillance modules
│   │   ├── middleware/                 # JWT auth, RBAC, and Zod request validation
│   │   ├── migrations/                 # Sequential number & ledger backfill scripts
│   │   ├── models/                     # Mongoose schemas (Product, Order, Customer, etc.)
│   │   ├── routes/                     # REST route handlers
│   │   ├── schemas/                    # Zod validation schemas
│   │   ├── services/                   # PDF, sequence, WhatsApp, reorder, and LLM services
│   │   ├── utils/                      # GST tax math and local network IP utilities
│   │   └── seedRealisticData.js        # 30-day realistic historical seed script
│   └── tests/                          # Jest test suites (RBAC, math, sequences, GST)
├── frontend/warehouse-system/          # React 19 + TypeScript + Vite Web Client
│   ├── package.json                    # Frontend dependencies and scripts
│   ├── vite.config.js                  # Vite configuration and Tailwind plugins
│   ├── .env.example                    # Frontend environment template
│   ├── index.html                      # Single page application entry HTML
│   └── src/
│       ├── App.tsx                     # Main cockpit router and layout
│       ├── components/                 # Modals, charts, assistants, and camera HUD
│       ├── context/                    # AuthContext and role management
│       ├── hooks/                      # Voice and UI hooks
│       ├── lib/                        # API fetcher, camera controls, formatters, WhatsApp
│       └── __tests__/                  # Vitest test suites (formatters, WhatsApp links)
└── docs/                               # Documentation assets
    └── screenshots/                    # UI interface captures
```

---

## 7. Installation & Setup

### Prerequisites

| Tool | Required Version | Verification Command |
| :--- | :--- | :--- |
| **Node.js** | `v20.x` or `v22.x` | `node -v` |
| **npm** | `v10.x` or `v11.x` | `npm -v` |
| **Python** | `v3.10.x` or `v3.11.x` | `python --version` |
| **MongoDB** | `v7.x` or `v8.x` (or MongoDB Atlas) | `mongod --version` |
| **Git** | `v2.x+` | `git --version` |

---

### Step 1: Clone & Configure Environment Files

Clone the repository and prepare the `.env` files for all three services:

#### Windows (PowerShell)
```powershell
# Clone repository
git clone <repository-url>
cd ai-w-s-main

# Configure Backend environment
Copy-Item backend\.env.example backend\.env

# Configure Frontend environment
Copy-Item frontend\warehouse-system\.env.example frontend\warehouse-system\.env

# Configure AI Model environment
Copy-Item ai-model\.env.example ai-model\.env
```

#### Linux / macOS (Bash)
```bash
# Clone repository
git clone <repository-url>
cd ai-w-s-main

# Configure Backend environment
cp backend/.env.example backend/.env

# Configure Frontend environment
cp frontend/warehouse-system/.env.example frontend/warehouse-system/.env

# Configure AI Model environment
cp ai-model/.env.example ai-model/.env
```

---

### Step 2: MongoDB Setup

The backend utilizes multi-document transactions in `runInTransaction()`, which requires MongoDB to run as a **Replica Set**.

#### Option A: MongoDB Atlas (Cloud - Recommended)
1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Open `backend/.env` and set `MONGO_URI` to your Atlas connection string:
   ```env
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/warehouse?retryWrites=true&w=majority
   ```

#### Option B: Local MongoDB Replica Set
Start your local `mongod` instance with replica set flags:
```bash
mongod --replSet rs0 --dbpath /data/db
```
Initiate the replica set in `mongosh`:
```javascript
rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] });
```
Set `backend/.env`:
```env
MONGO_URI=mongodb://localhost:27017/warehouse?replicaSet=rs0
```

---

### Step 3: Install & Start AI Vision Service

1. Create a Python virtual environment and activate it:
   ```powershell
   cd ai-model
   python -m venv .venv

   # Windows
   .\.venv\Scripts\activate

   # Linux/macOS
   source .venv/bin/activate
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the vision service:
   ```bash
   uvicorn api:app --host 127.0.0.1 --port 8001
   ```
4. **Verification**: Open [http://127.0.0.1:8001/](http://127.0.0.1:8001/) in your browser. Expected response:
   ```json
   { "message": "Warehouse AI Detection API is running", "model": "...best.pt", "confidenceThreshold": 0.7 }
   ```

---

### Step 4: Install, Seed & Start Backend

1. Navigate to the backend directory and install packages:
   ```bash
   cd ../backend
   npm install
   ```
2. Seed initial users and realistic 30-day operational data:
   ```bash
   # Seed default admin and staff credentials:
   npm run seed:users

   # Seed products, stock movements, customers, orders, and run Sentinel:
   npm run seed:realistic
   ```
3. Start the backend development server:
   ```bash
   npm run dev
   ```
4. **Verification**: Open [http://localhost:5000/api/health](http://localhost:5000/api/health). Expected response:
   ```json
   { "status": "healthy", "services": { "database": { "status": "connected" }, "visionService": { "status": "online" } } }
   ```

---

### Step 5: Install & Start Frontend

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend/warehouse-system
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. **Verification**: Open [http://localhost:5173](http://localhost:5173). You will see the Denika WMS login screen.

---

### Process & Terminal Overview

Keep the following processes active during development:

| Order | Terminal / Process | Directory | Command | Port |
| :---: | :--- | :--- | :--- | :--- |
| **1** | MongoDB | System / Cloud | MongoDB Service or Atlas | `27017` |
| **2** | YOLO Vision Service | `ai-model/` | `uvicorn api:app --host 127.0.0.1 --port 8001` | `8001` |
| **3** | Express Backend | `backend/` | `npm run dev` | `5000` |
| **4** | React Frontend | `frontend/warehouse-system/` | `npm run dev` | `5173` |

> [!TIP]
> **Windows 1-Click Startup**: Once steps 1–5 are completed, double-click [`start-all.bat`](file:///c:/Users/suhas/Desktop/ai-w-s-main/start-all.bat) in the project root to open all three processes in separate terminal windows automatically.

---

## 8. Environment Variables

### Backend (`backend/.env`)

| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `PORT` | `5000` | HTTP port for the Express REST server |
| `MONGO_URI` | `mongodb://localhost:27017/warehouse?replicaSet=rs0` | MongoDB connection URI with replicaSet |
| `JWT_SECRET` | `your_jwt_secret_min_16_chars` | Secret key for signing user authentication tokens |
| `JWT_EXPIRES_IN` | `8h` | Token expiration duration |
| `CORS_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed cross-origin frontend URLs |
| `AI_API_URL` | `http://127.0.0.1:8001` | Base URL of the Python YOLO vision microservice |
| `AI_API_KEY` | `your_shared_ai_api_key_secret` | Shared secret header (`X-AI-API-KEY`) passed to vision service |
| `GEMINI_API_KEY` | `your_gemini_api_key_here` | API key from Google AI Studio for Gemini assistant |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Primary generative model for tool-calling assistant |
| `GEMINI_FALLBACK_MODELS` | `gemini-1.5-flash,gemini-2.0-flash` | Comma-separated fallback models if primary model is unavailable |
| `INTELLIGENCE_CRON` | `*/15 * * * *` | Cron schedule string for Sentinel engine cycles |
| `DEMAND_SPIKE_Z_WARN` | `2.0` | $Z$-score warning threshold for demand surges |
| `DEMAND_SPIKE_Z_CRIT` | `3.0` | $Z$-score critical threshold for demand surges |
| `SLOW_STOCK_WARN_DAYS` | `30` | Days of dispatch stagnation triggering slow stock warning |
| `SLOW_STOCK_CRIT_DAYS` | `60` | Days of dispatch stagnation triggering critical slow stock |
| `ADMIN_NAME` | `Admin User` | Name for seeded administrator account |
| `ADMIN_EMAIL` | `admin@warehouse.local` | Email for seeded administrator account |
| `ADMIN_PASSWORD` | `adminpassword123` | Password for seeded administrator account |
| `STAFF_NAME` | `Staff User` | Name for seeded staff account |
| `STAFF_EMAIL` | `staff@warehouse.local` | Email for seeded staff account |
| `STAFF_PASSWORD` | `staffpassword123` | Password for seeded staff account |
| `COMPANY_NAME` | `Denika & Team Solutions` | Legal company name rendered on tax invoices |
| `COMPANY_ADDRESS` | `Plot 42, Peenya Industrial Area...` | Registered operational address for invoices |
| `COMPANY_GSTIN` | `29AABCU9603R1ZM` | 15-digit GST identification number (Karnataka) |
| `COMPANY_STATE` | `Karnataka` | Origin state for SGST/CGST vs IGST determination |
| `COMPANY_PHONE` | `+91 98765 43210` | Contact phone number printed on invoice header |
| `COMPANY_EMAIL` | `billing@denikasolutions.com` | Billing email printed on invoice header |
| `UPI_ID` | `denikasolutions@upi` | UPI VPA encoded into invoice dynamic QR code |
| `WHATSAPP_CLOUD_API_ENABLED`| `false` | Enable Meta Cloud API headless dispatch |
| `WHATSAPP_CLOUD_API_TOKEN` | `your_token` | Meta Developer Bearer token |
| `WHATSAPP_PHONE_NUMBER_ID` | `your_phone_id` | Meta sender phone number ID |
| `WHATSAPP_INVOICE_TEMPLATE`| `invoice_pdf_template` | Meta approved template identifier |

---

### Frontend (`frontend/warehouse-system/.env`)

| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:5000/api` | Base URL of Express backend REST API |
| `VITE_AI_API_URL` | `http://127.0.0.1:8001` | Vision service URL for direct health checks |
| `VITE_DEMO_MODE` | `true` | When `true`, displays 1-click credential chips on login |
| `VITE_AI_CONFIDENCE` | `0.70` | Frontend minimum confidence for client-side display |
| `VITE_AI_STABLE_FRAMES` | `3` | Required consecutive frames to trigger auto-receive |
| `VITE_AI_API_KEY` | `your_shared_ai_api_key_secret` | Direct key fallback for vision testing |
| `VITE_COMPANY_NAME` | `DENIKA AND TEAM SOLUTIONS` | Brand name displayed in header and invoice previews |
| `VITE_COMPANY_GSTIN` | `29AABCU9603R1ZM` | Seller GSTIN rendered in client tax calculator |
| `VITE_COMPANY_PHONE` | `+91 98765 43210` | Company phone rendered on billing views |
| `VITE_COMPANY_EMAIL` | `billing@denikasolutions.com` | Contact email on customer ledger views |
| `VITE_COMPANY_ADDRESS` | `Plot 42, Peenya Industrial Area...` | Registered address rendered on UI previews |

---

### AI Vision Service (`ai-model/.env`)

| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `AI_MODEL_PATH` | `best.pt` | Path to trained YOLO weights file |
| `AI_CONFIDENCE` | `0.70` | Server-side model inference confidence threshold |
| `AI_DEBUG_DETECTIONS` | `false` | When `true`, returns detailed box ratios and reject reasons |
| `AI_SCAN_X_MIN` | `0.20` | Bounding box center horizontal minimum boundary ($0.0 - 1.0$) |
| `AI_SCAN_X_MAX` | `0.80` | Bounding box center horizontal maximum boundary ($0.0 - 1.0$) |
| `AI_SCAN_Y_MIN` | `0.15` | Bounding box center vertical minimum boundary ($0.0 - 1.0$) |
| `AI_SCAN_Y_MAX` | `0.85` | Bounding box center vertical maximum boundary ($0.0 - 1.0$) |
| `AI_MIN_BOX_WIDTH_RATIO` | `0.05` | Minimum width ratio relative to frame width |
| `AI_MIN_BOX_HEIGHT_RATIO`| `0.05` | Minimum height ratio relative to frame height |
| `AI_MIN_BOX_AREA_RATIO` | `0.01` | Minimum area percentage to reject noise |
| `AI_MAX_BOX_AREA_RATIO` | `0.80` | Maximum area percentage to reject background false positives |
| `AI_API_KEY` | `your_shared_ai_api_key_secret` | Verification key matched against `X-AI-API-KEY` header |
| `AI_MAX_UPLOAD_SIZE` | `5242880` | Maximum frame upload size in bytes ($5\text{ MB}$) |

---

## 9. Demo Credentials & RBAC

When `VITE_DEMO_MODE=true` is set, clickable login chips appear on the login screen.

| Role | Email | Password | Allowed Capabilities |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@warehouse.local` | `adminpassword123` | Full access: Catalog edit/delete, stock adjustments, order packing/dispatch, payment confirmation, insight acknowledge/resolve, assistant payment confirmation. |
| **STAFF** | `staff@warehouse.local` | `staffpassword123` | Floor operations: Camera auto-receive, manual inward, creating orders, invoice viewing, sending WhatsApp messages, viewing insights and reports. |

---

## 10. Usage Guide

### 1. Hands-Free Camera Receiving
1. Open the **Receive Stock** tab from the sidebar.
2. Select your camera device and click **Start Camera**.
3. Hold a mechanical tool (`Drill`, `Hammer`, `Pliers`, `Screwdriver`, or `Wrench`) within the center guide box.
4. Once detected steadily for 3 consecutive frames, the item count increments ($+1$), an audio chime sounds, and stock is saved to the database.
5. Move the tool out of view before presenting another item. Use the 5-second **Undo** button if scanned accidentally.

### 2. Creating and Dispatching Orders
1. Open the **Dispatch Stock** tab.
2. Select or enter customer details using `CustomerAutocomplete`.
3. The customer credit risk tier (`LOW`, `MEDIUM`, or `HIGH`) automatically populates the required advance payment percentage ($30\%$, $50\%$, or $70\%$).
4. Add line items. Available stock and line-item taxes are calculated dynamically.
5. Click **Create Order**. The order is created in `PROCESSING` status with sequential order number `ORD/26-27/XXXX`.

### 3. Invoices and WhatsApp Dispatch
1. Open the **Orders** tab.
2. Filter by status (`PROCESSING`, `ADVANCE_RECEIVED`, `PACKED`, or `DISPATCHED`).
3. Click the **Invoice** icon to download or preview the official PDF tax invoice with UPI QR code.
4. Click the **WhatsApp** icon:
   - On desktop, opens WhatsApp Web targeted to the customer's exact mobile phone number.
   - On mobile, opens the native WhatsApp application with a pre-filled message and clickable `sslip.io` PDF invoice link.

### 4. Gemini AI Assistant
1. Click the floating **Gemini Cockpit Assistant** icon in the bottom-right corner.
2. Use voice recognition (microphone button) or type queries:
   - *"Do we have enough hammers in stock?"*
   - *"Check credit risk for MegaBuild Infrastructure"*
   - *"Give me reorder suggestions for this month"*
3. For commercial operations (e.g. *"Record payment of 5000 for order ORD/26-27/0001"*), the assistant stages a `PendingAction` card. The administrator has 5 minutes to click **Confirm** before it expires.

### 5. Sentinel Intelligence Drawer
1. Click the **Bell Icon** on the header bar to open the Sentinel drawer.
2. Review active alerts across the 6 modules:
   - `DEMAND_SPIKE`: Investigate anomalous surge items.
   - `SLOW_STOCK`: View tied-up idle capital.
   - `STOCK_INTEGRITY`: Review discrepancies between physical stock and ledger logs.
   - `ORDER_FLOW`: Identify delayed dispatches or send payment reminders.
3. Administrators can click **Acknowledge**, **Resolve**, or **Run Analysis Now**.

---

## 11. API Reference

### Authentication (`/api/auth`)
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Authenticates user; rate limited to 10 attempts / 15 min |
| `POST` | `/api/auth/change-password` | Authenticated | Updates temporary password and clears `mustChangePassword` |
| `POST` | `/api/auth/skip-password-change`| Authenticated | Skips first-login password update |
| `GET` | `/api/auth/me` | Authenticated | Returns logged-in user profile |

### Products & Inventory (`/api/products`)
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/products` | Authenticated | List all products with on-hand, reserved, and available counts |
| `POST` | `/api/products` | ADMIN | Create new catalog product |
| `PUT` | `/api/products/:id` | ADMIN | Update product price, SKU, lead times, MOQ, or location |
| `DELETE`| `/api/products/:id` | ADMIN | Soft-delete / deactivate product |
| `POST` | `/api/products/:id/image` | ADMIN | Upload WebP/PNG product thumbnail (max 2MB) |
| `GET` | `/api/products/dashboard` | Authenticated | Real-time valuation, ATP metrics, and Recharts history |
| `GET` | `/api/products/reorder-suggestions`| Authenticated| Outlier-robust Winsorized reorder suggestions |
| `PATCH`| `/api/products/:id/receive` | STAFF / ADMIN | Inward receive stock increment ($+N$) |
| `POST` | `/api/products/:id/undo-receive`| STAFF / ADMIN | Reversal buffer endpoint for accidental camera scans |
| `POST` | `/api/products/:id/adjust` | ADMIN | Manual stock adjustment with mandatory audit reason |
| `GET` | `/api/products/movements` | Authenticated | Chronological audit ledger of all stock movements |

### Orders & Invoicing (`/api/orders`)
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/orders` | Authenticated | Create customer order with credit-adjusted advance |
| `GET` | `/api/orders` | Authenticated | List orders with status filters and customer search |
| `GET` | `/api/orders/:id` | Authenticated | Get full order details and payment history |
| `GET` | `/api/orders/:id/invoice.pdf` | Authenticated | Generate official GST Tax Invoice PDF |
| `GET` | `/api/orders/public/:id/invoice.pdf`| Public | Unauthenticated invoice preview for customer WhatsApp links |
| `POST` | `/api/orders/:id/payments` | Authenticated | Record inward payment against order balance |
| `POST` | `/api/orders/:id/reminders` | Authenticated | Trigger payment reminder on overdue balance |
| `PATCH`| `/api/orders/:id/pack` | ADMIN | Transition order from `ADVANCE_RECEIVED` to `PACKED` |
| `PATCH`| `/api/orders/:id/dispatch` | ADMIN | Final dispatch; releases reserved stock and deducts physical inventory |
| `PATCH`| `/api/orders/:id/cancel` | ADMIN | Cancel order; unreserves stock with refund or credit note |
| `POST` | `/api/orders/:id/returns` | ADMIN | Process sales return; generates Credit Note (`CN/26-27/XXXX`) |
| `GET` | `/api/orders/export/gstr1` | Authenticated | Export GSTR-1 format CSV for Indian tax filing |

### Customers & Risk (`/api/customers`)
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/customers` | Authenticated | List customers with contact details and search |
| `GET` | `/api/customers/:id` | Authenticated | Customer details and order history |
| `GET` | `/api/customers/:id/risk` | Authenticated | Real-time 0–100 credit risk evaluation and advance terms |

### Sentinel Intelligence (`/api/insights`)
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/insights` | Authenticated | List active and historical Sentinel alerts |
| `PATCH`| `/api/insights/:id/ack` | ADMIN | Mark insight acknowledged |
| `PATCH`| `/api/insights/:id/resolve` | ADMIN | Manually mark insight resolved with reason |
| `POST` | `/api/insights/run` | ADMIN | Manually trigger full Sentinel intelligence cycle |

### AI Assistant & Vision Proxy
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/vision/predict` | Authenticated | Proxies camera frame to Python YOLO with `X-AI-API-KEY` |
| `POST` | `/api/assistant/chat` | Authenticated | Gemini tool-calling assistant conversation |
| `POST` | `/api/assistant/confirm` | ADMIN | Confirm staged pending action within 5-min TTL |
| `POST` | `/api/assistant/cancel` | Authenticated | Cancel staged pending action |
| `GET` | `/api/health` | Public | System status, MongoDB state, LAN IP, and AI status |

---

## 12. Decentralised Sentinel Intelligence Engine

The Sentinel engine runs independently inside Express via `node-cron`:

```
┌─────────────────────────────────────────────────────────────┐
│ Express Node-Cron Scheduler (Default: */15 * * * *)        │
└──────────────┬──────────────────────────────────────────────┘
               │
   ┌───────────┴───────────┬──────────────────────┬─────────────┐
   ▼                       ▼                      ▼             ▼
[DEMAND_SPIKE]        [SLOW_STOCK]         [STOCK_INTEGRITY] [ORDER_FLOW]
Rolling 30d Z-score   Idle capital         Physical vs       Stuck states &
Surge detection       stagnation           Ledger audit      Reminder ladder
   │                       │                      │             │
   └───────────┬───────────┴──────────────────────┴─────────────┘
               ▼
   [PAYMENT_RISK] & [LOW_STOCK]
   0-100 Customer Credit Score & Reorder Burn Calculation
               │
               ▼
   Upsert Deduplicated Insight / Auto-Resolve Normalized Items
```

### Module Formulas & Thresholds

#### 1. Demand Spike (`DEMAND_SPIKE`)
Measures rolling 24-hour dispatches ($Q_{24\text{h}}$) against the 30-day baseline mean ($\mu$) and standard deviation ($\sigma$):
$$Z = \frac{Q_{24\text{h}} - \mu}{\sigma}$$
- $Z \ge \text{DEMAND\_SPIKE\_Z\_WARN}$ ($2.0$) $\rightarrow$ **WARNING**
- $Z \ge \text{DEMAND\_SPIKE\_Z\_CRIT}$ ($3.0$) $\rightarrow$ **CRITICAL**

#### 2. Slow-Moving Stock (`SLOW_STOCK`)
Evaluates days since last dispatch movement:
- $\text{Days} > \text{SLOW\_STOCK\_WARN\_DAYS}$ ($30$) $\rightarrow$ **WARNING**
- $\text{Days} > \text{SLOW\_STOCK\_CRIT\_DAYS}$ ($60$) $\rightarrow$ **CRITICAL**
- $\text{Idle Capital} = \text{Current Stock} \times \text{Unit Cost}$

#### 3. Stock Integrity Ledger Discrepancy (`STOCK_INTEGRITY`)
Reconciles physical recorded stock against the chronological movement ledger:
$$\text{Expected Stock} = \text{Initial Stock} + \sum \text{Qty}_{\text{IN}} - \sum \text{Qty}_{\text{OUT}} \pm \sum \text{Qty}_{\text{ADJUST}}$$
$$\text{Discrepancy} = \text{Recorded Stock} - \text{Expected Stock}$$
- If $\text{Discrepancy} \ne 0$, raises immediate **CRITICAL** alert.

#### 4. Order Flow & Stuck Pipeline (`ORDER_FLOW`)
- `PROCESSING` $> 2$ days without advance payment $\rightarrow$ **WARNING**
- `ADVANCE_RECEIVED` $> 2$ days without packing $\rightarrow$ **WARNING**
- `PACKED` $> 3$ days without dispatch $\rightarrow$ **WARNING**
- Escalates payment reminders at 3, 7, and 14 days with 48-hour debouncing.

#### 5. Customer Credit Risk Scoring (`PAYMENT_RISK`)
Calculates a 0–100 risk score:
$$\text{Balance Score} = \min\left(40, \frac{\text{Total Overdue Balance}}{50,000} \times 40\right)$$
$$\text{Ageing Score} = \min\left(35, \frac{\text{Average Days to Pay}}{30} \times 35\right)$$
$$\text{Unpaid Count Score} = \min(25, \text{Unpaid Orders} \times 8.33)$$
$$\text{Total Score} = \text{Balance Score} + \text{Ageing Score} + \text{Unpaid Count Score}$$
- **Score $0 - 29$ (`LOW`)**: Requires $30\%$ advance payment.
- **Score $30 - 69$ (`MEDIUM`)**: Requires $50\%$ advance payment.
- **Score $\ge 70$ (`HIGH`)**: Requires $70\%$ advance payment.

---

## 13. Testing

### Run Backend Test Suites (Jest)
```bash
cd backend
npm test
```
**Expected Results**:
- **7 Test Suites Passed** (44 total tests):
  - `sequenceService.test.js`: Financial year numbering, independent invoice/order sequences, atomic concurrency.
  - `rbac.test.js`: Role enforcement (ADMIN vs STAFF access boundaries).
  - `reorderFormula.test.js`: Winsorized burn rates, MOQ rounding, stock status classifications.
  - `orderStateMachine.test.js`: State progression, invalid transition rejection, sales returns.
  - `intelligenceMathematics.test.js`: $Z$-scores, credit risk formulas, ledger discrepancy calculations.
  - `paymentCalculations.test.js`: Advance thresholds, balance validation, overpayment protection.
  - `gstCalculations.test.js`: Karnataka intra-state (CGST/SGST 9%) vs inter-state (IGST 18%).

### Run Frontend Test Suites (Vitest)
```bash
cd frontend/warehouse-system
npm test
```
**Expected Results**:
- **2 Test Suites Passed** (9 total tests):
  - `format.test.ts`: Currency formatting, date calculations, phone normalization.
  - `whatsapp.test.ts`: WhatsApp message composition, deep-link structure, and `sslip.io` link formatting.

---

## 14. Troubleshooting

| Symptom / Error | Root Cause | Solution |
| :--- | :--- | :--- |
| `MongoServerError: Transaction numbers are only allowed on a replica set` | MongoDB is running in standalone mode. Multi-document transactions require a replica set. | Start local mongod with `--replSet rs0` and run `rs.initiate()` in `mongosh`, or switch to a MongoDB Atlas URI in `backend/.env`. |
| `Vision AI service is unavailable (503)` | The Python FastAPI microservice is offline or unreachable on port 8001. | Open a separate terminal, activate `ai-model/.venv`, and run `uvicorn api:app --host 127.0.0.1 --port 8001`. |
| `FATAL ERROR: JWT_SECRET environment variable is missing` | `backend/.env` is missing or `JWT_SECRET` is unset. | Ensure `backend/.env` exists and contains a random string of at least 16 characters. |
| `YOLO model not found at best.pt` | Model weights file is missing or `AI_MODEL_PATH` is incorrect. | Ensure [`ai-model/best.pt`](file:///c:/Users/suhas/Desktop/ai-w-s-main/ai-model/best.pt) exists in the `ai-model` directory and matches `AI_MODEL_PATH=best.pt`. |
| `CORS blocked for origin` | Frontend is running on an unexpected port (e.g. `5174` instead of `5173`). | Add your exact frontend port to `CORS_ORIGIN` in `backend/.env` separated by commas. |
| `Camera auto-receive does not increment count` | Tool is held outside the scan region ($X$: $0.20-0.80$, $Y$: $0.15-0.85$) or confidence is below threshold. | Center the tool in the bounding box overlay or reduce `VITE_AI_CONFIDENCE` in `frontend/warehouse-system/.env`. |
| `Clickable WhatsApp invoice link does not open on mobile` | Mobile phone is not on the same Wi-Fi/LAN network as the warehouse server. | Ensure the mobile device is connected to the same Wi-Fi router so the `sslip.io` LAN IP resolves. |

---

## 15. Roadmap

- [ ] Barcode / QR Code hardware scanner integration as parallel input alongside YOLO camera stream.
- [ ] Offline PWA caching with background sync for intermittent warehouse Wi-Fi.
- [ ] Direct Tally / Zoho Books accounting webhook synchronization for GSTR-1 ledgers.
- [ ] Automated supplier purchase order email dispatch upon Smart Reorder threshold breach.

---

## 16. Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`.
3. Ensure all tests pass: `npm test` in both `backend` and `frontend/warehouse-system`.
4. Commit your changes: `git commit -m "feat: add descriptive feature"`.
5. Push to the branch: `git push origin feature/your-feature-name`.
6. Submit a Pull Request.

---

## 17. License & Author

- **Operating Entity**: **Denika & Team Solutions**
- **Registered Address**: Plot 42, Peenya Industrial Area, Phase II, Bengaluru, Karnataka 560058
- **GSTIN**: `29AABCU9603R1ZM`
- **Lead Developer**: Suhas ([@TheSuhasDev](https://github.com/TheSuhasDev))
- **License**: Private & Proprietary — All Rights Reserved.
