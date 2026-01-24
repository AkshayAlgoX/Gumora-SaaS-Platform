import mongoose, { Schema, Types } from "mongoose";

export type OrderStatus = "pending" | "paid" | "failed";
export type PaymentProvider = "razorpay" | "cashfree";

export type OrderDoc = {
  buyerId: Types.ObjectId;
  productId: Types.ObjectId;

  amount: number;
  currency: "INR";

  status: OrderStatus;
  provider: PaymentProvider;

  providerOrderId: string;
  providerPaymentId?: string;

  paidAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};

const OrderSchema = new Schema<OrderDoc>(
  {
    buyerId: { type: Schema.Types.ObjectId, required: true, index: true },
    productId: { type: Schema.Types.ObjectId, required: true, index: true },

    amount: { type: Number, required: true },

    currency: { type: String, enum: ["INR"], default: "INR" },

    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      required: true,
    },

    provider: {
      type: String,
      enum: ["razorpay", "cashfree"],
      required: true,
      default: "cashfree",
    },

    providerOrderId: { type: String, required: true, index: true },
    providerPaymentId: { type: String },

    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

OrderSchema.index({ buyerId: 1, productId: 1, status: 1 });

export const Order = mongoose.model<OrderDoc>("Order", OrderSchema);
