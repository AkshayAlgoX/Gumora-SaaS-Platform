# Gamora - Digital Products Marketplace (Gumroad Clone)

A full-stack SaaS platform for creators to sell digital products. Built with modern technologies and production-ready features.

![CI/CD](https://github.com/AkshayAlgoX/gamora-saas-platform/actions/workflows/ci.yml/badge.svg)

## 🏗️ Architecture

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

### For Creators
- 📝 Create and manage digital products
- 🔥 **Firecrawl AI Import** - Auto-scrape images and descriptions from any URL
- 🖼️ Cloudinary image hosting with auto-optimization
- 📊 Sales dashboard with order tracking
- 💰 Real-time revenue tracking

### For Buyers
- 🛒 Discover and purchase digital products
- 💳 Secure payments via Cashfree
- 📚 Personal library of purchased products
- ⬇️ One-click asset downloads

### Technical Features
- 🔐 JWT authentication with HTTP-only cookies
- 🛡️ Security: Helmet, rate limiting, input validation
- ✅ TypeScript strict mode
- 🧪 Unit tests (Vitest) + E2E tests (Playwright)
- 🚀 CI/CD with GitHub Actions
- 📈 Sentry error monitoring
- 🌐 Cross-origin session handling

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS, TypeScript |
| Backend | Express.js, Node.js, TypeScript |
| Database | MongoDB Atlas |
| Image Storage | Cloudinary |
| Payments | Cashfree (Sandbox/Production) |
| AI Scraping | Firecrawl |
| Hosting | Vercel (Frontend), Render (Backend) |
| Monitoring | Sentry |
| CI/CD | GitHub Actions |

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

Built with ❤️ by [Akshay](https://github.com/AkshayAlgoX)
