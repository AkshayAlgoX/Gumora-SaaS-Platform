import axios from "axios";

export const cashfree = axios.create({
  baseURL:
    process.env.CASHFREE_ENV === "production"
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg",
  headers: {
    "x-client-id": process.env.CASHFREE_APP_ID!,
    "x-client-secret": process.env.CASHFREE_SECRET_KEY!,
    "x-api-version": "2023-08-01",
    "Content-Type": "application/json",
  },
});
