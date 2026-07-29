import React, { useEffect, useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TextInput, Switch, TouchableOpacity, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../AppContext';
import { DEFAULT_SETTINGS, OVERTIME_TYPE_INFO, THEME, APP_VERSION } from '../constants';
import { calcHourlyWageFromSalary, formatMoney } from '../utils';
import { exportRecordsAsCSV, exportLedger, exportBackup, importBackup, buildLedgerText } from '../export';
import type { Settings } from '../types';
import { clearAllData } from '../storage';

type Key = keyof Settings;

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { settings, updateSettings, records, setRecords, holidays } = useApp();
  const [form, setForm] = useState<Settings>(settings);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm(settings);
    setDirty(false);
  }, [settings]);

  const handleSave = () => {
    const salaryFields: (keyof Settings)[] = [
      'hourlyWageWeekday', 'hourlyWageWeekend', 'hourlyWageHoliday',
      'monthlySalary', 'workDaysPerMonth', 'workHoursPerDay',
      'useMonthlySalary', 'salaryMultiplierWeekday', 'salaryMultiplierWeekend', 'salaryMultiplierHoliday',
      'weekdayRestMinutes', 'weekendRestMinutes',
      'roundToHalfHour', 'roundDown',
      'lateDeductionEnabled', 'lateDeductionPerHour', 'lateRoundToHalfHour', 'lateRoundDown',
    ];
    let needRecalc = false;
    for (const key of salaryFields) {
      if (form[key] !== settings[key]) {
        needRecalc = true;
        break;
      }
    }
    updateSettings(form, needRecalc);
    setDirty(false);
    if (needRecalc) {
      Alert.alert('设置已保存', '已根据新薪资标准重新计算所有历史记录');
    } else {
      Alert.alert('设置已保存');
    }
  };

  const handleReset = () => {
    Alert.alert('恢复默认', '确定恢复所有设置为默认值？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: () => {
          setForm({ ...DEFAULT_SETTINGS });
          setDirty(true);
        },
      },
    ]);
  };

  const setField = (key: Key, value: string | number | boolean) => {
    setForm({ ...form, [key]: value });
    setDirty(true);
  };

  // 如果启用月薪算时薪，自动计算
  useEffect(() => {
    if (form.useMonthlySalary && form.monthlySalary > 0) {
      const baseWage = calcHourlyWageFromSalary(form.monthlySalary, form.workDaysPerMonth, form.workHoursPerDay);
      const updated = {
        ...form,
        hourlyWageWeekday: +(baseWage * (form.salaryMultiplierWeekday || 1.5)).toFixed(2),
        hourlyWageWeekend: +(baseWage * (form.salaryMultiplierWeekend || 2)).toFixed(2),
        hourlyWageHoliday: +(baseWage * (form.salaryMultiplierHoliday || 3)).toFixed(2),
      };
      setForm(updated);
    }
  }, [form.useMonthlySalary, form.monthlySalary, form.workDaysPerMonth, form.workHoursPerDay,
      form.salaryMultiplierWeekday, form.salaryMultiplierWeekend, form.salaryMultiplierHoliday]);

  const wageFields: { key: Key; label: string }[] = [
    { key: 'hourlyWageWeekday', label: '工作日时薪' },
    { key: 'hourlyWageWeekend', label: '周末时薪' },
    { key: 'hourlyWageHoliday', label: '节假日时薪' },
  ];

  const startTimeFields: { key: Key; label: string }[] = [
    { key: 'weekdayStartTime', label: '工作日默认加班开始时间' },
    { key: 'weekendStartTime', label: '非工作日默认加班开始时间' },
  ];

  const workStartTimeFields: { key: Key; label: string }[] = [
    { key: 'weekdayWorkStartTime', label: '工作日默认上班时间' },
    { key: 'weekendWorkStartTime', label: '非工作日默认上班时间' },
  ];

  const restFields: { key: Key; label: string }[] = [
    { key: 'weekdayRestMinutes', label: '工作日加班休息扣减（分钟）' },
    { key: 'weekendRestMinutes', label: '非工作日加班休息扣减（分钟）' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* 时薪设置 */}
      <Text style={styles.sectionTitle}>时薪设置</Text>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>使用月薪算时薪</Text>
            <Text style={styles.subLabel}>按月薪÷计薪天数÷日工时算基数，再乘倍率</Text>
          </View>
          <Switch
            value={form.useMonthlySalary}
            onValueChange={v => setField('useMonthlySalary', v)}
            trackColor={{ false: THEME.border, true: THEME.primary }}
          />
        </View>
        {form.useMonthlySalary ? (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>月薪（元）</Text>
              <TextInput
                style={styles.input}
                value={String(form.monthlySalary)}
                onChangeText={v => setField('monthlySalary', parseFloat(v) || 0)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>每月计薪天数</Text>
              <TextInput
                style={styles.input}
                value={String(form.workDaysPerMonth)}
                onChangeText={v => setField('workDaysPerMonth', parseFloat(v) || 0)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>每日工作时长（小时）</Text>
              <TextInput
                style={styles.input}
                value={String(form.workHoursPerDay)}
                onChangeText={v => setField('workHoursPerDay', parseFloat(v) || 0)}
                keyboardType="numeric"
              />
            </View>

            {/* 倍率设置 */}
            <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.divider, marginTop: 4, paddingTop: 12 }]}>
              <Text style={[styles.label, { fontWeight: '600' }]}>加班倍率设置</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>工作日倍率</Text>
              <TextInput
                style={styles.input}
                value={String(form.salaryMultiplierWeekday)}
                onChangeText={v => setField('salaryMultiplierWeekday', parseFloat(v) || 0)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>周末倍率</Text>
              <TextInput
                style={styles.input}
                value={String(form.salaryMultiplierWeekend)}
                onChangeText={v => setField('salaryMultiplierWeekend', parseFloat(v) || 0)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>节假日倍率</Text>
              <TextInput
                style={styles.input}
                value={String(form.salaryMultiplierHoliday)}
                onChangeText={v => setField('salaryMultiplierHoliday', parseFloat(v) || 0)}
                keyboardType="numeric"
              />
            </View>

            {/* 显示三者时薪 */}
            {form.monthlySalary > 0 && form.workDaysPerMonth > 0 && form.workHoursPerDay > 0 ? (
              <View style={styles.wageDisplay}>
                <Text style={styles.wageDisplayTitle}>计算结果</Text>
                <View style={styles.wageRow}>
                  <Text style={styles.wageLabel}>工作日时薪</Text>
                  <Text style={styles.wageValue}>{formatMoney(form.hourlyWageWeekday)}/h</Text>
                </View>
                <View style={styles.wageRow}>
                  <Text style={styles.wageLabel}>周末时薪</Text>
                  <Text style={styles.wageValue}>{formatMoney(form.hourlyWageWeekend)}/h</Text>
                </View>
                <View style={styles.wageRow}>
                  <Text style={styles.wageLabel}>节假日时薪</Text>
                  <Text style={styles.wageValue}>{formatMoney(form.hourlyWageHoliday)}/h</Text>
                </View>
              </View>
            ) : null}
          </>
        ) : (
          wageFields.map(f => (
            <View key={f.key} style={styles.row}>
              <Text style={styles.label}>{f.label}（元/小时）</Text>
              <TextInput
                style={styles.input}
                value={String(form[f.key] || 0)}
                onChangeText={v => setField(f.key, parseFloat(v) || 0)}
                keyboardType="numeric"
              />
            </View>
          ))
        )}
      </View>

      {/* 加班开始时间 */}
      <Text style={styles.sectionTitle}>加班开始时间</Text>
      <View style={styles.card}>
        {startTimeFields.map(f => (
          <View key={f.key} style={styles.row}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput
              style={[styles.input, { width: 100 }]}
              value={String(form[f.key] || '')}
              onChangeText={v => setField(f.key, v)}
              placeholder="18:00"
              placeholderTextColor={THEME.textMute}
            />
          </View>
        ))}
      </View>

      {/* 上班时间设置（用于请假/迟到计算） */}
      <Text style={styles.sectionTitle}>默认上班时间（用于请假/迟到）</Text>
      <View style={styles.card}>
        {workStartTimeFields.map(f => (
          <View key={f.key} style={styles.row}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput
              style={[styles.input, { width: 100 }]}
              value={String(form[f.key] || '')}
              onChangeText={v => setField(f.key, v)}
              placeholder="09:00"
              placeholderTextColor={THEME.textMute}
            />
          </View>
        ))}
      </View>

      {/* 休息扣减 */}
      <Text style={styles.sectionTitle}>休息扣减</Text>
      <View style={styles.card}>
        {restFields.map(f => (
          <View key={f.key} style={styles.row}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput
              style={[styles.input, { width: 100 }]}
              value={String(form[f.key] || 0)}
              onChangeText={v => setField(f.key, parseFloat(v) || 0)}
              keyboardType="numeric"
            />
          </View>
        ))}
      </View>

      {/* 迟到扣款设置 */}
      <Text style={styles.sectionTitle}>迟到扣款</Text>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <Text style={styles.label}>启用迟到扣款</Text>
          <Switch
            value={form.lateDeductionEnabled}
            onValueChange={v => setField('lateDeductionEnabled', v)}
            trackColor={{ false: THEME.border, true: THEME.primary }}
          />
        </View>
        {form.lateDeductionEnabled && (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>每小时扣款（元/小时）</Text>
              <TextInput
                style={styles.input}
                value={String(form.lateDeductionPerHour)}
                onChangeText={v => setField('lateDeductionPerHour', parseFloat(v) || 0)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.label}>迟到时长按0.5小时取整</Text>
              <Switch
                value={form.lateRoundToHalfHour}
                onValueChange={v => setField('lateRoundToHalfHour', v)}
                trackColor={{ false: THEME.border, true: THEME.primary }}
              />
            </View>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>迟到取整方式</Text>
                <Text style={styles.subLabel}>
                  {form.lateRoundDown ? '向下取整' : '向上取整（不足0.5按0.5算）'}
                </Text>
              </View>
              <Switch
                value={form.lateRoundDown}
                onValueChange={v => setField('lateRoundDown', v)}
                trackColor={{ false: THEME.border, true: THEME.primary }}
              />
            </View>
          </>
        )}
      </View>

      {/* 调休设置 */}
      <Text style={styles.sectionTitle}>调休设置</Text>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <Text style={styles.label}>启用调休</Text>
          <Switch
            value={form.compOffEnabled}
            onValueChange={v => setField('compOffEnabled', v)}
            trackColor={{ false: THEME.border, true: THEME.primary }}
          />
        </View>
        {form.compOffEnabled && (
          <View style={styles.row}>
            <Text style={styles.label}>调休倍率</Text>
            <TextInput
              style={styles.input}
              value={String(form.compOffRate)}
              onChangeText={v => setField('compOffRate', parseFloat(v) || 0)}
              keyboardType="numeric"
            />
          </View>
        )}
      </View>

      {/* 节假日配置 */}
      <Text style={styles.sectionTitle}>节假日配置</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('Holidays')}
        >
          <Text style={styles.label}>🎯 节假日与调休补班</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.rowValue}>{holidays.length} 个</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 数据管理 */}
      <Text style={styles.sectionTitle}>数据管理</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.row} onPress={async () => {
          try { await exportRecordsAsCSV(records); } catch (e) { Alert.alert('导出失败', String(e)); }
        }}>
          <Text style={styles.label}>📊 导出为 CSV（Excel）</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={async () => {
          try { await exportLedger(records); } catch (e) { Alert.alert('导出失败', String(e)); }
        }}>
          <Text style={styles.label}>📄 导出台账文本</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={async () => {
          try { await exportBackup({ records, settings }); } catch (e) { Alert.alert('导出失败', String(e)); }
        }}>
          <Text style={styles.label}>💾 导出完整备份（JSON）</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={async () => {
          try {
            const result = await importBackup();
            if (result) {
              Alert.alert('导入成功', `已导入 ${result.records.length} 条记录`, [
                { text: '取消', style: 'cancel' },
                { text: '确认导入', onPress: () => {
                  if (result.records) setRecords(result.records);
                  if (result.settings) updateSettings(result.settings as Settings);
                }},
              ]);
            }
          } catch (e) {
            Alert.alert('导入失败', String(e));
          }
        }}>
          <Text style={styles.label}>📥 从备份导入</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.row, styles.rowDanger]} onPress={() => {
          Alert.alert('⚠️ 清空所有数据', '此操作不可恢复，确定清空所有记录和设置？', [
            { text: '取消', style: 'cancel' },
            { text: '确定清空', style: 'destructive', onPress: async () => {
              await clearAllData();
              setRecords([]);
              updateSettings({ ...DEFAULT_SETTINGS });
              Alert.alert('已清空');
            }},
          ]);
        }}>
          <Text style={[styles.label, { color: THEME.danger }]}>🗑️ 清空所有数据</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 协议与政策 */}
      <Text style={styles.sectionTitle}>协议与政策</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('Agreement', { type: 'terms' })}
        >
          <Text style={styles.label}>📜 使用协议</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.row, { borderBottomWidth: 0 }]}
          onPress={() => navigation.navigate('Agreement', { type: 'privacy' })}
        >
          <Text style={styles.label}>🔒 隐私政策</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 操作按钮 */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={handleSave}
          disabled={!dirty}
        >
          <Text style={[styles.btnText, styles.btnPrimaryText]}>
            {dirty ? '保存设置' : '已保存'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleReset}>
          <Text style={[styles.btnText, styles.btnSecondaryText]}>恢复默认</Text>
        </TouchableOpacity>
      </View>
      <View style={{ alignItems: 'center', paddingVertical: 18 }}>
        <Text style={{ fontSize: 12, color: THEME.textMute }}>
          加班记事本 v{APP_VERSION}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  sectionTitle: {
    fontSize: 13, color: THEME.textSub, fontWeight: '500',
    marginTop: 16, marginBottom: 6, paddingHorizontal: 12,
  },
  card: {
    backgroundColor: THEME.card,
    marginHorizontal: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    elevation: 1,
    shadowColor: '#8b5a2b',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.divider,
  },
  label: { flex: 1, fontSize: 14, color: THEME.text },
  subLabel: { fontSize: 12, color: THEME.textMute, marginTop: 2 },
  input: {
    width: 100,
    backgroundColor: THEME.bg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: THEME.text,
    textAlign: 'right',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.divider,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginTop: 20,
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: THEME.primary },
  btnPrimaryText: { color: THEME.accent, fontSize: 15, fontWeight: '600' },
  btnSecondary: { backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border },
  btnSecondaryText: { color: THEME.textSub, fontSize: 15 },
  btnText: { fontSize: 15 },
  chevron: { fontSize: 20, color: THEME.textMute, marginTop: -2 },
  rowDanger: { borderBottomWidth: 0 },
  rowValue: { fontSize: 13, color: THEME.textSub, marginRight: 4 },
  wageDisplay: {
    marginTop: 12, padding: 12, borderRadius: 10,
    backgroundColor: THEME.accent,
  },
  wageDisplayTitle: { fontSize: 13, fontWeight: '600', color: THEME.brown, marginBottom: 8 },
  wageRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 4,
  },
  wageLabel: { fontSize: 13, color: THEME.textSub },
  wageValue: { fontSize: 14, fontWeight: '700', color: THEME.primary },
});
