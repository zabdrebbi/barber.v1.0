import { describe, it, expect } from 'vitest';
import { parseAlgerianPhone } from '../src/lib/phone';

describe('phone', () => {
  it('accepts 05/06/07 +213 00213', () => {
    expect(parseAlgerianPhone('0777444555')?.e164).toBe('+213777444555');
    expect(parseAlgerianPhone('+213 555 00 00 00')?.e164).toBe('+213555000000');
    expect(parseAlgerianPhone('00213 777 444 555')?.e164).toBe('+213777444555');
    expect(parseAlgerianPhone('0655443322')?.e164).toBe('+213655443322');
  });

  it('rejects invalid', () => {
    expect(parseAlgerianPhone('123')).toMatchObject({ valid: false });
    expect(parseAlgerianPhone('0912345678')).toMatchObject({ valid: false });
  });
});
