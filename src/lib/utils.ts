import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SALON_CONFIG } from '@/config/salon';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return `${new Intl.NumberFormat('ar-DZ').format(amount)} ${SALON_CONFIG.currency.symbol}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ar-DZ').format(n);
}

/** أرقام عربية-هندية للعرض (٠١٢…) — اختياري */
export function toArabicDigits(s: string | number): string {
  return String(s).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
