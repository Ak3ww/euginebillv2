/**
 * Smart Matcher Engine for OLT ONU <-> PPPoE Customer Association
 * Handles Indonesian naming quirks, ISP prefixes, abbreviations, typos, and token overlaps.
 */

export interface CandidateCustomer {
  id: string;
  username: string;
  name: string;
  phone?: string | null;
  customerId?: string | null;
  status?: string | null;
  macAddress?: string | null;
  routerId?: string | null;
  routerName?: string | null;
}

export interface MatchResult {
  customer: CandidateCustomer;
  score: number; // 0 - 100
  matchType: 'SERIAL_NUMBER' | 'MAC_ADDRESS' | 'EXACT_NAME' | 'EXACT_USERNAME' | 'CUSTOMER_ID' | 'ABBREVIATION' | 'TOKEN_OVERLAP' | 'FUZZY_NAME';
  reason: string;
}

/**
 * Normalize and clean customer name or OLT description
 * Strips ISP prefixes, converts hyphens to spaces, removes noise, titles, and trailing IDs.
 */
export function cleanCustomerName(input: string | null | undefined): string {
  if (!input) return '';
  let str = input.toUpperCase().trim();

  // 1. Remove common ISP prefixes: PELANGGAN:, CUST:, USER:
  str = str.replace(/^(PELANGGAN|CUST|CUSTOMER|USER)\s*:\s*/i, '');

  // 2. Replace hyphens and underscores between words/letters with spaces (e.g. "ARIESTA-MIRANDA" -> "ARIESTA MIRANDA")
  str = str.replace(/[-_]+/g, ' ');

  // 3. Remove punctuation / noise characters: . , | / \ ( ) [ ]
  str = str.replace(/[.,|/\\()[\]]/g, ' ');

  // 4. Remove common honorifics/titles in Indonesian context
  str = str.replace(/\b(IR|DR|DRS|BAPAK|IBU|PAK|BU|HJ|H|RADEN)\b/g, '');

  // 5. Remove trailing IDs / telephone-like numbers (e.g. " - 830539", " 312367")
  str = str.replace(/\s+\d{4,}$/g, '');

  // 6. Collapse multiple spaces into single space
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Strip all non-alphanumerics and lowercase for compact comparison
 */
export function toCompactAlphanumeric(input: string | null | undefined): string {
  if (!input) return '';
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Expand common Indonesian name abbreviations (e.g. "M RAFLY" -> "MUHAMMAD RAFLY")
 */
export function expandAbbreviations(name: string): string {
  let res = name.trim();
  // M / M. / MUH. -> MUHAMMAD
  res = res.replace(/^(M|MUH)\s+/i, 'MUHAMMAD ');
  // ACH / AKH / ACH. -> AHMAD
  res = res.replace(/^(ACH|AKH)\s+/i, 'AHMAD ');
  // R / R. -> RADEN
  res = res.replace(/^R\s+/i, 'RADEN ');
  return res.replace(/\s+/g, ' ').trim();
}

/**
 * Bigram / Dice's coefficient string similarity (returns 0.0 to 1.0)
 */
export function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;
  if (a.length < 2 || b.length < 2) return a === b ? 1.0 : 0.0;

  const getBigrams = (str: string) => {
    const s = str.toLowerCase();
    const bigrams = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
    }
    return bigrams;
  };

  const aBigrams = getBigrams(a);
  const bBigrams = getBigrams(b);

  let intersection = 0;
  for (const [bg, countA] of aBigrams.entries()) {
    const countB = bBigrams.get(bg) || 0;
    intersection += Math.min(countA, countB);
  }

  const total = (a.length - 1) + (b.length - 1);
  return total > 0 ? (2.0 * intersection) / total : 0.0;
}

/**
 * Calculate token (word) overlap ratio between two strings
 */
export function tokenOverlapRatio(strA: string, strB: string): { ratio: number; matchingWords: string[] } {
  const wordsA = strA.split(/\s+/).filter(w => w.length >= 2);
  const wordsB = strB.split(/\s+/).filter(w => w.length >= 2);
  if (wordsA.length === 0 || wordsB.length === 0) return { ratio: 0, matchingWords: [] };

  const setB = new Set(wordsB);
  const matching = wordsA.filter(w => setB.has(w));

  // Ratio based on smaller token set (inclusion)
  const minLen = Math.min(wordsA.length, wordsB.length);
  const ratio = minLen > 0 ? matching.length / minLen : 0;
  return { ratio, matchingWords: matching };
}

export interface MatchOptions {
  oltRouterIds?: string[];
  minScoreThreshold?: number; // default 80
}

/**
 * Evaluate a single ONU against customer candidates and return best match and ranked suggestions
 */
export function findSmartMatchForOnu(
  onu: {
    serialNumber?: string | null;
    macAddress?: string | null;
    description?: string | null;
  },
  candidates: CandidateCustomer[],
  options: MatchOptions = {}
): { bestMatch: MatchResult | null; suggestions: MatchResult[] } {
  const minScore = options.minScoreThreshold ?? 80;
  const routerSet = new Set(options.oltRouterIds ?? []);

  const onuSnClean = onu.serialNumber?.replace(/[:-]/g, '').toUpperCase() || '';
  const onuMacClean = onu.macAddress?.replace(/[:-]/g, '').toUpperCase() || '';
  const onuRawDesc = onu.description?.trim() || '';
  const onuCleanDesc = cleanCustomerName(onuRawDesc);
  const onuExpandedDesc = expandAbbreviations(onuCleanDesc);
  const onuCompactDesc = toCompactAlphanumeric(onuRawDesc);

  const results: MatchResult[] = [];

  for (const cust of candidates) {
    let score = 0;
    let matchType: MatchResult['matchType'] = 'FUZZY_NAME';
    let reason = '';

    const custSnClean = cust.macAddress?.replace(/[:-]/g, '').toUpperCase() || '';
    const custCleanName = cleanCustomerName(cust.name);
    const custExpandedName = expandAbbreviations(custCleanName);
    const custCompactName = toCompactAlphanumeric(cust.name);
    const custCompactUser = toCompactAlphanumeric(cust.username);
    const custCompactId = toCompactAlphanumeric(cust.customerId);

    // 1. Hardware match (SN or MAC) - Score: 100
    if (onuSnClean && custSnClean && (onuSnClean === custSnClean || custSnClean.includes(onuSnClean) || onuSnClean.includes(custSnClean))) {
      score = 100;
      matchType = 'SERIAL_NUMBER';
      reason = `Serial number ONU cocok dengan perangkat ${cust.name} (${onuSnClean})`;
    } else if (onuMacClean && custSnClean && (onuMacClean === custSnClean || custSnClean.includes(onuMacClean))) {
      score = 100;
      matchType = 'MAC_ADDRESS';
      reason = `MAC address cocok dengan ${cust.name}`;
    }

    // 2. Exact Name Match - Score: 100
    else if (onuCleanDesc && custCleanName && (onuCleanDesc === custCleanName || onuCompactDesc === custCompactName)) {
      score = 100;
      matchType = 'EXACT_NAME';
      reason = `Nama OLT identik dengan pelanggan: "${cust.name}"`;
    }

    // 3. Exact Username Match - Score: 100
    else if (onuCompactDesc && custCompactUser && (onuCompactDesc === custCompactUser)) {
      score = 100;
      matchType = 'EXACT_USERNAME';
      reason = `Deskripsi OLT identik dengan username PPPoE: "${cust.username}"`;
    }

    // 4. Customer ID / EMG Code Match - Score: 98
    else if (custCompactId && custCompactId.length >= 4 && onuCompactDesc.includes(custCompactId)) {
      score = 98;
      matchType = 'CUSTOMER_ID';
      reason = `Deskripsi OLT mengandung ID Pelanggan: "${cust.customerId}"`;
    }

    // 5. Abbreviation Expansion Match (e.g. M-RAFLY vs MUHAMMAD RAFLY) - Score: 95
    else if (onuExpandedDesc && custExpandedName && onuExpandedDesc === custExpandedName) {
      score = 95;
      matchType = 'ABBREVIATION';
      reason = `Singkatan nama cocok: "${onuRawDesc}" -> "${cust.name}"`;
    }

    // 6. Token Overlap Match (e.g. PARYONO RT05 vs PARYONO, or AHMAD IBRAHIM vs AHMAD IBRAHIM RANGKUTY)
    else if (onuCleanDesc && custCleanName) {
      const { ratio, matchingWords } = tokenOverlapRatio(onuCleanDesc, custCleanName);
      if (ratio >= 1.0 && matchingWords.length >= 1) {
        // All words of the shorter name exist in the longer name!
        score = 90 + Math.min(matchingWords.length, 3); // 91 - 93
        matchType = 'TOKEN_OVERLAP';
        reason = `Kata kunci "${matchingWords.join(' ')}" terdapat di OLT dan nama pelanggan`;
      } else if (ratio >= 0.66 && matchingWords.length >= 2) {
        score = 86;
        matchType = 'TOKEN_OVERLAP';
        reason = `Sebagian besar kata ("${matchingWords.join(' ')}") cocok`;
      } else {
        // 7. Fuzzy Dice Similarity (Typo tolerance, e.g. ARIESTA-MIRANDA vs ARIESTA MIRADA)
        const simName = diceSimilarity(onuCleanDesc, custCleanName);
        const simUser = custCompactUser ? diceSimilarity(onuCompactDesc, custCompactUser) : 0;
        const maxSim = Math.max(simName, simUser);

        if (maxSim >= 0.80) {
          score = Math.round(maxSim * 100);
          matchType = 'FUZZY_NAME';
          reason = `Nama sangat mirip (${score}% kemiripan): "${onuRawDesc}" ~ "${cust.name}"`;
        }
      }
    }

    if (score > 0) {
      // Proximity Bonus: If customer belongs to this OLT's router, add +3 bonus (up to 100)
      if (cust.routerId && routerSet.has(cust.routerId)) {
        score = Math.min(100, score + 3);
        reason += ' (Router Uplink Sesuai)';
      }

      results.push({
        customer: cust,
        score,
        matchType,
        reason,
      });
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);

  const best = (results.length > 0 && results[0].score >= minScore) ? results[0] : null;
  return {
    bestMatch: best,
    suggestions: results.slice(0, 5), // top 5 suggestions
  };
}
