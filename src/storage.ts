import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OvertimeRecord, Settings, CompOffInventory, HolidayConfig } from './types';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from './constants';

export async function loadRecords(): Promise<OvertimeRecord[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.RECORDS);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as OvertimeRecord[];
    return arr.sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt
    );
  } catch {
    return [];
  }
}

export async function saveRecords(records: OvertimeRecord[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
}

export async function loadSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export async function loadHolidays(): Promise<HolidayConfig[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.HOLIDAYS);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as HolidayConfig[];
  } catch {
    return [];
  }
}

export async function saveHolidays(holidays: HolidayConfig[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(holidays));
}

export async function loadCompOff(): Promise<CompOffInventory> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.COMP_OFF);
  if (!raw) return { totalHours: 0, usedHours: 0, records: [] };
  try {
    return JSON.parse(raw) as CompOffInventory;
  } catch {
    return { totalHours: 0, usedHours: 0, records: [] };
  }
}

export async function saveCompOff(b: CompOffInventory): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.COMP_OFF, JSON.stringify(b));
}

export async function loadMarkedDates(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.MARKED_DATES);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(d => typeof d === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveMarkedDates(dates: string[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.MARKED_DATES, JSON.stringify(dates));
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.RECORDS,
    STORAGE_KEYS.COMP_OFF,
    STORAGE_KEYS.HOLIDAYS,
    STORAGE_KEYS.CHECK_INS,
    STORAGE_KEYS.MARKED_DATES,
  ]);
}

// 节假日同步元数据（记录最近一次官方同步的年份，用于"每年只刷一次"）
export interface HolidaySyncMeta {
  year: number;        // 已同步到的年份
  at: number;          // 同步时间戳
  source: string;      // 数据来源
}

export async function loadHolidaySyncMeta(): Promise<HolidaySyncMeta | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.HOLIDAY_SYNC);
  if (!raw) return null;
  try {
    const m = JSON.parse(raw) as HolidaySyncMeta;
    return typeof m.year === 'number' ? m : null;
  } catch {
    return null;
  }
}

export async function saveHolidaySyncMeta(m: HolidaySyncMeta): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.HOLIDAY_SYNC, JSON.stringify(m));
}
