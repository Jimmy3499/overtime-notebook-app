import type { OvertimeType, RecordType, Settings } from './types';

// 主题色（暖色调 - 深棕+奶油+暖黄）
export const THEME = {
  bg: '#f5e6c8',        // 暖米色背景
  card: '#fff8e7',      // 奶油色卡片
  primary: '#b45309',   // 深棕色（主色）
  accent: '#fef3c7',    // 暖黄色（强调色）
  success: '#15803d',   // 绿色（账本绿色元素）
  brown: '#92400e',     // 深棕褐色
  text: '#1f2937',      // 主文字
  textSub: '#6b7280',   // 次要文字
  textMute: '#9ca3af',  // 弱化文字
  border: '#d6c8a8',    // 边框（暖色调）
  divider: '#e8dcc0',   // 分割线（暖色调）
  danger: '#ef4444',    // 错误红
  warning: '#f59e0b',   // 警告橙
  info: '#3b82f6',      // 信息蓝
};

// 加班类型展示信息
export const OVERTIME_TYPE_INFO: Record<
  OvertimeType,
  { label: string; shortLabel: string; color: string }
> = {
  weekday: { label: '工作日加班', shortLabel: '工作日', color: '#b45309' },  // 深棕
  weekend: { label: '周末加班', shortLabel: '周末', color: '#15803d' },       // 绿色
  holiday: { label: '节假日加班', shortLabel: '节假日', color: '#92400e' },   // 深褐色
};

export const OVERTIME_TYPES: OvertimeType[] = ['weekday', 'weekend', 'holiday'];

// 记录类型展示信息
export const RECORD_TYPE_INFO: Record<
  RecordType,
  { label: string; shortLabel: string; color: string; icon: string }
> = {
  overtime: { label: '加班', shortLabel: '加班', color: '#b45309', icon: '⏰' },
  leave: { label: '请假', shortLabel: '请假', color: '#6b7280', icon: '📅' },
  late: { label: '迟到', shortLabel: '迟到', color: '#ef4444', icon: '⏱️' },
};

export const RECORD_TYPES: RecordType[] = ['overtime', 'leave', 'late'];

// 默认设置
export const DEFAULT_SETTINGS: Settings = {
  hourlyWageWeekday: 25,
  hourlyWageWeekend: 30,
  hourlyWageHoliday: 50,
  weekdayStartTime: '18:00',
  weekendStartTime: '10:00',
  weekdayWorkStartTime: '09:00',
  weekendWorkStartTime: '09:00',
  weekdayRestMinutes: 0,
  weekendRestMinutes: 0,
  monthlySalary: 8000,
  workDaysPerMonth: 22,
  workHoursPerDay: 8,
  useMonthlySalary: false,
  salaryMultiplierWeekday: 1.5,
  salaryMultiplierWeekend: 2,
  salaryMultiplierHoliday: 3,
  roundToHalfHour: true,
  roundDown: true,
  defaultType: 'weekday',
  compOffEnabled: false,
  compOffRate: 1.0,
  lateDeductionEnabled: false,
  lateDeductionPerHour: 50,
  lateRoundToHalfHour: true,
  lateRoundDown: false,
};

// 本地存储 Key
export const STORAGE_KEYS = {
  RECORDS: 'overtime_records',
  SETTINGS: 'overtime_settings',
  COMP_OFF: 'overtime_compoff',
  HOLIDAYS: 'overtime_holidays',
  CHECK_INS: 'overtime_checkins',
  MARKED_DATES: 'overtime_marked_dates',
  HOLIDAY_SYNC: 'overtime_holiday_sync',
};
