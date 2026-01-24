import { Cashfree, CFEnvironment } from "cashfree-pg";

// Cashfree v3 uses static config
(Cashfree as any).XClientId = process.env.CASHFREE_APP_ID;
(Cashfree as any).XClientSecret = process.env.CASHFREE_SECRET_KEY;
(Cashfree as any).XEnvironment = process.env.CASHFREE_ENV === "production" 
  ? CFEnvironment.PRODUCTION 
  : CFEnvironment.SANDBOX;

export { Cashfree };
