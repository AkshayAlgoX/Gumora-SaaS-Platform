

import cookieParser from 'cookie-parser';
import express from 'express'; 
import cors from 'cors';
import { authRouter } from './routes/auth';
import { createProductRouter } from './routes/creatorProduct';
import { creatorImportRouter } from './routes/creatorImport';
import { creatorSalesRouter } from './routes/creatorSales';
import { publicProductsRouter } from './routes/publicProduct';
import { checkoutRouter } from './routes/checkout';
import { libraryRouter } from './routes/library';


export function createApp(){

    const app = express();

    const allowedOrigins = [
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
    app.use(express.json({}));

    app.use("/api/auth",authRouter);
    app.use("/api/creator/products",createProductRouter)
    app.use("/api/creator/products",creatorImportRouter)
    app.use("/api/creator/sales",creatorSalesRouter)
    app.use("/api/products", publicProductsRouter);
    app.use("/api/checkout", checkoutRouter);
    app.use("/api/library",libraryRouter);


    app.get("/healthz", (_req, res) => {
  res.status(200).send("OK");
});


    return app;

}