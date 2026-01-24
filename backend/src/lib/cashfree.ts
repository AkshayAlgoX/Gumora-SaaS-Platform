import { Cashfree, CFEnvironment } from "cashfree-pg";

// Cashfree v3 uses static config
(Cashfree as any).XClientId = process.env.CASHFREE_APP_ID;
(Cashfree as any).XClientSecret = process.env.CASHFREE_SECRET_KEY;
(Cashfree as any).XEnvironment = CFEnvironment.SANDBOX;

export { Cashfree };
