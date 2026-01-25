<p align="center">
  <img src="./screens/logo.png" alt="Gumora Logo" width="200"/>
</p>

<h1 align="center">🚀 Gumora - Digital Products Marketplace</h1>

<p align="center">
  <strong>A production-ready, full-stack SaaS platform enabling creators to monetize digital products with AI-powered content import, secure payments, and enterprise-grade security.</strong>
</p>

<p align="center">
  <a href="https://gumora.shop">
    <img src="https://img.shields.io/badge/🌐_Live_Demo-gumora.shop-blue?style=for-the-badge" alt="Live Demo"/>
  </a>
  <a href="https://api.gumora.shop">
    <img src="https://img.shields.io/badge/🔌_API-api.gumora.shop-green?style=for-the-badge" alt="API"/>
  </a>
</p>

<p align="center">
  <img src="https://github.com/AkshayAlgoX/gamora-saas-platform/actions/workflows/ci.yml/badge.svg" alt="CI/CD"/>
  <img src="https://img.shields.io/badge/TypeScript-Strict_Mode-blue" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Tests-Vitest_+_Playwright-green" alt="Tests"/>
  <img src="https://img.shields.io/badge/Security-Helmet_+_Rate_Limiting-red" alt="Security"/>
</p>

---

## 📸 Screenshots

<!-- TODO: Add your screenshots here -->

| Dashboard | Product Editor | Checkout |
|-----------|----------------|----------|
| ![Dashboard](./screens/dashboard.png) | ![Editor](./screens/products_details.png) | ![Checkout](./screens/payments.png) |

| Library | Discover | Login |
|---------|----------|-------|
| ![Library](./screens/library.png) | ![Discover](./screens/discover.png) | ![Login](./screens/signin.png) |

<!-- 
📷 SCREENSHOT GUIDE:
1. Create a folder called "screens" in the root directory
2. Add your screenshots with these names:
   - logo.png (optional - for header)
   - dashboard.png
   - editor.png  
   - checkout.png
   - library.png
   - discover.png
   - login.png
3. Or replace the filenames above with your actual screenshot names
-->

---

## ⚡ What is Gumora?

Gumora is a **Gumroad-style digital marketplace** where creators can:
- Sell digital products with AI-powered product import from existing marketplaces
- Import product details, images, and pricing automatically using web scraping
- Accept payments via Cashfree payment gateway
- Track sales and revenue in real-time

**Buyers can:**
- Discover and purchase digital products
- Access purchased products in their personal library
- Download assets securely

---

## 🎯 Key Highlights (For Recruiters)

| What Recruiters Look For | ✅ This Project Has |
|--------------------------|---------------------|
| **Full-Stack Skills** | Next.js 16 + Express.js + MongoDB |
| **TypeScript** | Strict mode enabled, end-to-end type safety |
| **Authentication** | JWT + HTTP-only cookies, cross-origin handling |
| **Payment Integration** | Complete Cashfree gateway implementation |
| **AI Integration** | Firecrawl-powered intelligent content import |
| **Testing** | Unit tests (Vitest) + E2E tests (Playwright) |
| **CI/CD** | GitHub Actions automated pipeline |
| **Security** | Helmet, rate limiting, input validation |
| **Caching** | Redis (Upstash) for performance |
| **Error Monitoring** | Sentry integration |
| **Cloud Deployment** | Vercel + Render production setup |

---

## 🛠️ Tech Stack

### Frontend
```
Next.js 16 (App Router) • React 19 • TypeScript • Tailwind CSS
```

### Backend
```
Express.js • Node.js 20+ • TypeScript (Strict) • MongoDB Atlas
```

### Infrastructure
```
Vercel (Frontend) • Render (Backend) • Upstash Redis • Cloudinary CDN
```

### Integrations
```
Cashfree (Payments) • Firecrawl (AI Scraping) • Sentry (Monitoring)
```

### DevOps & Testing
```
GitHub Actions • Vitest • Playwright • Docker-ready
```

<details>
<summary>📊 Full Tech Stack Table</summary>

| Category | Technologies |
|----------|--------------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS |
| **Backend** | Express.js, Node.js 20+, TypeScript (Strict Mode) |
| **Database** | MongoDB Atlas with Mongoose ODM |
| **Caching** | Upstash Redis (Serverless) |
| **File Storage** | Cloudinary (CDN + Image Optimization) |
| **Payments** | Cashfree Payment Gateway |
| **AI/ML** | Firecrawl (Web Scraping + Structured Extraction) |
| **Auth** | JWT + HTTP-only Cookies |
| **Security** | Helmet.js, express-rate-limit, Zod Validation |
| **Testing** | Vitest (Unit), Playwright (E2E) |
| **CI/CD** | GitHub Actions |
| **Monitoring** | Sentry (Error Tracking) |
| **Hosting** | Vercel (Frontend), Render (Backend) |

</details>

---

## ✨ Features

### 👨‍🎨 Creator Dashboard
- ✅ Full CRUD operations for digital products
- ✅ AI-powered product import via Firecrawl
- ✅ Automated image processing + Cloudinary CDN
- ✅ Real-time sales tracking & analytics
- ✅ Draft/Publish workflow
- ✅ Order history with transaction details

### 🛒 Buyer Experience
- ✅ Browse and discover digital products
- ✅ Secure checkout with Cashfree
- ✅ Personal library for purchased products
- ✅ Authenticated file downloads

### 🔐 Security & Performance
- ✅ JWT authentication with HTTP-only cookies
- ✅ Helmet.js security headers
- ✅ Rate limiting (10 auth / 100 API per 15min)
- ✅ Zod input validation
- ✅ Redis caching layer
- ✅ Sentry error tracking

---

## 🏗️ System Architecture

 ![System Architecture](./screens/architecture.png) 

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- MongoDB database (or MongoDB Atlas account)
- Cloudinary account (free tier works)
- Cashfree account (sandbox for testing)
- Firecrawl API key (optional, for AI import)

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/AkshayAlgoX/gamora-saas-platform.git
cd gamora-saas-platform
```

### 2️⃣ Backend Setup
```bash
cd backend
npm install

# Create environment file
cp .env.example .env
# Edit .env with your credentials (see Environment Variables section)

# Start development server
npm run dev
```

### 3️⃣ Frontend Setup
```bash
cd client
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your settings

# Start development server
npm run dev
```

### 4️⃣ Open the App
```
Frontend: http://localhost:3000
Backend:  http://localhost:5000
```

---

## 🔑 Environment Variables

<details>
<summary><strong>Backend (.env)</strong></summary>

```env
# Server
PORT=5000

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gumora

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
COOKIE_NAME=gamora_session

# Cloudinary (Image Storage)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Cashfree (Payments)
CASHFREE_APP_ID=your-app-id
CASHFREE_SECRET_KEY=your-secret-key
CASHFREE_ENV=sandbox  # or 'production'

# Firecrawl (AI Import - Optional)
FIRECRAWL_API_KEY=your-api-key

# Frontend URLs
WEB_BASE_URL=http://localhost:3000
FRONTEND_ORIGIN=http://localhost:3000

# Sentry (Error Monitoring - Optional)
SENTRY_DSN=your-sentry-dsn

# Upstash Redis (Caching - Optional)
UPSTASH_REDIS_REST_URL=your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

</details>

<details>
<summary><strong>Frontend (.env.local)</strong></summary>

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_CASHFREE_ENV=sandbox
```

</details>

---

## 🔌 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/register` | Register new user | ❌ |
| `POST` | `/api/auth/login` | Login user | ❌ |
| `GET` | `/api/auth/me` | Get current user | ✅ |
| `POST` | `/api/auth/logout` | Logout user | ✅ |
| `GET` | `/api/creator/products` | List creator's products | ✅ |
| `POST` | `/api/creator/products` | Create new product | ✅ |
| `PUT` | `/api/creator/products/:id` | Update product | ✅ |
| `DELETE` | `/api/creator/products/:id` | Delete product | ✅ |
| `POST` | `/api/creator/products/import` | AI import product | ✅ |
| `GET` | `/api/public/products` | List published products | ❌ |
| `GET` | `/api/public/products/:slug` | Get product by slug | ❌ |
| `POST` | `/api/checkout/create-order` | Create payment order | ✅ |
| `POST` | `/api/checkout/verify` | Verify payment | ❌ |
| `GET` | `/api/library` | Get user's library | ✅ |
| `GET` | `/api/library/:id/download` | Download asset | ✅ |
| `GET` | `/api/creator/sales` | Get sales data | ✅ |

---

## 🧪 Testing

### Run Unit Tests
```bash
cd backend
npm test                 # Run once
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report
```

### Run E2E Tests
```bash
cd client
npm run test:e2e         # Headless
npm run test:e2e:ui      # Interactive UI
```

---

## 📦 Project Structure

```
gamora-saas-platform/
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI/CD pipeline
├── backend/
│   ├── src/
│   │   ├── app.ts              # Express app setup
│   │   ├── server.ts           # Server entry point
│   │   ├── db.ts               # MongoDB connection
│   │   ├── lib/                # Utilities
│   │   │   ├── auth.ts         # JWT helpers
│   │   │   ├── cashfree.ts     # Payment gateway
│   │   │   ├── cloudinary.ts   # Image upload
│   │   │   ├── firecrawl.ts    # AI scraping
│   │   │   ├── cache.ts        # Redis caching
│   │   │   └── sentry.ts       # Error tracking
│   │   ├── middleware/
│   │   │   └── requireAuth.ts  # Auth middleware
│   │   ├── models/             # MongoDB schemas
│   │   │   ├── Users.ts
│   │   │   ├── Product.ts
│   │   │   ├── Order.ts
│   │   │   └── ImageAsset.ts
│   │   ├── routes/             # API routes
│   │   │   ├── auth.ts
│   │   │   ├── checkout.ts
│   │   │   ├── creatorProduct.ts
│   │   │   ├── creatorSales.ts
│   │   │   ├── library.ts
│   │   │   └── publicProduct.ts
│   │   └── utils/
│   │       └── slug.ts
│   ├── tests/                  # Unit tests
│   ├── vitest.config.ts
│   ├── tsconfig.json
│   └── package.json
├── client/
│   ├── src/
│   │   ├── app/                # Next.js App Router
│   │   │   ├── (auth)/         # Auth pages
│   │   │   ├── (buyer)/        # Buyer pages
│   │   │   ├── (creator)/      # Creator dashboard
│   │   │   └── api/            # API proxy
│   │   └── lib/                # Client utilities
│   ├── components/             # React components
│   ├── e2e/                    # Playwright tests
│   ├── playwright.config.ts
│   └── package.json
├── screens/                    # Screenshots (add your own)
└── README.md
```

---

## 🔒 Security Implementation

| Feature | Implementation |
|---------|----------------|
| **HTTP Headers** | Helmet.js with strict CSP |
| **Rate Limiting** | 10 auth / 100 API requests per 15 min |
| **Authentication** | JWT with HTTP-only, SameSite cookies |
| **Password Hashing** | bcrypt with salt rounds |
| **Input Validation** | Zod schema validation on all inputs |
| **CORS** | Whitelist-based origin control |
| **Error Handling** | Sanitized error messages, Sentry logging |

---

## 🚀 Deployment

### Frontend → Vercel
1. Connect GitHub repo to Vercel
2. Set environment variables in dashboard
3. Auto-deploys on push to `main`

### Backend → Render
1. Create Web Service on Render
2. Connect GitHub repo
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add environment variables

---

##  Challenges Faced & Learnings

<details>
<summary><strong>🔧 Cross-Origin Cookie Handling</strong></summary>

**Challenge:** JWT cookies not being sent from Vercel frontend to Render backend due to cross-origin restrictions.

**Solution:** Implemented HTTP-only cookies with `SameSite=None; Secure` and proper CORS configuration with `credentials: true`.

</details>

<details>
<summary><strong>⚡ Payment Webhook Verification</strong></summary>

**Challenge:** Cashfree webhooks were failing due to signature verification issues.

**Solution:** Created a separate unauthenticated endpoint for webhooks and implemented proper signature verification using HMAC-SHA256.

</details>

<details>
<summary><strong>🤖 AI Content Import</strong></summary>

**Challenge:** Extracting structured product data from arbitrary product pages.

**Solution:** Integrated Firecrawl with custom JSON schema extraction to reliably parse product names, descriptions, prices, and images.

</details>

---

## 📋 Resume-Ready Summary

> **Copy this for your resume:**

```
Built a full-stack SaaS platform (Gumora) enabling creators to sell digital products.
Implemented AI-powered content import using Firecrawl, secure payment processing via
Cashfree, JWT authentication with cross-origin cookie handling, and real-time sales
analytics. Features include Redis caching, Sentry error monitoring, CI/CD pipeline
with GitHub Actions, and comprehensive test coverage using Vitest and Playwright.
Tech: Next.js, React, TypeScript, Express.js, MongoDB, Redis, Cloudinary.
```

---

## 👨‍💻 About the Developer

Built with ❤️ by **Akshay** 

- 🔗 GitHub: [@AkshayAlgoX](https://github.com/AkshayAlgoX)
- 🌐 Live Demo: [gumora.shop](https://gumora.shop)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>⭐ Star this repo if you found it helpful!</strong>
</p>
