# Gamora - Digital Products Marketplace

🌐 **Live Demo:** [https://gumora.shop](https://gumora.shop)

A production-ready, full-stack SaaS platform enabling creators to monetize digital products. Features AI-powered content import, secure payment processing, and enterprise-grade security. Demonstrates modern web development practices including TypeScript, CI/CD pipelines, caching, and comprehensive testing.

![CI/CD](https://github.com/AkshayAlgoX/gamora-saas-platform/actions/workflows/ci.yml/badge.svg)

## 🎯 Key Highlights

- **Full-Stack TypeScript** - End-to-end type safety with strict mode
- **AI Integration** - Firecrawl-powered intelligent content scraping
- **Payment Processing** - Complete Cashfree payment gateway integration
- **Production Security** - Helmet, rate limiting, JWT authentication
- **Cloud-Native** - Deployed on Vercel + Render with Redis caching
- **CI/CD Pipeline** - Automated testing and deployment via GitHub Actions
- **Comprehensive Testing** - Unit tests (Vitest) + E2E tests (Playwright)

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│                         (Vercel - Next.js 16)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Auth      │  │  Creator    │  │   Buyer     │  │  Payment    │    │
│  │   Pages     │  │  Dashboard  │  │  Discover   │  │  Flow       │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (REST API)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                     │
│                        (Render - Express.js)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Auth      │  │  Products   │  │  Checkout   │  │  Library    │    │
│  │   Routes    │  │  CRUD       │  │  Payment    │  │  Downloads  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Security: Helmet │ Rate Limiting │ JWT Auth │ Input Validation │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│  MongoDB    │     │   Cloudinary    │     │  Cashfree   │
│  Atlas      │     │   (Images)      │     │  (Payments) │
│  (Database) │     │                 │     │             │
└─────────────┘     └─────────────────┘     └─────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │  Firecrawl  │
                    │  (AI Scrape)│
                    └─────────────┘
```

## ✨ Features

### Creator Dashboard
- 📝 **Product Management** - Full CRUD operations with draft/publish workflow
- 🔥 **AI-Powered Import** - Firecrawl integration for intelligent content scraping with structured JSON output
- 🖼️ **Media Pipeline** - Automated image processing and Cloudinary CDN hosting
- 📊 **Analytics Dashboard** - Real-time sales tracking and revenue insights
- 💰 **Revenue Management** - Order history with detailed transaction records

### Buyer Experience
- 🛒 **Product Discovery** - Browse and search published digital products
- 💳 **Secure Checkout** - PCI-compliant payment processing via Cashfree
- 📚 **Digital Library** - Access purchased products with download management
- ⬇️ **Asset Delivery** - Secure, authenticated file downloads

### Technical Implementation
- 🔐 **Authentication** - JWT with HTTP-only cookies, cross-origin session handling
- 🛡️ **Security Layer** - Helmet headers, rate limiting (10 auth/100 API per 15min), Zod validation
- ⚡ **Performance** - Redis caching (Upstash), optimized database queries
- 🧪 **Testing Suite** - Unit tests (Vitest) + E2E tests (Playwright)
- 🚀 **DevOps** - GitHub Actions CI/CD, automated deployments
- 📈 **Observability** - Sentry error tracking, structured logging

## 🛠️ Tech Stack

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

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- MongoDB database
- Cloudinary account
- Cashfree account
- Firecrawl API key

### Backend Setup

```bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Fill in your environment variables

npm run dev
```

### Frontend Setup

```bash
cd client
npm install

# Create .env.local file
cp .env.example .env.local
# Fill in your environment variables

npm run dev
```

## 📝 Environment Variables

### Backend (.env)
```env
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
COOKIE_NAME=gamora_session

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Cashfree
CASHFREE_APP_ID=your-app-id
CASHFREE_SECRET_KEY=your-secret-key
CASHFREE_ENV=sandbox

# Firecrawl
FIRECRAWL_API_KEY=your-api-key

# Frontend URL
WEB_BASE_URL=http://localhost:3000
FRONTEND_ORIGIN=http://localhost:3000

# Sentry (optional)
SENTRY_DSN=your-sentry-dsn
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_CASHFREE_ENV=sandbox
```

## 🧪 Testing

### Backend Unit Tests
```bash
cd backend
npm test                 # Run tests once
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage
```

### Frontend E2E Tests
```bash
cd client
npm run test:e2e         # Run E2E tests
npm run test:e2e:ui      # Interactive UI mode
```

## 📦 Project Structure

```
├── .github/
│   └── workflows/
│       └── ci.yml           # GitHub Actions CI/CD
├── backend/
│   ├── src/
│   │   ├── lib/             # Utilities (auth, cloudinary, firecrawl, sentry)
│   │   ├── middleware/      # Express middleware
│   │   ├── models/          # MongoDB models
│   │   ├── routes/          # API routes
│   │   └── utils/           # Helper functions
│   ├── tests/               # Unit tests
│   └── vitest.config.ts
├── client/
│   ├── components/          # React components
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   └── lib/             # Client utilities
│   ├── e2e/                 # Playwright E2E tests
│   └── playwright.config.ts
└── README.md
```

## 🔒 Security Features

- **Helmet.js** - Secure HTTP headers
- **Rate Limiting** - Prevents brute force attacks
  - Auth routes: 10 requests/15 min
  - General API: 100 requests/15 min
- **Input Validation** - Zod schema validation
- **JWT + HTTP-only Cookies** - Secure session management
- **CORS** - Whitelist-based origin control

## 🚀 Deployment

### Vercel (Frontend)
1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main

### Render (Backend)
1. Create a new Web Service on Render
2. Connect your GitHub repo
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Add environment variables

## 📊 Monitoring

### Sentry Setup (Free Tier)
1. Create account at [sentry.io](https://sentry.io)
2. Create a Node.js project
3. Copy the DSN to `SENTRY_DSN` environment variable
4. Errors are automatically captured and reported

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

---

### 💼 About This Project

This project demonstrates proficiency in:
- **Full-Stack Development** - Complete frontend + backend implementation
- **System Design** - Microservices architecture with proper separation of concerns
- **Third-Party Integrations** - Payment gateways, AI APIs, cloud storage
- **DevOps Practices** - CI/CD, automated testing, monitoring
- **Security Best Practices** - Authentication, rate limiting, input validation

Built with ❤️ by [Akshay](https://github.com/AkshayAlgoX)
