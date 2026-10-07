import type { AppointmentStatus } from '@/types/models';

export const TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  pending: ['accepted_awaiting_schedule', 'scheduled', 'rejected', 'cancelled'],
  accepted_awaiting_schedule: ['scheduled', 'rejected', 'cancelled'],
  scheduled: ['completed', 'no_show', 'cancelled'],
  rejected: [],
  cancelled: [],
  completed: [],
  no_show: [],
};

export const TERMINAL_STATUSES: readonly AppointmentStatus[] = ['rejected', 'cancelled', 'completed', 'no_show'];
export const ACTIVE_STATUSES: readonly AppointmentStatus[] = ['pending', 'accepted_awaiting_schedule', 'scheduled'];

export function isTerminal(status: AppointmentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
export function isActive(status: AppointmentStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}
export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function nextState(from: AppointmentStatus, action: 'accept' | 'reject' | 'schedule' | 'reschedule' | 'complete' | 'no_show' | 'cancel'): AppointmentStatus | null {
  const map: Record<string, AppointmentStatus> = {
    accept: 'accepted_awaiting_schedule',
    reject: 'rejected',
    schedule: 'scheduled',
    reschedule: 'scheduled',
    complete: 'completed',
    no_show: 'no_show',
    cancel: 'cancelled',
  };
  const target = map[action];
  if (!target) return null;
  return canTransition(from, target) ? target : null;
}
export function allowedTransitions(from: AppointmentStatus): readonly AppointmentStatus[] {
  return TRANSITIONS[from] ?? [];
}
export function needsDateFor(action: 'accept' | 'reject' | 'schedule' | 'reschedule' | 'complete' | 'no_show' | 'cancel'): boolean {
  return action === 'accept' || action === 'reschedule';
}
export function getTransitionMeta(_action: string): { requiresDate?: boolean; requiresReason?: boolean; notify?: boolean } {
  return {};
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: AppointmentStatus,
    public readonly to: AppointmentStatus,
  ) {
    super(`INVALID_TRANSITION:${from}->${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function assertTransition(from: AppointmentStatus, to: AppointmentStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

export type Actor = 'admin' | 'customer' | 'guest' | 'system';
export const ACTOR_PERMISSIONS: Record<Actor, readonly AppointmentStatus[]> = {
  admin: ['accepted_awaiting_schedule', 'scheduled', 'rejected', 'cancelled', 'completed', 'no_show'],
  customer: ['cancelled'],
  guest: ['cancelled'],
  system: ['pending', 'completed', 'cancelled'],
};

export function canActorTransition(actor: Actor, from: AppointmentStatus, to: AppointmentStatus): boolean {
  if (!canTransition(from, to)) return false;
  return ACTOR_PERMISSIONS[actor]?.includes(to) ?? false;
}
export function assertActorTransition(actor: Actor, from: AppointmentStatus, to: AppointmentStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
  if (!canActorTransition(actor, from, to)) {
    throw new Error(`FORBIDDEN_TRANSITION:${actor}:${from}->${to}`);
  }
}
