import { Cashfree, CFEnvironment } from "cashfree-pg";

const cf = Cashfree as any;

cf.clientId = process.env.CASHFREE_APP_ID!;
cf.clientSecret = process.env.CASHFREE_SECRET_KEY!;
cf.environment =
  process.env.CASHFREE_ENV === "production"
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX;

export { Cashfree };
