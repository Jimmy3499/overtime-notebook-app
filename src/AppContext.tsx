import React, { createContext, useContext, useEffect, useReducer, useCallback, useMemo } from 'react';
import { loadRecords, saveRecords, loadSettings, saveSettings, loadHolidays, saveHolidays, loadCompOff, saveCompOff, loadMarkedDates, saveMarkedDates, loadHolidaySyncMeta, saveHolidaySyncMeta } from './storage';
import type { OvertimeRecord, Settings, HolidayConfig, CompOffInventory, RecordType, OvertimeType, RecordInput } from './types';
import { DEFAULT_SETTINGS } from './constants';
import {
  genId, calcEndTimeFromDuration,
  defaultSettings, detectOvertimeType, todayStr, calcRecordFields,
} from './utils';
import { fetchHolidaysForYears, mergeHolidays, defaultSyncYears, FALLBACK_HOLIDAYS } from './holidaySync';

// 动作类型
type Action =
  | { type: 'SET_RECORDS'; records: OvertimeRecord[] }
  | { type: 'ADD_RECORD'; record: OvertimeRecord }
  | { type: 'UPDATE_RECORD'; record: OvertimeRecord }
  | { type: 'DELETE_RECORD'; id: string }
  | { type: 'SET_SETTINGS'; settings: Settings }
  | { type: 'SET_HOLIDAYS'; holidays: HolidayConfig[] }
  | { type: 'SET_COMP_OFF'; compOff: CompOffInventory }
  | { type: 'SET_MARKED_DATES'; dates: string[] }
  | { type: 'TOGGLE_MARKED_DATE'; date: string }
  | { type: 'HYDRATE'; payload: { records: OvertimeRecord[]; settings: Settings; holidays: HolidayConfig[]; compOff: CompOffInventory; markedDates: string[] } };

interface State {
  records: OvertimeRecord[];
  settings: Settings;
  holidays: HolidayConfig[];
  compOff: CompOffInventory;
  markedDates: string[];
  hydrated: boolean;
}

const initialState: State = {
  records: [],
  settings: defaultSettings(),
  holidays: [],
  compOff: { totalHours: 0, usedHours: 0, records: [] },
  markedDates: [],
  hydrated: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'HYDRATE':
      return {
        ...state,
        records: action.payload.records,
        settings: action.payload.settings,
        holidays: action.payload.holidays,
        compOff: action.payload.compOff,
        markedDates: action.payload.markedDates,
        hydrated: true,
      };
    case 'SET_MARKED_DATES':
      return { ...state, markedDates: action.dates };
    case 'TOGGLE_MARKED_DATE': {
      const exists = state.markedDates.includes(action.date);
      return {
        ...state,
        markedDates: exists
          ? state.markedDates.filter(d => d !== action.date)
          : [...state.markedDates, action.date],
      };
    }
    case 'SET_RECORDS':
      return { ...state, records: action.records };
    case 'ADD_RECORD':
      return { ...state, records: [action.record, ...state.records] };
    case 'UPDATE_RECORD':
      return {
        ...state,
        records: state.records.map(r => r.id === action.record.id ? action.record : r),
      };
    case 'DELETE_RECORD':
      return { ...state, records: state.records.filter(r => r.id !== action.id) };
    case 'SET_SETTINGS':
      return { ...state, settings: action.settings };
    case 'SET_HOLIDAYS':
      return { ...state, holidays: action.holidays };
    case 'SET_COMP_OFF':
      return { ...state, compOff: action.compOff };
    default:
      return state;
  }
}

// 添加/编辑记录的输入参数类型见 src/types.ts 的 RecordInput
// 记录计算逻辑统一由 src/utils.ts 的 calcRecordFields 提供

// 迁移旧记录到新格式
function migrateRecords(records: OvertimeRecord[]): OvertimeRecord[] {
  return records.map(r => {
    const migrated = { ...r };
    if (!migrated.recordType) migrated.recordType = 'overtime';
    if (migrated.manualDuration === undefined) migrated.manualDuration = 0;
    if (migrated.deduction === undefined) migrated.deduction = 0;
    if (migrated.netIncome === undefined) migrated.netIncome = migrated.totalIncome || 0;
    if (migrated.location === undefined) migrated.location = '';
    if (!migrated.createdAt) migrated.createdAt = Date.now();
    if (!migrated.updatedAt) migrated.updatedAt = Date.now();
    return migrated;
  });
}

// 迁移旧设置
function migrateSettings(settings: Partial<Settings>): Settings {
  const merged: Settings = { ...DEFAULT_SETTINGS, ...settings };
  // 新增字段兜底
  if (merged.weekdayWorkStartTime === undefined) merged.weekdayWorkStartTime = '09:00';
  if (merged.weekendWorkStartTime === undefined) merged.weekendWorkStartTime = '09:00';
  if (merged.lateDeductionEnabled === undefined) merged.lateDeductionEnabled = false;
  if (merged.lateDeductionPerHour === undefined) merged.lateDeductionPerHour = 50;
  if (merged.lateRoundToHalfHour === undefined) merged.lateRoundToHalfHour = true;
  if (merged.lateRoundDown === undefined) merged.lateRoundDown = false;
  if (merged.salaryMultiplierWeekday === undefined) merged.salaryMultiplierWeekday = 1.5;
  if (merged.salaryMultiplierWeekend === undefined) merged.salaryMultiplierWeekend = 2;
  if (merged.salaryMultiplierHoliday === undefined) merged.salaryMultiplierHoliday = 3;
  return merged;
}

// 重新计算所有记录的薪资
function recalcRecords(records: OvertimeRecord[], settings: Settings): OvertimeRecord[] {
  return records.map(r => {
    const input: RecordInput = {
      date: r.date,
      normalOffTime: r.normalOffTime,
      actualOffTime: r.actualOffTime,
      crossDay: r.crossDay,
      type: r.type,
      reason: r.reason,
      recordType: r.recordType,
      manualDuration: r.manualDuration,
      useCompOff: r.useCompOff,
      subsidy: r.subsidy,
      location: r.location,
    };
    const fields = calcRecordFields(input, settings);
    return {
      ...r,
      durationHours: fields.durationHours,
      pay: fields.pay,
      totalIncome: fields.totalIncome,
      deduction: fields.deduction,
      netIncome: fields.netIncome,
      updatedAt: Date.now(),
    };
  });
}

const AppContext = createContext<{
  state: State;
  records: OvertimeRecord[];
  settings: Settings;
  holidays: HolidayConfig[];
  compOff: CompOffInventory;
  markedDates: string[];
  addRecord: (input: RecordInput) => OvertimeRecord;
  updateRecord: (id: string, input: RecordInput) => OvertimeRecord | null;
  deleteRecord: (id: string) => void;
  duplicateRecord: (id: string) => OvertimeRecord | null;
  updateSettings: (settings: Settings, recalcAll?: boolean) => void;
  recalcAllRecords: () => void;
  updateHolidays: (holidays: HolidayConfig[]) => void;
  syncHolidaysFromNetwork: () => Promise<{ added: number; updated: number; kept: number }>;
  setRecords: (records: OvertimeRecord[]) => void;
  toggleMarkedDate: (date: string) => void;
  detectType: (dateStr: string) => OvertimeType;
  getRecordById: (id: string) => OvertimeRecord | undefined;
  calcEndFromDuration: (startTime: string, duration: number, recordType: RecordType) => string;
  addCompOffRecord: (record: CompOffInventory['records'][number]) => void;
  useCompOffHours: (hours: number, note: string) => void;
} | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // 初始加载
  useEffect(() => {
    (async () => {
      const [records, settings, holidays, compOff, markedDates] = await Promise.all([
        loadRecords(),
        loadSettings(),
        loadHolidays(),
        loadCompOff(),
        loadMarkedDates(),
      ]);
      dispatch({
        type: 'HYDRATE',
        payload: {
          records: migrateRecords(records || []),
          settings: migrateSettings(settings || {}),
          // 若本地无节假日数据，则用内置兜底（官方安排），保证离线也能识别
          holidays: holidays && holidays.length ? holidays : FALLBACK_HOLIDAYS,
          compOff: compOff || { totalHours: 0, usedHours: 0, records: [] },
          markedDates: markedDates || [],
        },
      });
    })();
  }, []);

  // 持久化
  useEffect(() => {
    if (state.hydrated) saveRecords(state.records);
  }, [state.records, state.hydrated]);

  useEffect(() => {
    if (state.hydrated) saveSettings(state.settings);
  }, [state.settings, state.hydrated]);

  useEffect(() => {
    if (state.hydrated) saveHolidays(state.holidays);
  }, [state.holidays, state.hydrated]);

  useEffect(() => {
    if (state.hydrated) saveCompOff(state.compOff);
  }, [state.compOff, state.hydrated]);

  useEffect(() => {
    if (state.hydrated) saveMarkedDates(state.markedDates);
  }, [state.markedDates, state.hydrated]);

  const addRecord = useCallback((input: RecordInput): OvertimeRecord => {
    const fields = calcRecordFields(input, state.settings);
    const record: OvertimeRecord = {
      id: genId(),
      date: input.date,
      normalOffTime: input.normalOffTime,
      actualOffTime: input.actualOffTime,
      crossDay: input.crossDay,
      type: input.type,
      reason: input.reason,
      recordType: input.recordType,
      manualDuration: input.manualDuration,
      durationHours: fields.durationHours,
      pay: fields.pay,
      subsidy: input.subsidy,
      totalIncome: fields.totalIncome,
      deduction: fields.deduction,
      netIncome: fields.netIncome,
      useCompOff: input.useCompOff,
      location: input.location,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    dispatch({ type: 'ADD_RECORD', record });
    return record;
  }, [state.settings]);

  const updateRecord = useCallback((id: string, input: RecordInput): OvertimeRecord | null => {
    const existing = state.records.find(r => r.id === id);
    if (!existing) return null;
    const fields = calcRecordFields(input, state.settings);
    const updated: OvertimeRecord = {
      ...existing,
      date: input.date,
      normalOffTime: input.normalOffTime,
      actualOffTime: input.actualOffTime,
      crossDay: input.crossDay,
      type: input.type,
      reason: input.reason,
      recordType: input.recordType,
      manualDuration: input.manualDuration,
      durationHours: fields.durationHours,
      pay: fields.pay,
      subsidy: input.subsidy,
      totalIncome: fields.totalIncome,
      deduction: fields.deduction,
      netIncome: fields.netIncome,
      useCompOff: input.useCompOff,
      location: input.location,
      updatedAt: Date.now(),
    };
    dispatch({ type: 'UPDATE_RECORD', record: updated });
    return updated;
  }, [state.records, state.settings]);

  const deleteRecord = useCallback((id: string) => {
    dispatch({ type: 'DELETE_RECORD', id });
  }, []);

  const duplicateRecord = useCallback((id: string): OvertimeRecord | null => {
    const existing = state.records.find(r => r.id === id);
    if (!existing) return null;
    const input: RecordInput = {
      date: todayStr(),
      normalOffTime: existing.normalOffTime,
      actualOffTime: existing.actualOffTime,
      crossDay: existing.crossDay,
      type: existing.type,
      reason: existing.reason,
      recordType: existing.recordType,
      manualDuration: existing.manualDuration,
      useCompOff: existing.useCompOff,
      subsidy: existing.subsidy,
      location: existing.location,
    };
    const newRecord = calcRecordFields(input, state.settings);
    const record: OvertimeRecord = {
      id: genId(),
      ...input,
      normalOffTime: input.normalOffTime,
      actualOffTime: input.actualOffTime,
      durationHours: newRecord.durationHours,
      pay: newRecord.pay,
      totalIncome: newRecord.totalIncome,
      deduction: newRecord.deduction,
      netIncome: newRecord.netIncome,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    dispatch({ type: 'ADD_RECORD', record });
    return record;
  }, [state.records, state.settings]);

  const updateSettings = useCallback((settings: Settings, recalcAll?: boolean) => {
    dispatch({ type: 'SET_SETTINGS', settings });
    if (recalcAll) {
      dispatch({ type: 'SET_RECORDS', records: recalcRecords(state.records, settings) });
    }
  }, [state.records]);

  const recalcAllRecords = useCallback(() => {
    dispatch({ type: 'SET_RECORDS', records: recalcRecords(state.records, state.settings) });
  }, [state.records, state.settings]);

  const updateHolidays = useCallback((holidays: HolidayConfig[]) => {
    dispatch({ type: 'SET_HOLIDAYS', holidays });
  }, []);

  // 从官方接口拉取近三年节假日并与现有数据合并（官方覆盖同日，保留手动条目）
  const syncHolidaysFromNetwork = useCallback(async () => {
    const years = defaultSyncYears();
    const official = await fetchHolidaysForYears(years);
    if (!official.length) throw new Error('未获取到节假日数据');
    const { merged, added, updated, kept } = mergeHolidays(official, state.holidays);
    updateHolidays(merged);
    await saveHolidaySyncMeta({
      year: new Date().getFullYear(),
      at: Date.now(),
      source: 'jsdelivr',
    });
    return { added, updated, kept };
  }, [state.holidays, updateHolidays]);

  // 冷启动自动同步：若今年尚未同步过，则静默拉取一次（失败不影响现有数据）
  useEffect(() => {
    if (!state.hydrated) return;
    (async () => {
      try {
        const meta = await loadHolidaySyncMeta();
        const y = new Date().getFullYear();
        if (meta && meta.year >= y) return;
        const official = await fetchHolidaysForYears(defaultSyncYears());
        if (!official.length) return;
        const { merged } = mergeHolidays(official, state.holidays);
        updateHolidays(merged);
        await saveHolidaySyncMeta({ year: y, at: Date.now(), source: 'jsdelivr' });
      } catch {
        // 静默兜底，网络异常不阻塞启动
      }
    })();
    // 仅在首次 hydrated 后执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hydrated]);

  const setRecords = useCallback((records: OvertimeRecord[]) => {
    dispatch({ type: 'SET_RECORDS', records });
  }, []);

  const toggleMarkedDate = useCallback((date: string) => {
    dispatch({ type: 'TOGGLE_MARKED_DATE', date });
  }, []);

  const detectType = useCallback((dateStr: string): OvertimeType => {
    return detectOvertimeType(dateStr, state.holidays);
  }, [state.holidays]);

  const getRecordById = useCallback((id: string) => {
    return state.records.find(r => r.id === id);
  }, [state.records]);

  const calcEndFromDuration = useCallback((startTime: string, duration: number, recordType: RecordType): string => {
    return calcEndTimeFromDuration(startTime, duration);
  }, []);

  const addCompOffRecord = useCallback((record: CompOffInventory['records'][number]) => {
    dispatch({
      type: 'SET_COMP_OFF',
      compOff: {
        ...state.compOff,
        totalHours: state.compOff.totalHours + record.hours,
        records: [record, ...state.compOff.records],
      },
    });
  }, [state.compOff]);

  const useCompOffHours = useCallback((hours: number, note: string) => {
    const record: CompOffInventory['records'][number] = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: todayStr(),
      hours: -hours,
      note,
      createdAt: Date.now(),
    };
    dispatch({
      type: 'SET_COMP_OFF',
      compOff: {
        ...state.compOff,
        totalHours: state.compOff.totalHours - hours,
        usedHours: state.compOff.usedHours + hours,
        records: [record, ...state.compOff.records],
      },
    });
  }, [state.compOff]);

  const value = useMemo(() => ({
    state,
    records: state.records,
    settings: state.settings,
    holidays: state.holidays,
    compOff: state.compOff,
    markedDates: state.markedDates,
    addRecord,
    updateRecord,
    deleteRecord,
    duplicateRecord,
    updateSettings,
    recalcAllRecords,
    updateHolidays,
    syncHolidaysFromNetwork,
    setRecords,
    toggleMarkedDate,
    detectType,
    getRecordById,
    calcEndFromDuration,
    addCompOffRecord,
    useCompOffHours,
  }), [
    state, addRecord, updateRecord, deleteRecord, duplicateRecord,
    updateSettings, recalcAllRecords, updateHolidays, syncHolidaysFromNetwork, setRecords, toggleMarkedDate, detectType, getRecordById, calcEndFromDuration,
    addCompOffRecord, useCompOffHours,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
