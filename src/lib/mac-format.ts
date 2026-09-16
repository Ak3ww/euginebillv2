/**
 * Format string into standard MAC Address format (XX:XX:XX:XX:XX:XX)
 * - Automatically converts to uppercase
 * - Strips non-alphanumeric characters
 * - Inserts ':' after every 2 characters
 * - Limits to maximum 12 characters (6 pairs)
 * - Handles backspace smoothly so deleting a colon removes the preceding character
 */
export function formatMacAddress(input: string, prevValue?: string): string {
  if (!input) return '';

  let val = input;
  // If user is backspacing over a colon:
  // e.g. prevValue was "BD:C" and input is "BD:" -> trim colon so user gets "BD"
  if (prevValue && prevValue.endsWith(':') && val.length === prevValue.length - 1) {
    val = val.slice(0, -1);
  }

  // Extract alphanumeric characters (0-9, A-Z), max 12 characters
  const clean = val.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 12);
  if (!clean) return '';

  // Group into pairs of 2 separated by ':'
  const chunks = clean.match(/.{1,2}/g);
  return chunks ? chunks.join(':') : clean;
}
