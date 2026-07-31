import { DEFAULT_SETTINGS } from './constants';
import type { Settings } from './types';
import {
  timeToMinutes,
  minutesToTime,
  roundToHalfHour,
  calcRawDurationHours,
  calcEffectiveDuration,
  calcPay,
  calcLateDurationHours,
  calcLateDeduction,
  calcHourlyWageFromSalary,
  detectOvertimeType,
  calcEndTimeFromDuration,
  calcRecordFields,
  calcSelectionSummary,
  formatDotDate,
  formatDecimalHours,
  buildOvertimePrompt,
} from './utils';

// 在默认设置基础上构造可控的测试设置
function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

const base = makeSettings();

describe('时间换算', () => {
  test('timeToMinutes 解析 HH:mm', () => {
    expect(timeToMinutes('18:00')).toBe(1080);
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('00:00')).toBe(0);
  });

  test('timeToMinutes 非法输入返回 0', () => {
    expect(timeToMinutes('')).toBe(0);
    expect(timeToMinutes('abc')).toBe(0);
  });

  test('minutesToTime 与 timeToMinutes 互逆', () => {
    expect(minutesToTime(timeToMinutes('23:45'))).toBe('23:45');
    expect(minutesToTime(timeToMinutes('07:05'))).toBe('07:05');
  });

  test('minutesToTime 对超过 24h 取模', () => {
    expect(minutesToTime(1500)).toBe('01:00'); // 25:00 -> 01:00
  });
});

describe('roundToHalfHour 取整', () => {
  test('向下取整', () => {
    expect(roundToHalfHour(2.0, true)).toBe(2);
    expect(roundToHalfHour(2.3, true)).toBe(2);
    expect(roundToHalfHour(2.6, true)).toBe(2.5);
  });
  test('向上取整', () => {
    expect(roundToHalfHour(2.0, false)).toBe(2);
    expect(roundToHalfHour(2.1, false)).toBe(2.5);
    expect(roundToHalfHour(2.6, false)).toBe(3);
  });
});

describe('calcRawDurationHours 原始时长', () => {
  test('正常起止', () => {
    expect(calcRawDurationHours('18:00', '20:00', false)).toBe(2);
  });
  test('跨天', () => {
    expect(calcRawDurationHours('22:00', '02:00', true)).toBe(4);
  });
  test('结束不晚于开始返回 0', () => {
    expect(calcRawDurationHours('20:00', '18:00', false)).toBe(0);
    expect(calcRawDurationHours('18:00', '18:00', false)).toBe(0);
  });
});

describe('calcEffectiveDuration 有效时长（扣休息 + 取整）', () => {
  test('扣工作日休息', () => {
    const s = makeSettings({ weekdayRestMinutes: 60 });
    expect(calcEffectiveDuration(2, s, 'weekday')).toBe(1);
  });
  test('扣休息后为负则归零', () => {
    const s = makeSettings({ weekdayRestMinutes: 120 });
    expect(calcEffectiveDuration(1, s, 'weekday')).toBe(0);
  });
  test('周末使用周末休息配置', () => {
    const s = makeSettings({ weekdayRestMinutes: 0, weekendRestMinutes: 30 });
    expect(calcEffectiveDuration(2, s, 'weekend')).toBe(1.5);
  });
  test('0.5h 向下取整', () => {
    const s = makeSettings({ roundToHalfHour: true, roundDown: true });
    expect(calcEffectiveDuration(2.3, s, 'weekday')).toBe(2);
  });
  test('0.5h 向上取整', () => {
    const s = makeSettings({ roundToHalfHour: true, roundDown: false });
    expect(calcEffectiveDuration(2.1, s, 'weekday')).toBe(2.5);
  });
  test('不取整时保留原值', () => {
    const s = makeSettings({ roundToHalfHour: false });
    expect(calcEffectiveDuration(2.3, s, 'weekday')).toBeCloseTo(2.3);
  });
});

describe('calcPay 加班工资', () => {
  test('按类型倍率', () => {
    expect(calcPay(2, 'weekday', makeSettings())).toBe(50); // 25 * 2
    expect(calcPay(2, 'weekend', makeSettings())).toBe(60); // 30 * 2
    expect(calcPay(2, 'holiday', makeSettings())).toBe(100); // 50 * 2
  });
});

describe('calcLateDurationHours / calcLateDeduction 迟到', () => {
  test('迟到时长 = 实到 - 应到', () => {
    expect(calcLateDurationHours('09:00', '10:30')).toBe(1.5);
  });
  test('未迟到返回 0', () => {
    expect(calcLateDurationHours('09:00', '09:00')).toBe(0);
    expect(calcLateDurationHours('09:00', '08:30')).toBe(0);
  });
  test('未启用扣款时返回 0', () => {
    const s = makeSettings({ lateDeductionEnabled: false, lateDeductionPerHour: 50 });
    expect(calcLateDeduction(2, s)).toBe(0);
  });
  test('按小时扣款（不上取整）', () => {
    const s = makeSettings({
      lateDeductionEnabled: true,
      lateDeductionPerHour: 50,
      lateRoundToHalfHour: false,
      lateRoundDown: false,
    });
    expect(calcLateDeduction(1.5, s)).toBe(75);
  });
  test('迟到时长按 0.5h 向上取整后扣款', () => {
    const s = makeSettings({
      lateDeductionEnabled: true,
      lateDeductionPerHour: 50,
      lateRoundToHalfHour: true,
      lateRoundDown: false,
    });
    expect(calcLateDeduction(1.2, s)).toBe(75); // 1.2 -> 1.5 -> 75
  });
});

describe('calcHourlyWageFromSalary 月薪算时薪', () => {
  test('基数 = 月薪 / 计薪天数 / 日工时', () => {
    expect(calcHourlyWageFromSalary(8000, 21.75, 8)).toBeCloseTo(45.98, 1);
  });
  test('除零保护', () => {
    expect(calcHourlyWageFromSalary(8000, 0, 8)).toBe(0);
    expect(calcHourlyWageFromSalary(8000, 21.75, 0)).toBe(0);
  });
});

describe('detectOvertimeType 类型识别', () => {
  const holidays = [
    { date: '2026-01-01', type: 'holiday' as const },
    { date: '2026-02-14', type: 'makeup' as const },
  ];
  test('法定假日优先', () => {
    expect(detectOvertimeType('2026-01-01', holidays)).toBe('holiday');
  });
  test('调休补班视为工作日（即使本身是周末）', () => {
    expect(detectOvertimeType('2026-02-14', holidays)).toBe('weekday');
  });
  test('无配置时按周末/工作日', () => {
    expect(detectOvertimeType('2026-02-15')).toBe('weekend'); // 周日
    expect(detectOvertimeType('2026-02-16')).toBe('weekday'); // 周一
  });
});

describe('calcEndTimeFromDuration 反推结束时间', () => {
  test('正常反推', () => {
    expect(calcEndTimeFromDuration('09:00', 2.5)).toBe('11:30');
  });
  test('跨过午夜回绕', () => {
    expect(calcEndTimeFromDuration('23:00', 2)).toBe('01:00');
  });
});

// ============ 统一计算入口 calcRecordFields ============
// 这是添加/编辑落库与添加页预览共用的唯一实现，覆盖三类记录的关键分支
describe('calcRecordFields 统一计算入口', () => {
  const overtimeInput = {
    date: '2026-02-16',
    normalOffTime: '18:00',
    actualOffTime: '20:00',
    crossDay: false,
    type: 'weekday' as const,
    reason: '',
    recordType: 'overtime' as const,
    manualDuration: 0,
    useCompOff: false,
    subsidy: 0,
    location: '',
  };

  test('加班：原始→有效→工资', () => {
    const r = calcRecordFields(overtimeInput, base);
    expect(r.rawHours).toBe(2);
    expect(r.effectiveHours).toBe(2);
    expect(r.durationHours).toBe(2);
    expect(r.pay).toBe(50); // 25 * 2
    expect(r.totalIncome).toBe(50);
    expect(r.deduction).toBe(0);
    expect(r.netIncome).toBe(50);
  });

  test('加班：扣休息后重新计算', () => {
    const s = makeSettings({ weekdayRestMinutes: 60 });
    const r = calcRecordFields(overtimeInput, s);
    expect(r.durationHours).toBe(1);
    expect(r.pay).toBe(25);
  });

  test('加班：补贴计入总收入', () => {
    const r = calcRecordFields({ ...overtimeInput, subsidy: 10 }, base);
    expect(r.pay).toBe(50);
    expect(r.totalIncome).toBe(60);
    expect(r.netIncome).toBe(60);
  });

  test('加班：手动时长优先于起止时间', () => {
    const r = calcRecordFields(
      { ...overtimeInput, manualDuration: 3, type: 'weekend' },
      makeSettings(),
    );
    expect(r.durationHours).toBe(3);
    expect(r.pay).toBe(90); // 30 * 3
  });

  test('加班：跨天时长', () => {
    const r = calcRecordFields(
      { ...overtimeInput, normalOffTime: '22:00', actualOffTime: '02:00', crossDay: true },
      base,
    );
    expect(r.rawHours).toBe(4);
    expect(r.durationHours).toBe(4);
  });

  test('请假：工资为 0、时长不扣休息', () => {
    const r = calcRecordFields(
      {
        ...overtimeInput,
        recordType: 'leave',
        normalOffTime: '09:00',
        actualOffTime: '18:00',
      },
      makeSettings({ weekdayRestMinutes: 60 }),
    );
    expect(r.durationHours).toBe(9); // 不扣休息
    expect(r.pay).toBe(0);
    expect(r.totalIncome).toBe(0);
    expect(r.deduction).toBe(0);
  });

  test('迟到：扣款与负净收入', () => {
    const s = makeSettings({
      lateDeductionEnabled: true,
      lateDeductionPerHour: 50,
      lateRoundToHalfHour: false,
      lateRoundDown: false,
    });
    const r = calcRecordFields(
      {
        ...overtimeInput,
        recordType: 'late',
        normalOffTime: '09:00',
        actualOffTime: '10:30',
      },
      s,
    );
    expect(r.durationHours).toBe(1.5);
    expect(r.pay).toBe(0);
    expect(r.deduction).toBe(75);
    expect(r.netIncome).toBe(-75);
  });

  test('迟到未到不扣款', () => {
    const s = makeSettings({ lateDeductionEnabled: true, lateDeductionPerHour: 50 });
    const r = calcRecordFields(
      {
        ...overtimeInput,
        recordType: 'late',
        normalOffTime: '09:00',
        actualOffTime: '09:00',
      },
      s,
    );
    expect(r.deduction).toBe(0);
    expect(r.netIncome).toBe(0);
  });
});

// ============ 日历多选汇总 calcSelectionSummary ============
// 日历界面「选择多日期 → 计算总时长」的核心聚合逻辑（组件内已改用此纯函数）
describe('calcSelectionSummary 日历多选汇总', () => {
  // 构造最精简的记录对象（仅需 date / durationHours / netIncome）
  const mk = (date: string, durationHours: number, netIncome: number) =>
    ({ date, durationHours, netIncome } as any);

  test('空选择 → 全零、明细为空', () => {
    const r = calcSelectionSummary([], [] as any);
    expect(r.perDay).toEqual([]);
    expect(r.totalHours).toBe(0);
    expect(r.totalPay).toBe(0);
  });

  test('单日单条加班', () => {
    const r = calcSelectionSummary(['2026-07-02'], [mk('2026-07-02', 2, 50)]);
    expect(r.totalHours).toBe(2);
    expect(r.totalPay).toBe(50);
    expect(r.perDay).toEqual([{ date: '2026-07-02', count: 1, hours: 2, pay: 50 }]);
  });

  test('需求示例：7/2、7/3、7/4 跨多天求和', () => {
    const records = [
      mk('2026-07-02', 2, 50),
      mk('2026-07-03', 3, 90),
      mk('2026-07-04', 1.5, 75),
    ];
    const r = calcSelectionSummary(['2026-07-04', '2026-07-02', '2026-07-03'], records);
    expect(r.totalHours).toBeCloseTo(6.5);
    expect(r.totalPay).toBe(215);
    // 结果按日期升序，与传入顺序无关
    expect(r.perDay.map((d) => d.date)).toEqual(['2026-07-02', '2026-07-03', '2026-07-04']);
  });

  test('全部记录类型：加班时长 + 请假时长 + 迟到负扣款', () => {
    const records = [
      mk('2026-07-02', 2, 50),    // 加班
      mk('2026-07-02', 1, 0),     // 请假（时长计入、收入 0）
      mk('2026-07-02', 0.5, -25), // 迟到（负净收入）
    ];
    const r = calcSelectionSummary(['2026-07-02'], records as any);
    expect(r.perDay[0].count).toBe(3);
    expect(r.perDay[0].hours).toBeCloseTo(3.5);
    expect(r.perDay[0].pay).toBeCloseTo(25);
    expect(r.totalHours).toBeCloseTo(3.5);
    expect(r.totalPay).toBeCloseTo(25);
  });

  test('未选中的日期不计入汇总', () => {
    const records = [
      mk('2026-07-02', 2, 50),
      mk('2026-07-99', 99, 999),
    ];
    const r = calcSelectionSummary(['2026-07-02'], records as any);
    expect(r.totalHours).toBe(2);
    expect(r.perDay).toHaveLength(1);
  });

  test('同一天多条记录合并到 perDay 一条', () => {
    const records = [
      mk('2026-07-02', 1, 25),
      mk('2026-07-02', 2, 50),
    ];
    const r = calcSelectionSummary(['2026-07-02'], records as any);
    expect(r.perDay).toHaveLength(1);
    expect(r.perDay[0].count).toBe(2);
    expect(r.perDay[0].hours).toBeCloseTo(3);
  });

  test('起止时间：首日最早开始、末日最晚结束', () => {
    const records = [
      { date: '2026-07-02', normalOffTime: '18:00', actualOffTime: '20:00', durationHours: 2, netIncome: 50 },
      { date: '2026-07-02', normalOffTime: '17:30', actualOffTime: '19:00', durationHours: 1.5, netIncome: 37.5 },
      { date: '2026-07-05', normalOffTime: '19:00', actualOffTime: '22:00', durationHours: 3, netIncome: 75 },
    ] as any;
    const r = calcSelectionSummary(['2026-07-05', '2026-07-02'], records);
    expect(r.startTime).toBe('17:30'); // 首日最早开始
    expect(r.endTime).toBe('22:00');   // 末日最晚结束
  });

  test('无记录时回退默认起止时间', () => {
    const r = calcSelectionSummary(['2026-07-09'], [] as any);
    expect(r.startTime).toBe('18:00');
    expect(r.endTime).toBe('20:00');
  });
});

// ============ 提示词生成 formatDotDate / formatDecimalHours / buildOvertimePrompt ============
describe('提示词生成', () => {
  test('formatDotDate 点分隔不补零', () => {
    expect(formatDotDate('2026-07-27')).toBe('2026.7.27');
    expect(formatDotDate('2026-12-03')).toBe('2026.12.3');
  });

  test('formatDecimalHours 整数与小数', () => {
    expect(formatDecimalHours(2)).toBe('2');
    expect(formatDecimalHours(7.5)).toBe('7.5');
    expect(formatDecimalHours(1.5)).toBe('1.5');
  });

  test('buildOvertimePrompt 拼接格式', () => {
    const p = buildOvertimePrompt({
      startDate: '2026-07-27',
      startTime: '17:30',
      endDate: '2026-07-30',
      endTime: '19:00',
      hours: 7.5,
    });
    expect(p).toBe('帮本人生成一个加班单，时间是2026.7.27的17:30～2026.7.30的19:00，共计时长7.5小时');
  });

  test('buildOvertimePrompt 整数时长不显示小数', () => {
    const p = buildOvertimePrompt({
      startDate: '2026-07-27',
      startTime: '18:00',
      endDate: '2026-07-27',
      endTime: '20:00',
      hours: 2,
    });
    expect(p).toBe('帮本人生成一个加班单，时间是2026.7.27的18:00～2026.7.27的20:00，共计时长2小时');
  });

  test('buildOvertimePrompt 自定义内容追加在末尾并自动补逗号', () => {
    const p = buildOvertimePrompt({
      startDate: '2026-07-27',
      startTime: '17:30',
      endDate: '2026-07-30',
      endTime: '19:00',
      hours: 7.5,
      customText: '申请理由按照我在这段时间的工作内容',
    });
    expect(p).toBe(
      '帮本人生成一个加班单，时间是2026.7.27的17:30～2026.7.30的19:00，共计时长7.5小时，申请理由按照我在这段时间的工作内容',
    );
  });

  test('buildOvertimePrompt 自定义内容已带标点则不重复补逗号', () => {
    const p = buildOvertimePrompt({
      startDate: '2026-07-27',
      startTime: '17:30',
      endDate: '2026-07-30',
      endTime: '19:00',
      hours: 7.5,
      customText: '，含项目联调与版本发布',
    });
    expect(p).toBe(
      '帮本人生成一个加班单，时间是2026.7.27的17:30～2026.7.30的19:00，共计时长7.5小时，含项目联调与版本发布',
    );
  });

  test('buildOvertimePrompt 自定义内容为空/纯空白时仅返回固定前半句', () => {
    const p = buildOvertimePrompt({
      startDate: '2026-07-27',
      startTime: '17:30',
      endDate: '2026-07-30',
      endTime: '19:00',
      hours: 7.5,
      customText: '   ',
    });
    expect(p).toBe(
      '帮本人生成一个加班单，时间是2026.7.27的17:30～2026.7.30的19:00，共计时长7.5小时',
    );
  });
});

