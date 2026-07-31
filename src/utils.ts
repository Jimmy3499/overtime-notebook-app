import { DEFAULT_SETTINGS, OVERTIME_TYPE_INFO } from './constants';
import type { OvertimeType, RecordType, Settings, RecordInput, CalcFields, OvertimeRecord } from './types';

// ========== 时间工具 ==========

// HH:mm → 当天分钟数
export function timeToMinutes(time: string): number {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// 分钟数 → HH:mm
export function minutesToTime(mins: number): string {
  const clamped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// 格式化时长显示
export function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}小时`;
  return `${h}小时${m}分`;
}

// 格式化金额
export function formatMoney(money: number): string {
  return `¥${money.toFixed(2)}`;
}

// 今天日期 YYYY-MM-DD
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 当前时间 HH:mm（向下取整到5分钟）
export function nowTimeStr(roundTo5 = false): string {
  const d = new Date();
  let m = d.getMinutes();
  if (roundTo5) m = Math.floor(m / 5) * 5;
  return `${String(d.getHours()).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// 时间按0.5小时取整
export function roundToHalfHour(hours: number, roundDown = true): number {
  const halfHours = roundDown ? Math.floor(hours * 2) : Math.ceil(hours * 2);
  return halfHours / 2;
}

// 日期→星期几（0=周日，1=周一..6=周六）
export function dayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay();
}

// 格式化日期显示
export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayOfWeek(dateStr)];
  return `${m}月${d}日 ${week}`;
}

// 格式化月份
export function formatMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-');
  return `${y}年${m}月`;
}

// 当前月 YYYY-MM
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 当前年
export function currentYear(): string {
  return String(new Date().getFullYear());
}

// 月份的第一天/最后一天
export function monthRange(year: number, month: number): { first: string; last: string; days: number } {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    first: `${year}-${pad(month)}-01`,
    last: `${year}-${pad(month)}-${last.getDate()}`,
    days: last.getDate(),
  };
}

// 日期字符串列表
export function dateListOfMonth(year: number, month: number): string[] {
  const { days } = monthRange(year, month);
  const pad = (n: number) => String(n).padStart(2, '0');
  return Array.from({ length: days }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`);
}

// 判断某天是不是周末
export function isWeekend(dateStr: string): boolean {
  const d = dayOfWeek(dateStr);
  return d === 0 || d === 6;
}

// ========== 时长/工资计算 ==========

// 计算加班原始时长（小时）
export function calcRawDurationHours(
  startTime: string,
  endTime: string,
  crossDay: boolean,
): number {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (crossDay) end += 24 * 60;
  if (end <= start) return 0;
  return (end - start) / 60;
}

// 计算有效加班时长（扣休息 + 取整）
export function calcEffectiveDuration(
  rawHours: number,
  settings: Settings,
  type: OvertimeType,
): number {
  let restMins = 0;
  if (type === 'weekday') {
    restMins = settings.weekdayRestMinutes;
  } else {
    restMins = settings.weekendRestMinutes;
  }
  let effective = Math.max(0, rawHours - restMins / 60);
  if (settings.roundToHalfHour) {
    effective = roundToHalfHour(effective, settings.roundDown);
  }
  return effective;
}

// 计算加班工资
export function calcPay(
  effectiveHours: number,
  type: OvertimeType,
  settings: Settings,
): number {
  const rate = type === 'weekday'
    ? settings.hourlyWageWeekday
    : type === 'weekend'
      ? settings.hourlyWageWeekend
      : settings.hourlyWageHoliday;
  return +(effectiveHours * rate).toFixed(2);
}

// 计算总收入
export function calcTotalIncome(pay: number, subsidy: number): number {
  return +(pay + subsidy).toFixed(2);
}

// ========== 迟到扣款计算 ==========

// 计算迟到时长（小时）
export function calcLateDurationHours(
  workStartTime: string,
  actualArriveTime: string,
): number {
  const start = timeToMinutes(workStartTime);
  const actual = timeToMinutes(actualArriveTime);
  if (actual <= start) return 0;
  return (actual - start) / 60;
}

// 计算迟到扣款
export function calcLateDeduction(
  lateHours: number,
  settings: Settings,
): number {
  if (!settings.lateDeductionEnabled || lateHours <= 0) return 0;
  let effectiveHours = lateHours;
  if (settings.lateRoundToHalfHour) {
    effectiveHours = roundToHalfHour(effectiveHours, settings.lateRoundDown);
  }
  return +(effectiveHours * settings.lateDeductionPerHour).toFixed(2);
}

// ========== 反推时间 ==========

// 根据起始时间 + 时长（小时）推算结束时间
// 例如：起始 "09:00"，时长 2.5 小时 → "11:30"
export function calcEndTimeFromDuration(startTime: string, durationHours: number): string {
  const start = timeToMinutes(startTime);
  const durationMins = Math.round(durationHours * 60);
  const endTotal = start + durationMins;
  const clamped = endTotal >= 24 * 60 ? endTotal - 24 * 60 : endTotal;
  return minutesToTime(clamped);
}

// ========== 月薪算时薪 ==========

// 根据月薪算时薪
export function calcHourlyWageFromSalary(
  monthlySalary: number,
  workDaysPerMonth: number,
  workHoursPerDay: number,
): number {
  if (workDaysPerMonth <= 0 || workHoursPerDay <= 0) return 0;
  return +(monthlySalary / workDaysPerMonth / workHoursPerDay).toFixed(2);
}

// 生成唯一 ID
export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 生成默认设置
export function defaultSettings(): Settings {
  return { ...DEFAULT_SETTINGS };
}

// 自动判断加班类型（基于是否工作日+节假日配置）
export function detectOvertimeType(
  dateStr: string,
  holidays: { date: string; type: string }[] = [],
): OvertimeType {
  const holiday = holidays.find(h => h.date === dateStr);
  if (holiday?.type === 'holiday') return 'holiday';
  if (holiday?.type === 'makeup') return 'weekday';
  return isWeekend(dateStr) ? 'weekend' : 'weekday';
}

// ========== 统一计算入口 ==========
// 根据输入的记录字段与设置，计算时长/工资/扣款等结果。
// 这是「添加/编辑落库」与「添加页实时预览」唯一的实现来源，
// 二者调用同一个函数，确保「预览 == 落库」，避免规则改动后两处漂移。

export function calcRecordFields(input: RecordInput, settings: Settings): CalcFields {
  const isLeave = input.recordType === 'leave';
  const isLate = input.recordType === 'late';

  if (isLate) {
    const rawLateHours = calcLateDurationHours(input.normalOffTime, input.actualOffTime);
    const deduction = calcLateDeduction(rawLateHours, settings);
    return {
      rawHours: rawLateHours,
      effectiveHours: rawLateHours,
      durationHours: +rawLateHours.toFixed(2),
      pay: 0,
      totalIncome: 0,
      deduction: +deduction.toFixed(2),
      netIncome: deduction === 0 ? 0 : -deduction,
    };
  }

  // 加班 / 请假：优先使用手动时长，否则按起止时间计算
  if (input.manualDuration > 0) {
    const raw = input.manualDuration;
    const effective = isLeave
      ? raw
      : calcEffectiveDuration(raw, settings, input.type);
    const pay = isLeave ? 0 : calcPay(effective, input.type, settings);
    const totalIncome = calcTotalIncome(pay, input.subsidy);
    return {
      rawHours: raw,
      effectiveHours: effective,
      durationHours: effective,
      pay,
      totalIncome,
      deduction: 0,
      netIncome: totalIncome,
    };
  }

  const rawHours = calcRawDurationHours(input.normalOffTime, input.actualOffTime, input.crossDay);
  const effective = isLeave
    ? rawHours
    : calcEffectiveDuration(rawHours, settings, input.type);
  const pay = isLeave ? 0 : calcPay(effective, input.type, settings);
  const totalIncome = calcTotalIncome(pay, input.subsidy);
  return {
    rawHours,
    effectiveHours: effective,
    durationHours: effective,
    pay,
    totalIncome,
    deduction: 0,
    netIncome: totalIncome,
  };
}

/**
 * 日历多选汇总：对所选日期的全部记录（加班/请假/迟到）聚合。
 * - hours：所选日期每天 Σ durationHours（加班=有效时长、请假=实际时长、迟到=迟到时长）
 * - pay：所选日期每天 Σ netIncome（加班/请假净收入、迟到为负扣款）
 * 汇总结果按日期升序排列，保证顺序稳定。
 */
export interface SelectedDaySummary {
  date: string;        // YYYY-MM-DD
  count: number;       // 当天记录条数
  hours: number;       // 当天时长合计（小时）
  pay: number;         // 当天净收入合计（元）
}

export interface SelectionSummary {
  perDay: SelectedDaySummary[];
  totalHours: number;
  totalPay: number;
}

export function calcSelectionSummary(
  selectedDates: string[],
  records: OvertimeRecord[],
): SelectionSummary {
  const perDay: SelectedDaySummary[] = selectedDates
    .slice()
    .sort()
    .map((d) => {
      const recs = records.filter((r) => r.date === d);
      const hours = recs.reduce((s, r) => s + (r.durationHours || 0), 0);
      const pay = recs.reduce((s, r) => s + (r.netIncome || 0), 0);
      return { date: d, count: recs.length, hours, pay };
    });
  const totalHours = perDay.reduce((s, d) => s + d.hours, 0);
  const totalPay = perDay.reduce((s, d) => s + d.pay, 0);
  return { perDay, totalHours, totalPay };
}
