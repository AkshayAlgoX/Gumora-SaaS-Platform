import Cashfree from "cashfree-pg";

const CF = Cashfree as any;

CF.XClientId = process.env.CASHFREE_APP_ID!;
CF.XClientSecret = process.env.CASHFREE_SECRET_KEY!;
CF.XEnvironment =
  process.env.CASHFREE_ENV === "production" ? "PRODUCTION" : "SANDBOX";

export { Cashfree };
