/**
 * Shared String Utility Functions
 */

/**
 * Normalizes an email address by converting it to lowercase and trimming leading/trailing whitespace.
 * Preserves all valid email characters including '.', '_', '+', and '-'.
 */
export function normalizeEmail(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

/**
 * Masks an email address for privacy display.
 * Example: "arielpesalver1998@gmail.com" -> "arielpesalv******@gmail.com"
 */
export function maskEmail(email: unknown): string {
  if (!email) return "";
  const str = String(email).trim();
  if (!str.includes('@')) return str;
  
  const [local, domain] = str.split('@');
  if (!local || local.length === 0) return str;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  
  const visibleLength = local.length >= 12 ? 10 : Math.max(2, Math.floor(local.length / 2));
  const visiblePart = local.slice(0, visibleLength);
  const maskedPart = '*'.repeat(Math.max(4, local.length - visibleLength));
  return `${visiblePart}${maskedPart}@${domain}`;
}
