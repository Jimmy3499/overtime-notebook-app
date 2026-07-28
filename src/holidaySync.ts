import type { HolidayConfig } from './types';

// 数据来源：timor.tech 免费节假日接口（无需密钥），返回当年法定节假日与调休补班
const API_BASE = 'https://timor.tech/api/holiday/year';

// 接口单日结构（仅取需要的字段）
interface TimorDay {
  holiday: boolean;   // true=休息日, false=补班(要上班)
  name: string;
  wage: number;       // 3=法定节假日, 1=调休补班, 2=调休休息日
  date?: string;      // 完整日期 YYYY-MM-DD（部分条目带）
}

interface TimorYearResponse {
  code: number;
  holiday: Record<string, TimorDay> | null; // key 为 MM-DD
}

// 默认同步年份：今年 + 前两年
export function defaultSyncYears(): number[] {
  const y = new Date().getFullYear();
  return [y, y - 1, y - 2];
}

// 把单个年份的官方数据映射成 HolidayConfig[]
// 规则：wage:3 -> 法定假日(holiday)；wage:1 -> 调休补班(makeup)；其余(含 wage:2 调休休息日)跳过
export function mapTimorYear(json: TimorYearResponse, year: number): HolidayConfig[] {
  const out: HolidayConfig[] = [];
  const days = json?.holiday;
  if (!days) return out;
  for (const key of Object.keys(days)) {
    const d = days[key];
    if (!d) continue;
    let type: HolidayConfig['type'] | null = null;
    if (d.wage === 3) type = 'holiday';
    else if (d.wage === 1) type = 'makeup';
    else continue;
    const date =
      d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : `${year}-${key}`;
    out.push({ date, name: d.name, type });
  }
  return out;
}

// 拉取某一年（带超时与中断）
export async function fetchYearHolidays(
  year: number,
  timeoutMs = 10000,
): Promise<HolidayConfig[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/${year}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as TimorYearResponse;
    if (json.code !== 0) throw new Error(`接口返回 code=${json.code}`);
    return mapTimorYear(json, year);
  } finally {
    clearTimeout(timer);
  }
}

// 并发拉取多年，按日期去重（同年同日取其一）
export async function fetchHolidaysForYears(
  years: number[],
): Promise<HolidayConfig[]> {
  const results = await Promise.allSettled(
    years.map((y) => fetchYearHolidays(y)),
  );
  const byDate = new Map<string, HolidayConfig>();
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const h of r.value) byDate.set(h.date, h);
  }
  return [...byDate.values()];
}

export interface MergeResult {
  merged: HolidayConfig[];
  added: number;   // 官方新增的日期数
  updated: number; // 官方覆盖的已有日期数（内容有变化）
  kept: number;    // 官方未覆盖、保留的原有条目数
}

// 合并官方数据与已有数据：官方覆盖同日，保留官方未覆盖的手动条目
export function mergeHolidays(
  official: HolidayConfig[],
  existing: HolidayConfig[],
): MergeResult {
  const map = new Map<string, HolidayConfig>();
  for (const h of existing) map.set(h.date, h); // 先放已有
  let added = 0;
  let updated = 0;
  for (const h of official) {
    const prev = map.get(h.date);
    if (prev) {
      if (prev.name !== h.name || prev.type !== h.type) updated++;
    } else {
      added++;
    }
    map.set(h.date, h); // 官方覆盖
  }
  const merged = [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  return { merged, added, updated, kept: merged.length - added - updated };
}
