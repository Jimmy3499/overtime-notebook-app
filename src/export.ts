import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { OvertimeRecord } from './types';
import { OVERTIME_TYPE_INFO, RECORD_TYPE_INFO } from './constants';
import { formatDuration } from './utils';

// ---------- 网页端（浏览器）辅助：用原生 DOM API 实现下载/读取 ----------
// 用 globalThis as any，避免 RN 工程无 DOM 类型时编译报错。
function downloadTextWeb(filename: string, content: string, mime: string): void {
  const w = globalThis as any;
  const blob = new w.Blob([content], { type: mime });
  const url = w.URL.createObjectURL(blob);
  const a = w.document.createElement('a');
  a.href = url;
  a.download = filename;
  w.document.body.appendChild(a);
  a.click();
  w.document.body.removeChild(a);
  setTimeout(() => w.URL.revokeObjectURL(url), 1000);
}

function readFileTextWeb(): Promise<string> {
  const w = globalThis as any;
  return new Promise((resolve, reject) => {
    const input = w.document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const f = input.files && input.files[0];
      if (!f) {
        reject(new Error('未选择文件'));
        return;
      }
      const reader = new w.FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error('读取失败'));
      reader.readAsText(f);
    };
    input.click();
  });
}

// ---------- 原生端（Android）辅助 ----------
// 写入文本文件并返回 URI
function writeTextFile(name: string, content: string): string {
  const file = new File(Paths.cache, name);
  file.write(content);
  return file.uri;
}

// 读取文本文件
async function readTextFile(uri: string): Promise<string> {
  const file = new File(uri);
  return await file.text();
}

// CSV 字段转义（含逗号/引号/换行需用双引号包裹）
function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// 导出为 CSV（Excel 可直接打开，带 BOM 防中文乱码）
export async function exportRecordsAsCSV(records: OvertimeRecord[]): Promise<void> {
  const header = [
    '日期', '记录类型', '加班/请假类型', '开始时间', '结束时间', '是否跨天',
    '时长(小时)', '工资(元)', '补贴(元)', '收入(元)',
    '调休抵扣', '地点', '事由',
  ];
  const rows = records.map(r => {
    const recordType = r.recordType || 'overtime';
    const rtInfo = RECORD_TYPE_INFO[recordType];
    return [
      r.date,
      rtInfo.label,
      OVERTIME_TYPE_INFO[r.type].label,
      r.normalOffTime,
      r.actualOffTime,
      r.crossDay ? '是' : '否',
      r.durationHours,
      r.pay,
      r.subsidy,
      r.totalIncome,
      r.useCompOff ? '是' : '否',
      r.location,
      r.reason,
    ].map(csvEscape).join(',');
  });

  const csv = '\uFEFF' + [header.map(csvEscape).join(','), ...rows].join('\n');

  if (Platform.OS === 'web') {
    downloadTextWeb(`overtime_records_${Date.now()}.csv`, csv, 'text/csv;charset=utf-8');
    return;
  }
  const uri = writeTextFile(`overtime_records_${Date.now()}.csv`, csv);
  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    dialogTitle: '导出加班记录',
    UTI: 'public.comma-separated-values-text',
  });
}

// 导出为 JSON 备份（含记录+设置）
export async function exportBackup(data: { records: OvertimeRecord[]; settings: unknown }): Promise<void> {
  const json = JSON.stringify({
    version: 2,
    exportedAt: new Date().toISOString(),
    records: data.records,
    settings: data.settings,
  }, null, 2);

  if (Platform.OS === 'web') {
    downloadTextWeb(`overtime_backup_${Date.now()}.json`, json, 'application/json');
    return;
  }
  const uri = writeTextFile(`overtime_backup_${Date.now()}.json`, json);
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: '导出数据备份',
    UTI: 'public.json',
  });
}

// 从 JSON 备份导入
export async function importBackup(): Promise<{ records: OvertimeRecord[]; settings?: unknown } | null> {
  if (Platform.OS === 'web') {
    try {
      const content = await readFileTextWeb();
      const parsed = JSON.parse(content);
      if (!parsed || !Array.isArray(parsed.records)) {
        throw new Error('备份文件格式不正确');
      }
      return { records: parsed.records as OvertimeRecord[], settings: parsed.settings };
    } catch (e) {
      if (e instanceof Error && e.message === '未选择文件') return null;
      throw e;
    }
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const file = result.assets[0];
  const content = await readTextFile(file.uri);
  const parsed = JSON.parse(content);
  if (!parsed || !Array.isArray(parsed.records)) {
    throw new Error('备份文件格式不正确');
  }
  return { records: parsed.records as OvertimeRecord[], settings: parsed.settings };
}

// 文本预览（用于打印台账/分享）
export function buildLedgerText(records: OvertimeRecord[]): string {
  const lines: string[] = [];
  lines.push('========== 加班明细台账 ==========');
  lines.push(`导出时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push(`共 ${records.length} 条记录`);
  lines.push('');
  records.forEach((r, i) => {
    const recordType = r.recordType || 'overtime';
    const rtLabel = RECORD_TYPE_INFO[recordType].label;
    lines.push(`【${i + 1}】${r.date} ${rtLabel} ${OVERTIME_TYPE_INFO[r.type].label}`);
    lines.push(`    时间：${r.normalOffTime} → ${r.actualOffTime}${r.crossDay ? '(次日)' : ''}  时长：${formatDuration(r.durationHours)}`);
    if (r.location) lines.push(`    地点：${r.location}`);
    if (r.reason) lines.push(`    事由：${r.reason}`);
    if (recordType === 'overtime') {
      lines.push(`    加班工资：¥${r.pay.toFixed(2)}  补贴：¥${r.subsidy.toFixed(2)}  合计：¥${r.totalIncome.toFixed(2)}`);
    } else if (recordType === 'late') {
      lines.push(`    迟到时长：${formatDuration(r.durationHours)}  扣款：¥${(r.deduction || 0).toFixed(2)}`);
    } else {
      lines.push(`    请假时长：${formatDuration(r.durationHours)}`);
    }
    lines.push('');
  });
  const totalPay = records.reduce((s, r) => s + r.pay, 0);
  const totalSubsidy = records.reduce((s, r) => s + r.subsidy, 0);
  const totalIncome = records.reduce((s, r) => s + r.totalIncome, 0);
  const totalHours = records.reduce((s, r) => s + r.durationHours, 0);
  lines.push('========== 汇总 ==========');
  lines.push(`总时长：${formatDuration(totalHours)}`);
  lines.push(`加班工资合计：¥${totalPay.toFixed(2)}`);
  lines.push(`补贴合计：¥${totalSubsidy.toFixed(2)}`);
  lines.push(`总收入合计：¥${totalIncome.toFixed(2)}`);
  return lines.join('\n');
}

// 导出台账为 txt 并分享
export async function exportLedger(records: OvertimeRecord[]): Promise<void> {
  const text = buildLedgerText(records);

  if (Platform.OS === 'web') {
    downloadTextWeb(`overtime_ledger_${Date.now()}.txt`, text, 'text/plain;charset=utf-8');
    return;
  }
  const uri = writeTextFile(`overtime_ledger_${Date.now()}.txt`, text);
  await Sharing.shareAsync(uri, {
    mimeType: 'text/plain',
    dialogTitle: '导出加班台账',
    UTI: 'public.plain-text',
  });
}
