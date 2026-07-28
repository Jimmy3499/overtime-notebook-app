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

// ========== 内置兜底节假日 ==========
// 说明：timor.tech 接口现已被 Cloudflare 拦截，App 内联网同步大概率失败。
// 因此以内置的国务院官方安排作为基准数据，保证离线也能正确识别节假日 / 调休补班。
// 每年初更新一次即可（覆盖当年及前一年）。

// 生成 [start, end] 闭区间内的所有 YYYY-MM-DD
function daterange(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  for (let cur = new Date(s); cur <= e; cur.setDate(cur.getDate() + 1)) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${d}`);
  }
  return out;
}

function buildFallback(): HolidayConfig[] {
  const list: HolidayConfig[] = [];
  const add = (dates: string[], name: string, type: HolidayConfig['type']) => {
    dates.forEach((date) => list.push({ date, name, type }));
  };

  // —— 2025（国务院国办发明电〔2024〕12号）——
  add(daterange('2025-01-01', '2025-01-01'), '元旦', 'holiday');
  add(daterange('2025-01-28', '2025-02-04'), '春节', 'holiday');
  add(daterange('2025-04-04', '2025-04-06'), '清明节', 'holiday');
  add(daterange('2025-05-01', '2025-05-05'), '劳动节', 'holiday');
  add(daterange('2025-05-31', '2025-06-02'), '端午节', 'holiday');
  add(daterange('2025-10-01', '2025-10-08'), '国庆节·中秋节', 'holiday');
  add(['2025-01-26', '2025-02-08', '2025-04-27', '2025-09-28', '2025-10-11'], '调休补班', 'makeup');

  // —— 2026（国务院国办发明电〔2025〕7号）——
  add(daterange('2026-01-01', '2026-01-03'), '元旦', 'holiday');
  add(daterange('2026-02-15', '2026-02-23'), '春节', 'holiday');
  add(daterange('2026-04-04', '2026-04-06'), '清明节', 'holiday');
  add(daterange('2026-05-01', '2026-05-05'), '劳动节', 'holiday');
  add(daterange('2026-06-19', '2026-06-21'), '端午节', 'holiday');
  add(daterange('2026-09-25', '2026-09-27'), '中秋节', 'holiday');
  add(daterange('2026-10-01', '2026-10-07'), '国庆节', 'holiday');
  add(['2026-01-04', '2026-02-14', '2026-02-28', '2026-05-09', '2026-09-20', '2026-10-10'], '调休补班', 'makeup');

  return list;
}

// 内置兜底数据（离线/接口不可达时使用）
export const FALLBACK_HOLIDAYS: HolidayConfig[] = buildFallback();
