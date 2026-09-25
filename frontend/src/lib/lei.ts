/** Legal Entity Identifier (ISO 17442): 18 letters/digits + 2 check
 * digits. Used by the ESEF history import (filings.xbrl.org is keyed by
 * LEI). The ISO 7064 mod 97-10 check digits are verified too, so a typo is
 * caught before the request. */
export function normalizeLei(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function isValidLei(raw: string): boolean {
  const lei = normalizeLei(raw);
  if (!/^[A-Z0-9]{18}[0-9]{2}$/.test(lei)) return false;
  // Letters -> 10..35, then the whole number mod 97 must be 1.
  let remainder = 0;
  for (const ch of lei) {
    const digits = /[0-9]/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}
