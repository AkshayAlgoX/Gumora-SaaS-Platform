/**
 * Exact money handling for INR amounts.
 *
 * Prices and Cashfree `order_amount` values are decimal rupee amounts carried
 * as JavaScript numbers. Comparing them with a floating-point tolerance can
 * accept amounts that differ by a paisa, so authoritative comparisons convert
 * both sides to integer minor units (paise) and compare exactly. Values that
 * cannot be represented exactly with at most two decimal places are rejected
 * instead of being rounded.
 */

export const SUPPORTED_CURRENCY = "INR" as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCY;

const DECIMAL_AMOUNT = /^(\d+)(?:\.(\d{1,2}))?$/;

export class InvalidAmountError extends Error {
  constructor(value: unknown) {
    super(`Amount is not a valid two-decimal currency value: ${String(value)}`);
    this.name = "InvalidAmountError";
  }
}

/**
 * Convert a non-negative decimal amount with at most two fractional digits to
 * integer minor units. Throws InvalidAmountError for NaN, Infinity, negative
 * values, exponent notation, more than two decimals (including binary float
 * artefacts such as 0.1 + 0.2) and values beyond Number.MAX_SAFE_INTEGER paise.
 */
export function toMinorUnits(value: unknown): number {
  let text: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) throw new InvalidAmountError(value);
    // String(n) yields the shortest round-tripping representation, so a value
    // that is not exactly a two-decimal amount shows extra digits or an
    // exponent and fails the pattern below.
    text = String(value);
  } else if (typeof value === "string") {
    text = value.trim();
  } else {
    throw new InvalidAmountError(value);
  }

  const match = DECIMAL_AMOUNT.exec(text);
  if (!match) throw new InvalidAmountError(value);

  const whole = match[1];
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const minor = Number(whole) * 100 + Number(fraction);
  if (!Number.isSafeInteger(minor)) throw new InvalidAmountError(value);
  return minor;
}

/** Returns the minor-unit value, or null when the amount is not exact. */
export function tryToMinorUnits(value: unknown): number | null {
  try {
    return toMinorUnits(value);
  } catch {
    return null;
  }
}
