import { fetchAppointments } from './appointments';
import type { Appointment } from '@/types/models';
import { isoDate, isoTime, isoWeekday, addDays, todayAlgiers } from '@/lib/time';

export interface ReportSummary {
  revenue: number;
  appointments: number;
  completed: number;
  cancelled: number;
  noShow: number;
  newCustomers: number;
  avgTicket: number;
}

export interface ReportData {
  summary: ReportSummary;
  byDay: { date: string; revenue: number; count: number }[];
  topServices: { name: string; count: number; revenue: number }[];
  peakHours: { hour: string; count: number }[];
  rows: Appointment[];
}

export type ReportRange = '7' | '30' | '90' | 'custom';

export function rangeToDates(range: ReportRange, custom?: { from: string; to: string }) {
  const today = todayAlgiers();
  if (range === 'custom' && custom?.from && custom?.to) return { from: custom.from, to: custom.to };
  const days = Number(range);
  return { from: addDays(today, -(days - 1)), to: today };
}

export async function buildReport(
  from: string,
  to: string,
): Promise<{ data?: ReportData; error?: string }> {
  const res = await fetchAppointments({ from, to });
  if (res.error || !res.data) return { error: res.error ?? 'UNKNOWN' };
  const rows = res.data;

  const counted = rows.filter((a) => !a.deleted_at);
  const completed = counted.filter((a) => a.status === 'completed');
  const cancelled = counted.filter((a) => a.status === 'cancelled');
  const noShow = counted.filter((a) => a.status === 'no_show');
  const revenue = completed.reduce((sum, a) => sum + (a.service?.price ?? 0), 0);

  const seenPhones = new Set<string>();
  let newCustomers = 0;
  for (const a of counted) {
    if (!seenPhones.has(a.phone)) {
      seenPhones.add(a.phone);
      if (completed.some((c) => c.phone === a.phone)) newCustomers += 1;
    }
  }

  const byDayMap = new Map<string, { date: string; revenue: number; count: number }>();
  let cursor = from;
  while (cursor <= to) {
    byDayMap.set(cursor, { date: cursor, revenue: 0, count: 0 });
    cursor = addDays(cursor, 1);
  }
  for (const a of counted) {
    const d = isoDate(a.scheduled_at);
    const entry = byDayMap.get(d);
    if (entry) {
      entry.count += 1;
      if (a.status === 'completed') entry.revenue += a.service?.price ?? 0;
    }
  }

  const svcMap = new Map<string, { name: string; count: number; revenue: number }>();
  for (const a of counted) {
    const name = a.service?.name ?? 'خدمة';
    const cur = svcMap.get(name) ?? { name, count: 0, revenue: 0 };
    cur.count += 1;
    if (a.status === 'completed') cur.revenue += a.service?.price ?? 0;
    svcMap.set(name, cur);
  }

  const hourMap = new Map<string, number>();
  for (const a of counted) {
    const h = `${isoTime(a.scheduled_at).slice(0, 2)}:00`;
    hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
  }

  return {
    data: {
      summary: {
        revenue,
        appointments: counted.length,
        completed: completed.length,
        cancelled: cancelled.length,
        noShow: noShow.length,
        newCustomers,
        avgTicket: completed.length ? Math.round(revenue / completed.length) : 0,
      },
      byDay: Array.from(byDayMap.values()),
      topServices: Array.from(svcMap.values()).sort((a, b) => b.count - a.count).slice(0, 6),
      peakHours: Array.from(hourMap.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour.localeCompare(b.hour)),
      rows: counted.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    },
  };
}

export function toCsv(rows: Appointment[]): string {
  const header = ['id', 'date', 'time', 'name', 'lastname', 'phone', 'service', 'price', 'status', 'note'];
  const lines = [header.join(',')];
  for (const a of rows) {
    const cells = [
      a.id,
      isoDate(a.scheduled_at),
      isoTime(a.scheduled_at),
      a.customer_name,
      a.customer_lastname,
      a.phone,
      a.service?.name ?? '',
      String(a.service?.price ?? 0),
      a.status,
      (a.note ?? '').replace(/[\r\n,]+/g, ' '),
    ];
    lines.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
  }
  return '﻿' + lines.join('\n');
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** مخطط 30 يوماً للوحة الرئيسية */
export async function fetchBookingsChart(days = 30): Promise<{ data?: { date: string; count: number }[]; error?: string }> {
  const to = todayAlgiers();
  const from = addDays(to, -(days - 1));
  const res = await fetchAppointments({ from, to });
  if (res.error) return { error: res.error };
  const map = new Map<string, number>();
  let cursor = from;
  while (cursor <= to) {
    map.set(cursor, 0);
    cursor = addDays(cursor, 1);
  }
  for (const a of res.data ?? []) {
    if (a.deleted_at) continue;
    const d = isoDate(a.scheduled_at);
    if (map.has(d)) map.set(d, (map.get(d) ?? 0) + 1);
  }
  return { data: Array.from(map.entries()).map(([date, count]) => ({ date, count })) };
}

export { isoWeekday };
