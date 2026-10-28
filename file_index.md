# Project File Index — Denika AI Warehouse Management System (WMS)

| # | File Path | One-Line Purpose | Lines |
| :-: | :--- | :--- | :-: |
| 1 | `README.md` | Master project documentation, setup, API reference, architecture, and usage guide | 586 |
| 2 | `start-all.bat` | Windows 1-click batch launcher to spin up AI microservice, Express backend, and Vite frontend in dedicated terminals | 21 |
| 3 | `.gitignore` | Git exclusion rules for secrets, virtual environments, datasets, logs, build artifacts, and caches | 69 |
| 4 | `ai-model/.env.example` | Template containing configuration environment variables for the FastAPI vision microservice | 13 |
| 5 | `ai-model/api.py` | FastAPI server running Ultralytics YOLO inference, bounding-box validation, scan region filters, and authentication | 136 |
| 6 | `ai-model/requirements.txt` | Python dependency specification (`fastapi`, `uvicorn`, `ultralytics`, `pillow`, `python-multipart`) | 5 |
| 7 | `ai-model/test.py` | Standalone CLI script for testing YOLO model detections across confidence thresholds on sample images | 21 |
| 8 | `ai-model/train.py` | YOLO model training script for fine-tuning on custom warehouse mechanical tools dataset | 15 |
| 9 | `backend/package.json` | Node.js backend package manifest, npm scripts, and production/development dependencies | 48 |
| 10 | `backend/eslint.config.js` | ESLint static analysis configuration for backend ECMAScript modules | 21 |
| 11 | `backend/jest.config.js` | Jest test runner configuration for experimental ES module test execution | 7 |
| 12 | `backend/.env.example` | Template containing environment variables for MongoDB, JWT, Gemini LLM, ports, and company GSTIN profile | 42 |
| 13 | `backend/src/server.js` | Express application bootstrap: security middleware, CORS, rate limiting, route registration, and server startup | 147 |
| 14 | `backend/src/config/database.js` | MongoDB Mongoose connection manager and multi-document transaction runner (`runInTransaction`) | 64 |
| 15 | `backend/src/config/logger.js` | Pino structured JSON logging configuration with pretty-printing for development | 16 |
| 16 | `backend/src/config/orderSettings.js` | System configuration constants for default customer order advance payment percentages | 2 |
| 17 | `backend/src/models/Counter.js` | Mongoose schema for atomic gap-free sequential Financial Year number counters (`ORD`, `INV`, `CN`) | 10 |
| 18 | `backend/src/models/Customer.js` | Mongoose schema for customer billing records, GSTIN identification, contact details, and address | 38 |
| 19 | `backend/src/models/Insight.js` | Mongoose schema for Sentinel intelligence alerts, deduplication keys, severity, and auto-resolve states | 73 |
| 20 | `backend/src/models/Order.js` | Mongoose schema for customer orders, line items, state progression (`PROCESSING` to `DISPATCHED`), and returns | 137 |
| 21 | `backend/src/models/Payment.js` | Mongoose schema for commercial inward payments, receipts, transaction methods, and order balance links | 34 |
| 22 | `backend/src/models/PendingAction.js` | Mongoose schema for staged Gemini AI assistant actions requiring human admin confirmation with 5-minute TTL | 56 |
| 23 | `backend/src/models/Product.js` | Mongoose schema for catalog inventory items, SKU, purchase/selling price, stock counts, MOQ, and lead times | 80 |
| 24 | `backend/src/models/StockMovement.js` | Mongoose schema for immutable stock ledger entries tracking IN/OUT/ADJUST movements with audit history | 67 |
| 25 | `backend/src/models/User.js` | Mongoose schema for authenticated users, bcrypt password hashes, and RBAC roles (`ADMIN`, `STAFF`) | 40 |
| 26 | `backend/src/middleware/auth.js` | Middleware functions for JWT Bearer token verification (`requireAuth`) and role enforcement (`requireRole`) | 42 |
| 27 | `backend/src/middleware/validate.js` | Express middleware wrapper validating request bodies against Zod schemas | 66 |
| 28 | `backend/src/routes/assistantRoutes.js` | REST routes for Gemini AI assistant conversation, staged action confirmation, and action cancellation | 349 |
| 29 | `backend/src/routes/authRoutes.js` | REST routes for user authentication, login rate limiting, password reset, and user profile retrieval | 104 |
| 30 | `backend/src/routes/customerRoutes.js` | REST routes for customer CRUD operations, order history lookups, and real-time credit risk evaluations | 134 |
| 31 | `backend/src/routes/healthRoutes.js` | System health check endpoint reporting MongoDB connection state, AI vision availability, and LAN IP network discovery | 67 |
| 32 | `backend/src/routes/insightRoutes.js` | REST routes for Sentinel intelligence alerts: querying, acknowledging, manual resolving, and manual execution | 114 |
| 33 | `backend/src/routes/orderRoutes.js` | REST routes for order lifecycle management, tax PDF invoice generation, payments, WhatsApp dispatch, and GSTR-1 export | 726 |
| 34 | `backend/src/routes/productRoutes.js` | REST routes for inventory catalog CRUD, camera auto-receive, 5s undo-receive, manual adjustment, and movements | 502 |
| 35 | `backend/src/routes/visionRoutes.js` | Authenticated proxy endpoint relaying multipart webcam frames to the Python YOLO microservice with `X-AI-API-KEY` | 48 |
| 36 | `backend/src/schemas/index.js` | Centralized Zod schemas defining strict validation rules for all mutating backend API requests | 112 |
| 37 | `backend/src/services/assistantTools.js` | Gemini OpenAPI function-calling tool declarations and live MongoDB query execution functions | 476 |
| 38 | `backend/src/services/llm.js` | Wrapper for Google GenAI SDK handling Gemini conversations, function calling formatting, and model fallbacks | 243 |
| 39 | `backend/src/services/pdfService.js` | PDFKit service rendering printable A4 GST Tax Invoices with dynamic UPI payment QR codes and tax tables | 350 |
| 40 | `backend/src/services/pendingActions.js` | Service managing temporary staged commercial actions with atomic status checks and 5-minute TTL expirations | 78 |
| 41 | `backend/src/services/reorderService.js` | Unified reorder intelligence service calculating Winsorized burn rates, safety stock, and MOQ replenishment | 245 |
| 42 | `backend/src/services/sequenceService.js` | Concurrency-safe service generating sequential, gap-free Indian Financial Year document numbers (`ORD`, `INV`, `CN`) | 64 |
| 43 | `backend/src/services/whatsappService.js` | 3-tier customer WhatsApp dispatch service (Cloud API Tier 1, Native Web Share Tier 2, direct wa.me link Tier 3) | 141 |
| 44 | `backend/src/utils/gst.js` | Tax utilities determining buyer/seller state codes, calculating CGST/SGST (intra-state) vs IGST (inter-state) | 133 |
| 45 | `backend/src/utils/network.js` | Network utility identifying local IPv4 network address and formatting public-resolving `sslip.io` hostnames | 21 |
| 46 | `backend/src/intelligence/index.js` | Sentinel engine runner coordinating node-cron scheduling and automatic resolution of normalized insights | 132 |
| 47 | `backend/src/intelligence/modules/demandSpike.js` | Sentinel module computing rolling 30-day mean, standard deviation, and Z-scores for 24h dispatch surges | 71 |
| 48 | `backend/src/intelligence/modules/lowStock.js` | Sentinel module generating inventory replenishment insights based on single source of truth reorder calculations | 36 |
| 49 | `backend/src/intelligence/modules/orderFlow.js` | Sentinel module monitoring stuck pipeline stages and escalating overdue payment reminders (3/7/14-day ladder) | 122 |
| 50 | `backend/src/intelligence/modules/paymentRisk.js` | Sentinel module scoring customer credit risk (0–100) and determining required advance payment tiers (30%, 50%, 70%) | 136 |
| 51 | `backend/src/intelligence/modules/slowStock.js` | Sentinel module detecting stagnant inventory exceeding 30/60 days and computing tied-up idle capital | 49 |
| 52 | `backend/src/intelligence/modules/stockIntegrity.js` | Sentinel module reconciling recorded stock counts against immutable stock movement ledgers to detect mismatches | 68 |
| 53 | `backend/src/seed.js` | Basic seed script populating sample product records | 70 |
| 54 | `backend/src/seedUsers.js` | Seed script creating initial ADMIN and STAFF user accounts with bcrypt hashed passwords | 77 |
| 55 | `backend/src/seedMovements.js` | Seed script generating realistic stock movements for catalog items | 104 |
| 56 | `backend/src/seedRealisticData.js` | Master seed script populating 5 products, customers, 30 days of movement history, orders, and triggering Sentinel | 335 |
| 57 | `backend/src/migrations/assignUniqueInvoiceNumbers.js` | Database migration script assigning sequential financial year invoice numbers to historical orders | 68 |
| 58 | `backend/src/migrations/backfillDispatchMovements.js` | Database migration script auditing dispatched orders and creating missing stock movement ledger entries | 62 |
| 59 | `backend/tests/gstCalculations.test.js` | Jest unit test suite verifying GST tax math, state code extraction, and Bill of Supply handling | 91 |
| 60 | `backend/tests/intelligenceMathematics.test.js` | Jest unit test suite verifying Z-score surge formulas, credit risk scores, and ledger discrepancy reconciliation | 165 |
| 61 | `backend/tests/orderStateMachine.test.js` | Jest unit test suite verifying order lifecycle status transitions, cancellation rules, and sales returns | 98 |
| 62 | `backend/tests/paymentCalculations.test.js` | Jest unit test suite verifying customer payment allocations, advance requirements, and overpayment rejections | 95 |
| 63 | `backend/tests/rbac.test.js` | Jest unit test suite verifying role-based access control middleware boundaries for ADMIN and STAFF users | 54 |
| 64 | `backend/tests/reorderFormula.test.js` | Jest unit test suite verifying Winsorized burn rates, safety stock thresholds, and MOQ rounding rules | 148 |
| 65 | `backend/tests/sequenceService.test.js` | Jest unit test suite verifying Indian Financial Year date boundaries, prefix formatting, and atomic uniqueness | 71 |
| 66 | `frontend/warehouse-system/package.json` | React frontend package manifest, build scripts, and production/development UI dependencies | 42 |
| 67 | `frontend/warehouse-system/vite.config.js` | Vite bundler configuration including React plugin and Tailwind CSS v4 integration | 18 |
| 68 | `frontend/warehouse-system/tsconfig.json` | TypeScript compiler configuration for client-side React code and DOM type checking | 24 |
| 69 | `frontend/warehouse-system/eslint.config.js` | ESLint configuration for frontend React and TypeScript linting rules | 20 |
| 70 | `frontend/warehouse-system/index.html` | Single Page Application entry HTML defining viewport, root element, and fonts | 18 |
| 71 | `frontend/warehouse-system/.env.example` | Template containing client-side environment variables for backend API URLs and company profile details | 11 |
| 72 | `frontend/warehouse-system/src/main.jsx` | React application mounting script attaching the root component to the DOM under StrictMode | 9 |
| 73 | `frontend/warehouse-system/src/App.tsx` | Main application cockpit component: tab routing, sidebar navigation, modal controllers, and global state | 3871 |
| 74 | `frontend/warehouse-system/src/App.css` | Custom CSS styling rules for cockpit views, tables, transitions, and scrollbars | 794 |
| 75 | `frontend/warehouse-system/src/index.css` | Base stylesheet initializing Tailwind CSS v4 and custom dark cockpit theme variables | 139 |
| 76 | `frontend/warehouse-system/src/vite-env.d.ts` | TypeScript declarations referencing Vite client types | 1 |
| 77 | `frontend/warehouse-system/src/context/AuthContext.tsx` | React Context provider managing JWT authentication state, login, logout, and user permissions | 130 |
| 78 | `frontend/warehouse-system/src/hooks/useVoiceSettings.ts` | Custom React hook managing browser Web Speech API voice synthesis volume, pitch, and voice selection | 47 |
| 79 | `frontend/warehouse-system/src/lib/api.ts` | Centralized fetch API wrapper automatically attaching Bearer authorization headers and handling errors | 42 |
| 80 | `frontend/warehouse-system/src/lib/camera.ts` | Camera hardware helper managing video stream acquisition, track disposal, and canvas operations | 24 |
| 81 | `frontend/warehouse-system/src/lib/csvExport.ts` | Client-side CSV generation helper exporting formatted order lists, stock movements, and payment ledgers | 120 |
| 82 | `frontend/warehouse-system/src/lib/format.ts` | Indian Rupee currency (INR) formatting, relative time calculation, and phone normalization helpers | 40 |
| 83 | `frontend/warehouse-system/src/lib/gst.ts` | Client-side GST tax calculation utility matching backend tax determination logic | 151 |
| 84 | `frontend/warehouse-system/src/lib/utils.ts` | Utility helper merging Tailwind CSS class names cleanly using `clsx` and `tailwind-merge` | 5 |
| 85 | `frontend/warehouse-system/src/lib/voice.ts` | Browser SpeechSynthesis wrapper providing text-to-speech audio feedback for warehouse operations | 134 |
| 86 | `frontend/warehouse-system/src/lib/whatsapp.ts` | WhatsApp dispatch helper composing invoice messages, handling Web Share API, and creating deep links | 291 |
| 87 | `frontend/warehouse-system/src/components/AdjustStockModal.tsx` | Modal dialog for warehouse managers to execute manual stock adjustments with mandatory audit reasons | 223 |
| 88 | `frontend/warehouse-system/src/components/CancelOrderModal.tsx` | Modal dialog for cancelling pending customer orders with choice of inventory restock or scrap | 147 |
| 89 | `frontend/warehouse-system/src/components/ChangePasswordModal.tsx` | Modal dialog forcing users with `mustChangePassword: true` to set a secure permanent password | 209 |
| 90 | `frontend/warehouse-system/src/components/CustomerAutocomplete.tsx` | Interactive input component providing debounced customer search, auto-fill, and credit risk badges | 43 |
| 91 | `frontend/warehouse-system/src/components/CustomerLedgerModal.tsx` | Modal dialog presenting complete transactional invoice history, balance dues, and risk tier for a customer | 171 |
| 92 | `frontend/warehouse-system/src/components/DashboardCharts.tsx` | Visual cockpit telemetry component rendering Recharts area charts, bar charts, and donut distributions | 319 |
| 93 | `frontend/warehouse-system/src/components/EditProductModal.tsx` | Modal dialog allowing administrators to update product catalog metadata, pricing, MOQ, and storage bay | 364 |
| 94 | `frontend/warehouse-system/src/components/Gstr1ExportModal.tsx` | Modal dialog allowing users to specify financial date ranges and export Indian GSTR-1 compliant CSV reports | 126 |
| 95 | `frontend/warehouse-system/src/components/InsightsDrawer.tsx` | Slide-over drawer presenting Sentinel alerts with action buttons to Acknowledge, Resolve, or Run Sentinel | 301 |
| 96 | `frontend/warehouse-system/src/components/LoginPage.tsx` | Dark cockpit authentication page featuring email/password login and 1-click demo role chips | 205 |
| 97 | `frontend/warehouse-system/src/components/PaymentAlertsCard.tsx` | Dashboard card summarizing overdue payment ageing brackets (0-3d, 4-7d, 8-14d, 15+d) with WhatsApp triggers | 331 |
| 98 | `frontend/warehouse-system/src/components/PaymentRiskBadge.tsx` | UI badge component visualizing customer credit risk tiers (`LOW`, `MEDIUM`, `HIGH`) with color-coded chips | 69 |
| 99 | `frontend/warehouse-system/src/components/ProductThumbnail.tsx` | Product image component handling lazy loading, WebP uploads, and fallback icon rendering | 94 |
| 100 | `frontend/warehouse-system/src/components/ProtectedRoute.tsx` | Higher-order component guarding application routes against unauthenticated or unauthorized role access | 51 |
| 101 | `frontend/warehouse-system/src/components/SalesReturnModal.tsx` | Modal dialog for processing customer item returns, inventory restocking, and Credit Note generation | 245 |
| 102 | `frontend/warehouse-system/src/components/SmartReorderCard.tsx` | Table component displaying dynamic reorder points, MOQ-rounded order suggestions, and lead times | 373 |
| 103 | `frontend/warehouse-system/src/components/SystemHealthIndicator.tsx` | Header bar widget showing real-time connectivity status for MongoDB, Python YOLO service, and LAN IP | 106 |
| 104 | `frontend/warehouse-system/src/components/WarehouseAssistant.tsx` | Floating cockpit drawer housing the Gemini voice & text assistant, tool-call feeds, and pending action cards | 620 |
| 105 | `frontend/warehouse-system/src/components/WhatsAppPhoneModal.tsx` | Modal dialog prompting operator to verify or enter customer phone number before opening WhatsApp deep link | 134 |
| 106 | `frontend/warehouse-system/src/components/ui/demo.tsx` | Interactive demo showcase component for UI component library features | 187 |
| 107 | `frontend/warehouse-system/src/components/ui/sidebar.tsx` | Modular collapsible sidebar component supporting responsive collapse, nav items, and workspace branding | 830 |
| 108 | `frontend/warehouse-system/src/__tests__/format.test.ts` | Vitest unit test suite verifying currency formatting, time calculations, and Indian phone normalization | 35 |
| 109 | `frontend/warehouse-system/src/__tests__/whatsapp.test.ts` | Vitest unit test suite verifying WhatsApp text generation, deep-link structure, and sslip.io link formatting | 67 |

