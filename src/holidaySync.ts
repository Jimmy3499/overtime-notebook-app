import type { HolidayConfig } from './types';

// 数据来源：项目自带节假日数据，经 jsDelivr CDN 分发（国内可达、可控、每年更新）。
// 仓库根目录 holidays.json 由作者每年初更新；接口不可达时回退内置兜底数据（见文末 FALLBACK_HOLIDAYS）。
const HOLIDAYS_JSON_URL =
  'https://cdn.jsdelivr.net/gh/Jimmy3499/overtime-notebook-app@master/holidays.json';

// holidays.json 格式
interface HolidayJsonEntry {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'holiday' | 'makeup';
}
interface HolidayJson {
  updated?: string;
  years: Record<string, HolidayJsonEntry[]>; // key 为年份字符串，如 "2026"
}

// 默认同步年份：今年 + 前两年
export function defaultSyncYears(): number[] {
  const y = new Date().getFullYear();
  return [y, y - 1, y - 2];
}

// 把节假日 JSON 中指定年份映射成 HolidayConfig[]
function mapHolidaysJson(json: HolidayJson, year: number): HolidayConfig[] {
  const list = json?.years?.[String(year)] || [];
  return list.map((e) => ({ date: e.date, name: e.name, type: e.type }));
}

// 拉取节假日 JSON（单次请求，带超时）；返回近三年合并后的数据
export async function fetchAllHolidays(timeoutMs = 10000): Promise<HolidayConfig[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(HOLIDAYS_JSON_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as HolidayJson;
    const out: HolidayConfig[] = [];
    for (const y of defaultSyncYears()) out.push(...mapHolidaysJson(json, y));
    return out;
  } finally {
    clearTimeout(timer);
  }
}

// 拉取多年（去重），仅保留请求年份范围内的日期
export async function fetchHolidaysForYears(
  years: number[],
): Promise<HolidayConfig[]> {
  const all = await fetchAllHolidays();
  const byDate = new Map<string, HolidayConfig>();
  for (const h of all) byDate.set(h.date, h);
  const wanted = new Set(years.map(String));
  return [...byDate.values()].filter((h) => wanted.has(h.date.slice(0, 4)));
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
// 说明：线上源为项目自带 holidays.json（经 jsDelivr 分发）。若联网拉取失败，
// 则以内置的国务院官方安排作为基准数据，保证离线也能正确识别节假日 / 调休补班。
// 每年初随 holidays.json 更新一次即可（覆盖当年及前一年）。

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
