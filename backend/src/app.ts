

import cookieParser from 'cookie-parser';
import express from 'express'; 
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth';
import { createProductRouter } from './routes/creatorProduct';
import { creatorImportRouter } from './routes/creatorImport';
import { creatorSalesRouter } from './routes/creatorSales';
import { publicProductsRouter } from './routes/publicProduct';
import { checkoutRouter } from './routes/checkout';
import { libraryRouter } from './routes/library';

// Rate limiters
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: { ok: false, error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 auth attempts per window
    message: { ok: false, error: 'Too many auth attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

export function createApp(){

    const app = express();

    // Security headers
    app.use(helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        contentSecurityPolicy: false, // Disable for API
    }));

    // Trust proxy for rate limiting behind reverse proxy (Render)
    app.set('trust proxy', 1);

    const allowedOrigins = [
        "https://gumora.shop",
        "https://www.gumora.shop",
        "https://gamora-saas-platform.vercel.app",
        /^https:\/\/gamora-saas-platform-.*\.vercel\.app$/,
        process.env.FRONTEND_ORIGIN || "http://localhost:3000",
    ];

    app.use(
        cors({
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.some(allowed => 
                    typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
                )) {
                    callback(null, true);
                } else {
                    callback(new Error('CORS not allowed'));
                }
            },
            credentials : true
        })
    );
    
    app.use(cookieParser());
    app.use(express.json({ limit: '10mb' }));

    // Apply rate limiters
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/register', authLimiter);
    app.use('/api/', generalLimiter);

    app.use("/api/auth",authRouter);
    app.use("/api/creator/products",createProductRouter)
    app.use("/api/creator/products",creatorImportRouter)
    app.use("/api/creator/sales",creatorSalesRouter)
    app.use("/api/products", publicProductsRouter);
    app.use("/api/checkout", checkoutRouter);
    app.use("/api/library",libraryRouter);


    // Health check endpoint
    app.get("/healthz", (_req, res) => {
        res.status(200).send("OK");
    });

    // Root endpoint - API info
    app.get("/", (_req, res) => {
        res.json({
            name: "Gumora API",
            version: "1.0.0",
            status: "running",
            docs: "https://github.com/AkshayAlgoX/gamora-saas-platform",
            endpoints: {
                health: "/healthz",
                auth: "/api/auth",
                products: "/api/products",
                checkout: "/api/checkout",
                library: "/api/library"
            }
        });
    });

    return app;

}