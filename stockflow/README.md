# StockFlow — Open-Source Inventory Management System

StockFlow is a full-stack inventory, warehouse, sales, purchasing, and analytics platform built for small businesses, retail operations, wholesalers, and warehouses.

## Technology Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, React Router DOM, Axios, Lucide React, Recharts
- **Backend:** Node.js, Express.js (MVC architecture), Helmet, CORS, Express Rate Limit, Multer
- **Database:** MongoDB with Mongoose ODM (with automatic in-memory MongoDB fallback for zero-config local development)
- **Authentication:** JWT + bcryptjs + Role-Based Access Control (`Admin`, `Manager`, `Staff`)

## Project Structure

```text
StockFlow/
├── server.ts                  # Express + Vite full-stack server entrypoint
├── server/
│   ├── config/                # Environment and MongoDB connection setup
│   ├── models/                # Mongoose schemas (User, Product, Category, Supplier, Sale, SaleItem, Purchase, PurchaseItem, InventoryTransaction, Notification)
│   ├── controllers/           # Route handlers for each domain
│   ├── routes/                # REST API route definitions with RBAC
│   ├── middleware/            # JWT auth, role authorization, error handler, upload, sanitization
│   ├── services/              # Atomic stock & order transaction services
│   └── utils/                 # Seed data, CSV serializer, ApiError, asyncHandler
├── src/
│   ├── components/            # Reusable modals, image fallbacks, skeletons, empty states
│   ├── context/               # AuthContext and ToastContext
│   ├── layouts/               # Responsive DashboardLayout with dark navy sidebar
│   ├── pages/                 # Dashboard, Products, Categories, Inventory, Suppliers, Sales, Purchases, Reports, Users, Profile, Login
│   ├── services/              # Axios client with Bearer token interceptor
│   └── assets/                # Generated studio product imagery
├── .env.example
├── LICENSE
└── README.md
```

## Quick Start (Local Development)

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Configure environment:**
   Copy `.env.example` to `.env` and set your `MONGODB_URI` and `JWT_SECRET`.
   If `MONGODB_URI` is omitted in development, StockFlow automatically starts an isolated local MongoDB instance and seeds realistic sample data.
3. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.

### Default Seeded Demo Accounts

| Role    | Email                   | Password    | Access Level |
| ------- | ----------------------- | ----------- | ------------ |
| Admin   | `admin@stockflow.io`    | `Admin123!` | Full access including user & RBAC management |
| Manager | `manager@stockflow.io`  | `Manager123!`| Products, categories, inventory, suppliers, POs, sales, reports |
| Staff   | `staff@stockflow.io`    | `Staff123!` | Operational inventory, sales orders, and reports |

## Production Deployment

### 1. Database (MongoDB Atlas)
Create a cluster on MongoDB Atlas, allow network access for your backend host, and copy your connection string into `MONGODB_URI`.

### 2. Backend (Render / Railway / Fly.io)
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Environment Variables:**
  - `NODE_ENV=production`
  - `PORT=3000`
  - `MONGODB_URI=<your-atlas-uri>`
  - `JWT_SECRET=<strong-random-64-char-secret>`
  - `CORS_ORIGIN=https://your-frontend-domain.vercel.app`

### 3. Frontend (Vercel / Netlify, if hosted separately)
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variable:** `VITE_API_URL=https://your-backend-domain.onrender.com/api`

## License

MIT License — see [LICENSE](./LICENSE).
