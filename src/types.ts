// 加班类型
export type OvertimeType = 'weekday' | 'weekend' | 'holiday';

// 记录类型：加班 / 请假 / 迟到
export type RecordType = 'overtime' | 'leave' | 'late';

// 加班记录（核心数据结构）
export interface OvertimeRecord {
  id: string;
  date: string;              // YYYY-MM-DD 日期
  normalOffTime: string;     // HH:mm 正常下班时间 / 加班开始时间 / 请假开始时间 / 迟到应到时间
  actualOffTime: string;     // HH:mm 实际下班时间 / 加班结束时间 / 请假结束时间 / 迟到实到时间
  crossDay: boolean;         // 实际下班是否跨到次日（加班用）
  type: OvertimeType;        // 类型：工作日/周末/节假日
  reason: string;            // 事由（可选）
  recordType: RecordType;    // 记录类型：加班/请假/迟到
  manualDuration: number;    // 手动设置时长（小时），0 表示未设置，用起止时间计算
  durationHours: number;     // 有效时长（小时）—— 加班=扣休息后；请假=实际；迟到=实际
  pay: number;               // 加班工资（元）—— 加班>0；请假/迟到=0
  subsidy: number;           // 补贴/补助（元）
  totalIncome: number;       // 收入合计（加班工资 + 补贴）
  deduction: number;         // 扣款（元）—— 迟到扣钱；加班/请假=0
  netIncome: number;         // 净收入 = totalIncome - deduction
  useCompOff: boolean;       // 是否用调休抵扣
  location: string;          // 加班地点（可选）
  createdAt: number;         // 创建时间戳
  updatedAt: number;         // 更新时间戳
}

// 调休库存记录
export interface CompOffInventory {
  totalHours: number;        // 累计调休时长（小时）
  usedHours: number;         // 已使用调休时长
  records: CompOffRecord[];  // 调休流水
}

export interface CompOffRecord {
  id: string;
  date: string;              // 产生/使用日期
  hours: number;             // 正数=增加，负数=使用
  sourceRecordId?: string;   // 关联的加班记录ID
  note: string;              // 备注
  createdAt: number;
}

// 节假日配置
export interface HolidayConfig {
  date: string;              // YYYY-MM-DD
  name: string;
  type: 'holiday' | 'makeup'; // 法定假日 / 调休补班
}

// 应用设置
export interface Settings {
  hourlyWageWeekday: number;    // 工作日时薪（元/小时）
  hourlyWageWeekend: number;    // 周末时薪
  hourlyWageHoliday: number;    // 节假日时薪
  weekdayStartTime: string;     // 工作日默认加班开始时间
  weekendStartTime: string;     // 非工作日默认加班开始时间
  weekdayWorkStartTime: string; // 工作日默认上班时间（用于请假/迟到计算）
  weekendWorkStartTime: string; // 非工作日默认上班时间（用于请假/迟到计算）
  weekdayRestMinutes: number;   // 工作日加班休息扣减（分钟）
  weekendRestMinutes: number;   // 非工作日加班休息扣减（分钟）
  monthlySalary: number;        // 月薪（用于自动算时薪）
  workDaysPerMonth: number;     // 每月计薪天数
  workHoursPerDay: number;      // 每日工作时长（小时）
  useMonthlySalary: boolean;    // 是否使用月薪算时薪
  salaryMultiplierWeekday: number;  // 月薪算时薪：工作日倍率
  salaryMultiplierWeekend: number;  // 月薪算时薪：周末倍率
  salaryMultiplierHoliday: number;  // 月薪算时薪：节假日倍率
  roundToHalfHour: boolean;     // 是否按0.5小时取整
  roundDown: boolean;           // 取整方式：true向下取整，false向上取整
  defaultType: OvertimeType;    // 默认加班类型
  compOffEnabled: boolean;      // 是否启用调休
  compOffRate: number;          // 调休倍率（1.0 = 1小时加班换1小时调休）
  lateDeductionEnabled: boolean;  // 是否启用迟到扣款
  lateDeductionPerHour: number;  // 迟到每小时扣多少钱（元/小时）
  lateRoundToHalfHour: boolean;  // 迟到时长是否按0.5小时取整
  lateRoundDown: boolean;        // 迟到取整方式
}

// 打卡记录（用于自动识别）
export interface CheckInRecord {
  id: string;
  date: string;
  time: string;
  type: 'check_in' | 'check_out';
  location?: string;
}
