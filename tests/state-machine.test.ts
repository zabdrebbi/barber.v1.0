import { describe, it, expect } from 'vitest';
import {
  nextState,
  canTransition,
  allowedTransitions,
  needsDateFor,
} from '../src/services/domain/state-machine';

describe('state-machine', () => {
  it('transitions from pending', () => {
    expect(nextState('pending', 'accept')).toBe('accepted_awaiting_schedule');
    expect(nextState('pending', 'reject')).toBe('rejected');
    expect(nextState('pending', 'cancel')).toBe('cancelled');
  });

  it('accept requires schedule later? needsDateFor', () => {
    expect(needsDateFor('accept')).toBe(true);
    expect(needsDateFor('reschedule')).toBe(true);
    expect(needsDateFor('schedule')).toBe(false);
  });

  it('forbidden moves', () => {
    expect(canTransition('completed', 'cancelled')).toBe(false);
    expect(canTransition('cancelled', 'completed')).toBe(false);
    expect(allowedTransitions('scheduled')).toContain('completed');
    expect(allowedTransitions('scheduled')).not.toContain('accept');
  });
});
