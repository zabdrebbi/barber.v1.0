/** التحقق من أرقام الهواتف الجزائرية وتطبيعها لصيغة دولية (لواتساب وغيره) */

export interface PhoneParse {
  valid: boolean;
  /** الصيغة الدولية بدون + : 213555000000 */
  e164Digits: string;
  /** الصيغة الدولية مع + */
  e164: string;
  /** الرقم المحلي الجزائري 0555000000 */
  local: string;
}

const CLEAN_RE = /[\s\-().]/g;

/** يقبل: 0555000000 | +213555000000 | 00213555000000 | 213555000000 | صيغ دولية أخرى */
export function parseAlgerianPhone(input: string): PhoneParse {
  const empty: PhoneParse = { valid: false, e164Digits: '', e164: '', local: '' };
  if (!input) return empty;
  const raw = input.replace(CLEAN_RE, '');
  if (!/^\+?\d+$/.test(raw.replace(/^00/, ''))) return empty;

  let digits = raw.replace(/^\+/, '');
  if (digits.startsWith('00')) digits = digits.slice(2);

  let national: string | null = null;
  if (digits.startsWith('213')) {
    national = digits.slice(3);
  } else if (digits.startsWith('0')) {
    national = digits.slice(1);
  } else {
    national = digits;
  }

  // الموبيل الجزائري: 9 أرقام تبدأ بـ 5 أو 6 أو 7
  if (!national || !/^[567]\d{8}$/.test(national)) return empty;

  const e164Digits = `213${national}`;
  return {
    valid: true,
    e164Digits,
    e164: `+${e164Digits}`,
    local: `0${national}`,
  };
}

export function isValidAlgerianPhone(input: string): boolean {
  return parseAlgerianPhone(input).valid;
}

/** أرقام فقط بدون + (لرابط wa.me) */
export function phoneToWaMe(input: string): string {
  const p = parseAlgerianPhone(input);
  if (p.valid) return p.e164Digits;
  return input.replace(/[^\d]/g, '');
}

/** يحذف صفر البداية ويضيف 213 (للعرض/الحفظ) */
export function normalizePhone(input: string): string {
  const p = parseAlgerianPhone(input);
  return p.valid ? p.e164Digits : input.replace(CLEAN_RE, '');
}
