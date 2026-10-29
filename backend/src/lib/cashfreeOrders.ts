import z from "zod";
import { cashfree } from "./cashfree";

/**
 * The subset of the Cashfree PG "Get Order" response that settlement relies on.
 * Every field is required: a response that omits or malforms any of them is
 * rejected rather than treated as matching.
 *
 * order_status values documented by Cashfree: ACTIVE, PAID, EXPIRED,
 * TERMINATED, TERMINATION_REQUESTED. Unknown values are kept as strings and
 * simply fail the `=== "PAID"` check.
 */
export const CashfreeOrderSchema = z.object({
  order_id: z.string().min(1),
  order_status: z.string().min(1),
  order_amount: z.number().finite(),
  order_currency: z.string().length(3),
});

export type CashfreeOrder = z.infer<typeof CashfreeOrderSchema>;

/** Gateway port used by settlement; tests supply a fake implementation. */
export interface PaymentGateway {
  /** Resolves with the raw provider payload; settlement validates it. */
  getOrder(providerOrderId: string): Promise<unknown>;
}

export const cashfreeGateway: PaymentGateway = {
  async getOrder(providerOrderId) {
    const resp = await cashfree.get(`/orders/${encodeURIComponent(providerOrderId)}`);
    return resp.data;
  },
};
