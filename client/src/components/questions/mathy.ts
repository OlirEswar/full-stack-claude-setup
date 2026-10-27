/**
 * Heuristic: does this short string read as math (a value or expression) rather than prose?
 * Math gets the mono face so digits line up and expressions look crisp.
 * "s = −2 ± j3", "0.707", "ζ < 1" → true; "Increase the gain" → false.
 */
export function isMathy(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/[A-Za-z]{4,}/.test(t)) return false;
  return /[\d=±×·^√∞≈<>≤≥ζωστθφ]/.test(t);
}
