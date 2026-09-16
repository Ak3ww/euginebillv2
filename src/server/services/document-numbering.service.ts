import 'server-only';
import { prisma } from '@/server/db/client';

export interface NumberingParams {
  category: string; // MOU, FAK, KWT, SJ, BAST, SPK, etc.
  dept?: string; // RW01, RW16, HO, LOG, BILL, etc.
  referenceId?: string; // ID dokumen sumber
  date?: Date; // Tanggal acuan (default now)
}

const ROMAN_MONTHS = [
  'I', 'II', 'III', 'IV', 'V', 'VI',
  'VII', 'VIII', 'IX', 'X', 'XI', 'XII'
];

export const DEFAULT_NUMBERING_RULES: Record<string, { pattern: string; resetFrequency: 'none' | 'monthly' | 'yearly' }> = {
  MOU: { pattern: 'MOU/{DEPT}/{ROMAN_MM}/{YYYY}/{SEQ:3}', resetFrequency: 'yearly' },
  FAK: { pattern: 'FAK/{DEPT}/{YYYY}{MM}/{SEQ:4}', resetFrequency: 'monthly' },
  KWT: { pattern: 'KWT/{YYYY}{MM}/{SEQ:4}', resetFrequency: 'monthly' },
  SJ: { pattern: 'SJ/LOG/{ROMAN_MM}/{YYYY}/{SEQ:4}', resetFrequency: 'yearly' },
  BAST: { pattern: 'BAST/{DEPT}/{YYYY}/{SEQ:3}', resetFrequency: 'yearly' },
  SPK: { pattern: 'SPK/{YYYY}/{SEQ:4}', resetFrequency: 'none' },
};

/**
 * Format string token replacement
 */
export function formatPatternTokens(
  pattern: string,
  tokens: {
    prefix: string;
    dept: string;
    year: number;
    month: number;
    seq: number;
  }
): string {
  const { prefix, dept, year, month, seq } = tokens;
  const yyyy = String(year);
  const yy = yyyy.slice(-2);
  const mm = String(month).padStart(2, '0');
  const romanMm = ROMAN_MONTHS[month - 1] || 'I';

  let result = pattern
    .replace(/\{PREFIX\}/g, prefix)
    .replace(/\{DEPT\}/g, dept || 'HO')
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{ROMAN_MM\}/g, romanMm)
    .replace(/\{MM\}/g, mm);

  // Handle {SEQ:n} e.g. {SEQ:3} => 001, {SEQ:4} => 0001
  result = result.replace(/\{SEQ:(\d+)\}/g, (_, digits) => {
    const d = parseInt(digits, 10) || 3;
    return String(seq).padStart(d, '0');
  });

  // Fallback for plain {SEQ}
  result = result.replace(/\{SEQ\}/g, String(seq).padStart(3, '0'));

  return result;
}

/**
 * Calculate the current reset period key for a given frequency and date
 */
export function getResetPeriodKey(frequency: string, date: Date): string | null {
  const yyyy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');

  if (frequency === 'monthly') return `${yyyy}${mm}`;
  if (frequency === 'yearly') return yyyy;
  return null;
}

/**
 * Ensure rule exists for category, creating default if not found
 */
export async function getOrCreateRule(category: string) {
  const upperCat = category.toUpperCase().trim();
  let rule = await prisma.numberingRule.findUnique({
    where: { category: upperCat }
  });

  if (!rule) {
    const def = DEFAULT_NUMBERING_RULES[upperCat] || {
      pattern: `${upperCat}/{DEPT}/{YYYY}/{SEQ:4}`,
      resetFrequency: 'yearly' as const
    };

    rule = await prisma.numberingRule.create({
      data: {
        category: upperCat,
        pattern: def.pattern,
        resetFrequency: def.resetFrequency,
        currentSeq: 0,
        lastResetPeriod: null,
      }
    });
  }

  return rule;
}

/**
 * Preview next number without incrementing sequence or saving to issuedNumber
 */
export async function previewNextNumber(params: NumberingParams): Promise<{
  previewNumber: string;
  category: string;
  pattern: string;
  nextSeq: number;
  periodKey: string | null;
}> {
  const date = params.date || new Date();
  const upperCat = params.category.toUpperCase().trim();
  const rule = await getOrCreateRule(upperCat);

  const currentPeriod = getResetPeriodKey(rule.resetFrequency, date);
  const shouldReset =
    rule.resetFrequency !== 'none' &&
    rule.lastResetPeriod !== null &&
    currentPeriod !== null &&
    rule.lastResetPeriod !== currentPeriod;

  const nextSeq = shouldReset ? 1 : rule.currentSeq + 1;

  const formatted = formatPatternTokens(rule.pattern, {
    prefix: upperCat,
    dept: params.dept?.trim() || 'HO',
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    seq: nextSeq,
  });

  return {
    previewNumber: formatted,
    category: upperCat,
    pattern: rule.pattern,
    nextSeq,
    periodKey: currentPeriod,
  };
}

/**
 * Issue and consume next number transactionally, logging to issuedNumber table
 */
export async function issueNextNumber(params: NumberingParams): Promise<{
  issuedNumber: string;
  category: string;
  seq: number;
  id: string;
}> {
  const date = params.date || new Date();
  const upperCat = params.category.toUpperCase().trim();
  const dept = params.dept?.trim() || 'HO';

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch or create rule
    let rule = await tx.numberingRule.findUnique({
      where: { category: upperCat }
    });

    if (!rule) {
      const def = DEFAULT_NUMBERING_RULES[upperCat] || {
        pattern: `${upperCat}/{DEPT}/{YYYY}/{SEQ:4}`,
        resetFrequency: 'yearly' as const
      };
      rule = await tx.numberingRule.create({
        data: {
          category: upperCat,
          pattern: def.pattern,
          resetFrequency: def.resetFrequency,
          currentSeq: 0,
          lastResetPeriod: null,
        }
      });
    }

    // 2. Check reset period
    const currentPeriod = getResetPeriodKey(rule.resetFrequency, date);
    let nextSeq = rule.currentSeq + 1;

    if (
      rule.resetFrequency !== 'none' &&
      currentPeriod !== null &&
      rule.lastResetPeriod !== currentPeriod
    ) {
      nextSeq = 1;
    }

    // 3. Format final number
    const generatedNumber = formatPatternTokens(rule.pattern, {
      prefix: upperCat,
      dept,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      seq: nextSeq,
    });

    // 4. Update numberingRule sequence
    await tx.numberingRule.update({
      where: { id: rule.id },
      data: {
        currentSeq: nextSeq,
        lastResetPeriod: currentPeriod,
      }
    });

    // 5. Insert record into issuedNumber
    const issued = await tx.issuedNumber.create({
      data: {
        category: upperCat,
        generatedNumber,
        dept,
        referenceId: params.referenceId || null,
        issuedAt: date,
      }
    });

    return {
      issuedNumber: generatedNumber,
      category: upperCat,
      seq: nextSeq,
      id: issued.id,
    };
  });
}
