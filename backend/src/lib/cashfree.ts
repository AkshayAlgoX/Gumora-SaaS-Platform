import { Cashfree, CFEnvironment } from "cashfree-pg";
console.log("CASHFREE KEYS:", Object.keys(Cashfree));   // 
const CF = Cashfree as any;

CF.clientId = process.env.CASHFREE_APP_ID!;
CF.clientSecret = process.env.CASHFREE_SECRET_KEY!;
CF.environment =
  process.env.CASHFREE_ENV === "production"
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX;

export { Cashfree };
