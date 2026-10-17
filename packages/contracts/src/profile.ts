/**
 * A user's own basic details (owner or ally). Self-entered and optional: the
 * ally's `mobile` lets the owner's device open WhatsApp straight to them, and
 * `displayName` replaces the generic "your Safety Ally" label. Never sourced
 * from a caller.
 */
export interface UserProfile {
  displayName?: string;
  /** As typed by the user; normalize with `toWhatsAppNumber` only when building a link. */
  mobile?: string;
}

/** Editable bounds shared by the API schema and the form. */
export const PROFILE_NAME_MAX = 60;

/**
 * Reduces a typed mobile number to the digits-only international form that
 * `https://wa.me/<number>` expects. A 10-digit number is assumed to be Indian
 * (+91). Returns null when it cannot be a plausible number (7-15 digits).
 */
export function toWhatsAppNumber(mobile: string | undefined): string | null {
  if (!mobile) return null;
  const digits = mobile.replace(/\D/g, '');
  const national = digits.length === 10 ? `91${digits}` : digits.replace(/^0+/, '');
  return national.length >= 7 && national.length <= 15 ? national : null;
}
