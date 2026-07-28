import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { useApp } from '../AppContext';
import { OVERTIME_TYPES, OVERTIME_TYPE_INFO, RECORD_TYPE_INFO, THEME } from '../constants';
import { formatMoney, formatDuration, formatMonth, currentMonth, currentYear } from '../utils';
import type { OvertimeType } from '../types';

// 三类加班时长柱状图（纯 View 实现）
function BarChart({ data }: { data: Record<OvertimeType, number> | Record<OvertimeType, { count: number; hours: number; pay: number }> }) {
  const getValue = (t: OvertimeType): number =>
    typeof data[t] === 'number' ? (data[t] as number) : (data[t] as { hours: number }).hours;
  const maxValue = Math.max(...OVERTIME_TYPES.map(t => getValue(t)), 1);
  return (
    <View style={styles.chartContainer}>
      {OVERTIME_TYPES.map(t => {
        const info = OVERTIME_TYPE_INFO[t];
        const hours = getValue(t);
        const heightPct = (hours / maxValue) * 100;
        return (
          <View key={t} style={styles.chartBarWrap}>
            <Text style={styles.chartValue}>{hours.toFixed(1)}h</Text>
            <View style={styles.chartBarTrack}>
              <View
                style={[styles.chartBarFill, {
                  backgroundColor: info.color,
                  height: `${Math.max(heightPct, 2)}%`,
                }]}
              />
            </View>
            <Text style={styles.chartLabel}>{info.shortLabel}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function StatsScreen() {
  const { records } = useApp();
  const [tab, setTab] = useState<'month' | 'year'>('month');

  const months = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => set.add(r.date.slice(0, 7)));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [records]);
  const years = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => set.add(r.date.slice(0, 4)));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [records]);

  const [selMonth, setSelMonth] = useState<string>(currentMonth());
  const [selYear, setSelYear] = useState<string>(currentYear());

  // 月度数据
  const monthData = useMemo(() => {
    const allList = records.filter(r => r.date.startsWith(selMonth));
    const overtimeList = allList.filter(r => (r.recordType || 'overtime') === 'overtime');
    const leaveList = allList.filter(r => r.recordType === 'leave');
    const lateList = allList.filter(r => r.recordType === 'late');

    const byType: Record<OvertimeType, { count: number; hours: number; pay: number }> = {
      weekday: { count: 0, hours: 0, pay: 0 },
      weekend: { count: 0, hours: 0, pay: 0 },
      holiday: { count: 0, hours: 0, pay: 0 },
    };
    overtimeList.forEach(r => {
      byType[r.type].count += 1;
      byType[r.type].hours += r.durationHours;
      byType[r.type].pay += r.pay;
    });

    const totalHours = overtimeList.reduce((s, r) => s + r.durationHours, 0);
    const totalPay = overtimeList.reduce((s, r) => s + r.pay, 0);
    const totalSubsidy = overtimeList.reduce((s, r) => s + r.subsidy, 0);
    const totalIncome = overtimeList.reduce((s, r) => s + r.totalIncome, 0);
    const leaveHours = leaveList.reduce((s, r) => s + r.durationHours, 0);
    const lateHours = lateList.reduce((s, r) => s + r.durationHours, 0);
    const lateDeduction = lateList.reduce((s, r) => s + (r.deduction || 0), 0);
    return {
      list: allList, overtimeList, leaveList, lateList, byType,
      totalHours, totalPay, totalSubsidy, totalIncome,
      leaveCount: leaveList.length, leaveHours,
      lateCount: lateList.length, lateHours, lateDeduction,
      count: allList.length,
    };
  }, [records, selMonth]);

  // 年度数据
  const yearData = useMemo(() => {
    const allList = records.filter(r => r.date.startsWith(selYear));
    const overtimeList = allList.filter(r => (r.recordType || 'overtime') === 'overtime');
    const leaveList = allList.filter(r => r.recordType === 'leave');
    const lateList = allList.filter(r => r.recordType === 'late');

    const byType: Record<OvertimeType, number> = { weekday: 0, weekend: 0, holiday: 0 };
    overtimeList.forEach(r => { byType[r.type] += r.durationHours; });

    const totalHours = overtimeList.reduce((s, r) => s + r.durationHours, 0);
    const totalPay = overtimeList.reduce((s, r) => s + r.pay, 0);
    const totalSubsidy = overtimeList.reduce((s, r) => s + r.subsidy, 0);
    const totalIncome = overtimeList.reduce((s, r) => s + r.totalIncome, 0);
    const leaveHours = leaveList.reduce((s, r) => s + r.durationHours, 0);
    const lateHours = lateList.reduce((s, r) => s + r.durationHours, 0);
    const lateDeduction = lateList.reduce((s, r) => s + (r.deduction || 0), 0);
    return {
      list: allList, overtimeList, leaveList, lateList, byType,
      totalHours, totalPay, totalSubsidy, totalIncome,
      leaveCount: leaveList.length, leaveHours,
      lateCount: lateList.length, lateHours, lateDeduction,
      count: allList.length,
    };
  }, [records, selYear]);

  if (records.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>暂无数据可统计</Text>
        <Text style={styles.emptyHint}>添加加班记录后这里会展示统计</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Tab 切换 */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'month' && styles.tabActive]}
          onPress={() => setTab('month')}
        >
          <Text style={[styles.tabText, tab === 'month' && styles.tabTextActive]}>月度汇总</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'year' && styles.tabActive]}
          onPress={() => setTab('year')}
        >
          <Text style={[styles.tabText, tab === 'year' && styles.tabTextActive]}>年度汇总</Text>
        </TouchableOpacity>
      </View>

      {tab === 'month' ? (
        <>
          {/* 月份选择 */}
          <View style={styles.pickerBar}>
            {months.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.pickerChip, selMonth === m && styles.pickerChipActive]}
                onPress={() => setSelMonth(m)}
              >
                <Text style={[styles.pickerChipText, selMonth === m && styles.pickerChipTextActive]}>
                  {formatMonth(m)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 三类加班时长柱状图 */}
          {monthData.overtimeList.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>三类加班时长对比</Text>
              <BarChart data={monthData.byType} />
            </View>
          ) : null}

          {/* 分类明细 */}
          {monthData.overtimeList.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>加班分类明细</Text>
              {OVERTIME_TYPES.map(t => {
                const info = OVERTIME_TYPE_INFO[t];
                const d = monthData.byType[t];
                if (d.count === 0) return null;
                return (
                  <View key={t} style={styles.statRow}>
                    <View style={[styles.dot, { backgroundColor: info.color }]} />
                    <Text style={styles.statLabel}>{info.label}</Text>
                    <Text style={styles.statCount}>{d.count}次</Text>
                    <Text style={styles.statHours}>{formatDuration(d.hours)}</Text>
                    <Text style={styles.statPay}>{formatMoney(d.pay)}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* 加班总览 */}
          {monthData.overtimeList.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>加班总览 · {formatMonth(selMonth)}</Text>
              <View style={styles.totalRow}>
                <Text style={styles.totalPay}>{formatMoney(monthData.totalIncome)}</Text>
              </View>
              <Text style={styles.totalSub}>
                {monthData.overtimeList.length} 次加班 · 总时长 {formatDuration(monthData.totalHours)}
              </Text>
              <View style={styles.totalDetailRow}>
                <Text style={styles.totalDetail}>加班工资 {formatMoney(monthData.totalPay)}</Text>
                <Text style={styles.totalDetail}>补贴 {formatMoney(monthData.totalSubsidy)}</Text>
              </View>
            </View>
          ) : null}

          {/* 请假统计 */}
          {monthData.leaveCount > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>请假统计</Text>
              <View style={styles.totalRow}>
                <Text style={[styles.totalPay, { color: RECORD_TYPE_INFO.leave.color }]}>
                  {formatDuration(monthData.leaveHours)}
                </Text>
              </View>
              <Text style={styles.totalSub}>
                {monthData.leaveCount} 次请假 · {formatMonth(selMonth)}
              </Text>
            </View>
          ) : null}

          {/* 迟到统计 */}
          {monthData.lateCount > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>迟到统计</Text>
              <View style={styles.totalRow}>
                <Text style={[styles.totalPay, { color: RECORD_TYPE_INFO.late.color }]}>
                  -{formatMoney(monthData.lateDeduction)}
                </Text>
              </View>
              <Text style={styles.totalSub}>
                {monthData.lateCount} 次迟到 · 总时长 {formatDuration(monthData.lateHours)}
              </Text>
            </View>
          ) : null}

          {monthData.count === 0 ? (
            <Text style={styles.emptyInCard}>该月份暂无记录</Text>
          ) : null}
        </>
      ) : (
        <>
          {/* 年份选择 */}
          <View style={styles.pickerBar}>
            {years.map(y => (
              <TouchableOpacity
                key={y}
                style={[styles.pickerChip, selYear === y && styles.pickerChipActive]}
                onPress={() => setSelYear(y)}
              >
                <Text style={[styles.pickerChipText, selYear === y && styles.pickerChipTextActive]}>
                  {y} 年
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 三类时长柱状图 */}
          {yearData.overtimeList.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>全年三类加班时长对比</Text>
              <BarChart data={yearData.byType} />
            </View>
          ) : null}

          {/* 全年加班总览 */}
          {yearData.overtimeList.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{selYear} 年加班总览</Text>
              <View style={styles.totalRow}>
                <Text style={styles.totalPay}>{formatMoney(yearData.totalIncome)}</Text>
              </View>
              <Text style={styles.totalSub}>
                {yearData.overtimeList.length} 次加班 · 总时长 {formatDuration(yearData.totalHours)}
              </Text>
              <View style={styles.totalDetailRow}>
                <Text style={styles.totalDetail}>加班工资 {formatMoney(yearData.totalPay)}</Text>
                <Text style={styles.totalDetail}>补贴 {formatMoney(yearData.totalSubsidy)}</Text>
              </View>
            </View>
          ) : null}

          {/* 请假统计 */}
          {yearData.leaveCount > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>全年请假统计</Text>
              <View style={styles.totalRow}>
                <Text style={[styles.totalPay, { color: RECORD_TYPE_INFO.leave.color }]}>
                  {formatDuration(yearData.leaveHours)}
                </Text>
              </View>
              <Text style={styles.totalSub}>
                {yearData.leaveCount} 次请假 · {selYear} 年
              </Text>
            </View>
          ) : null}

          {/* 迟到统计 */}
          {yearData.lateCount > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>全年迟到统计</Text>
              <View style={styles.totalRow}>
                <Text style={[styles.totalPay, { color: RECORD_TYPE_INFO.late.color }]}>
                  -{formatMoney(yearData.lateDeduction)}
                </Text>
              </View>
              <Text style={styles.totalSub}>
                {yearData.lateCount} 次迟到 · 总时长 {formatDuration(yearData.lateHours)}
              </Text>
            </View>
          ) : null}

          {/* 各月明细 */}
          {yearData.overtimeList.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>逐月加班汇总</Text>
              {(() => {
                const monthMap: Record<string, { count: number; hours: number; pay: number }> = {};
                yearData.overtimeList.forEach(r => {
                  const k = r.date.slice(0, 7);
                  if (!monthMap[k]) monthMap[k] = { count: 0, hours: 0, pay: 0 };
                  monthMap[k].count += 1;
                  monthMap[k].hours += r.durationHours;
                  monthMap[k].pay += r.totalIncome;
                });
                return Object.entries(monthMap)
                  .sort((a, b) => (a[0] < b[0] ? -1 : 1))
                  .map(([m, d]) => (
                    <View key={m} style={styles.monthRow}>
                      <View style={styles.monthHead}>
                        <Text style={styles.monthText}>{formatMonth(m)}</Text>
                        <Text style={styles.monthPay}>{formatMoney(d.pay)}</Text>
                      </View>
                      <Text style={styles.monthSub}>
                        {d.count} 次 · {formatDuration(d.hours)}
                      </Text>
                    </View>
                  ));
              })()}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.bg },
  emptyText: { fontSize: 16, color: THEME.textSub },
  emptyHint: { fontSize: 13, color: THEME.textMute, marginTop: 6 },
  tabBar: {
    flexDirection: 'row', backgroundColor: THEME.card, marginHorizontal: 12, marginTop: 12,
    borderRadius: 12, padding: 4, elevation: 1,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: THEME.primary },
  tabText: { fontSize: 14, color: THEME.textSub },
  tabTextActive: { color: THEME.card, fontWeight: '600' },
  pickerBar: { flexDirection: 'row', paddingHorizontal: 12, marginTop: 10, gap: 8, flexWrap: 'wrap' },
  pickerChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border,
  },
  pickerChipActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  pickerChipText: { fontSize: 13, color: THEME.text },
  pickerChipTextActive: { color: THEME.card, fontWeight: '600' },
  card: {
    backgroundColor: THEME.card, marginHorizontal: 12, marginTop: 12,
    borderRadius: 16, padding: 16, elevation: 1,
  },
  cardTitle: { fontSize: 14, color: THEME.textSub, marginBottom: 12, fontWeight: '500' },
  totalRow: { alignItems: 'center', marginVertical: 6 },
  totalPay: { fontSize: 32, fontWeight: '700', color: THEME.primary },
  totalSub: { textAlign: 'center', fontSize: 13, color: THEME.textSub, marginTop: 2 },
  totalDetailRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.border,
  },
  totalDetail: { fontSize: 12, color: THEME.textSub },
  chartContainer: {
    flexDirection: 'row', justifyContent: 'space-around',
    height: 160, marginTop: 8, paddingHorizontal: 8,
  },
  chartBarWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartValue: { fontSize: 12, color: THEME.text, fontWeight: '600', marginBottom: 4 },
  chartBarTrack: {
    width: 36, height: 110, backgroundColor: THEME.border,
    borderRadius: 8, overflow: 'hidden', justifyContent: 'flex-end',
  },
  chartBarFill: { width: '100%', borderRadius: 8 },
  chartLabel: { fontSize: 12, color: THEME.textSub, marginTop: 6 },
  statRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: THEME.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statLabel: { flex: 1, fontSize: 14, color: THEME.text },
  statCount: { width: 50, fontSize: 13, color: THEME.textSub, textAlign: 'right' },
  statHours: { width: 80, fontSize: 13, color: THEME.text, textAlign: 'right' },
  statPay: { width: 80, fontSize: 13, color: THEME.brown, fontWeight: '600', textAlign: 'right' },
  emptyInCard: { fontSize: 13, color: THEME.textMute, textAlign: 'center', paddingVertical: 20 },
  monthRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: THEME.border },
  monthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monthText: { fontSize: 15, fontWeight: '600', color: THEME.text },
  monthPay: { fontSize: 15, fontWeight: '700', color: THEME.brown },
  monthSub: { fontSize: 12, color: THEME.textMute, marginTop: 4 },
});
