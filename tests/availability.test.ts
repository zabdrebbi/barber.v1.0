import { describe, it, expect } from 'vitest';
import { hasConflict, computeSlots } from '../src/services/domain/availability';
import type { DayHours } from '../src/services/domain/availability';

const baseRule: DayHours = {
  is_open: true,
  open_time: '09:00',
  close_time: '20:00',
  breaks: [{ start: '13:00', end: '14:00' }],
};

describe('availability', () => {
  it('hasConflict detects overlap', () => {
    expect(
      hasConflict(
        { start: '2026-10-10T09:00:00Z', end: '2026-10-10T10:00:00Z' },
        [{ start: '2026-10-10T09:30:00Z', end: '2026-10-10T10:30:00Z' }],
      ),
    ).toBe(true);
  });

  it('computeSlots respects breaks and hours', () => {
    const slots = computeSlots({
      date: '2026-10-10',
      durationMinutes: 30,
      gapMinutes: 0,
      dayHours: baseRule,
      maxAdvanceDays: 30,
      nowUtc: new Date('2026-10-07T00:00:00Z'),
      ignorePast: false,
    });
    expect(slots.slots.length).toBe(20);
    expect(slots.slots[0]).toMatch(/09:00/);
    expect(slots.slots.some(s => s.includes('13:00'))).toBe(false);
  });
});
