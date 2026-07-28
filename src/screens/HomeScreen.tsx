import React, { useMemo, useState } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, Alert, Modal, Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../AppContext';
import RecordCard from '../components/RecordCard';
import { OVERTIME_TYPES, OVERTIME_TYPE_INFO, RECORD_TYPES, RECORD_TYPE_INFO, THEME } from '../constants';
import { formatMoney, formatDuration, formatMonth } from '../utils';
import type { OvertimeRecord, OvertimeType, RecordType } from '../types';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { records, deleteRecord, duplicateRecord } = useApp();
  const [filterMonth, setFilterMonth] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<OvertimeType | null>(null);
  const [filterRecordType, setFilterRecordType] = useState<RecordType | null>(null);
  const [actionRecord, setActionRecord] = useState<OvertimeRecord | null>(null);

  // 月份列表
  const months = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => set.add(r.date.slice(0, 7)));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [records]);

  const visibleRecords = useMemo(() => {
    return records.filter(r => {
      if (filterMonth && !r.date.startsWith(filterMonth)) return false;
      if (filterType && r.type !== filterType) return false;
      if (filterRecordType) {
        const rt = r.recordType || 'overtime';
        if (rt !== filterRecordType) return false;
      }
      return true;
    });
  }, [records, filterMonth, filterType, filterRecordType]);

  // 当前可见记录合计
  const summary = useMemo(() => {
    const hours = visibleRecords.reduce((s, r) => s + r.durationHours, 0);
    const pay = visibleRecords.reduce((s, r) => s + r.pay, 0);
    const subsidy = visibleRecords.reduce((s, r) => s + r.subsidy, 0);
    const income = visibleRecords.reduce((s, r) => s + r.totalIncome, 0);
    return { hours, pay, subsidy, income, count: visibleRecords.length };
  }, [visibleRecords]);

  const handleDelete = (rec: OvertimeRecord) => {
    setActionRecord(null);
    Alert.alert('删除记录', `确定删除 ${rec.date} 的记录？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => deleteRecord(rec.id) },
    ]);
  };

  const handleDuplicate = (rec: OvertimeRecord) => {
    setActionRecord(null);
    duplicateRecord(rec.id);
    Alert.alert('已复制', '已基于该记录新建一条今日记录');
  };

  const renderItem = ({ item }: { item: OvertimeRecord }) => (
    <RecordCard
      record={item}
      onPress={() => navigation.navigate('AddRecord', { record: item })}
      onLongPress={() => setActionRecord(item)}
    />
  );

  return (
    <View style={styles.container}>
      {/* 记录类型筛选 */}
      <View style={styles.recordTypeBar}>
        <TouchableOpacity
          style={[styles.chip, !filterRecordType && styles.chipActive]}
          onPress={() => setFilterRecordType(null)}
        >
          <Text style={[styles.chipText, !filterRecordType && styles.chipTextActive]}>全部记录</Text>
        </TouchableOpacity>
        {RECORD_TYPES.map(rt => {
          const info = RECORD_TYPE_INFO[rt];
          const active = filterRecordType === rt;
          return (
            <TouchableOpacity
              key={rt}
              style={[styles.chip, active && { backgroundColor: info.color, borderColor: info.color }]}
              onPress={() => setFilterRecordType(active ? null : rt)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {info.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 月份筛选 */}
      <View style={styles.monthBar}>
        <TouchableOpacity
          style={[styles.chip, !filterMonth && styles.chipActive]}
          onPress={() => setFilterMonth(null)}
        >
          <Text style={[styles.chipText, !filterMonth && styles.chipTextActive]}>全部月份</Text>
        </TouchableOpacity>
        {months.map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.chip, filterMonth === m && styles.chipActive]}
            onPress={() => setFilterMonth(m)}
          >
            <Text style={[styles.chipText, filterMonth === m && styles.chipTextActive]}>
              {formatMonth(m)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 类型筛选 */}
      <View style={styles.typeBar}>
        <TouchableOpacity
          style={[styles.chip, !filterType && styles.chipActive]}
          onPress={() => setFilterType(null)}
        >
          <Text style={[styles.chipText, !filterType && styles.chipTextActive]}>全部类型</Text>
        </TouchableOpacity>
        {OVERTIME_TYPES.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, filterType === t && { backgroundColor: OVERTIME_TYPE_INFO[t].color, borderColor: OVERTIME_TYPE_INFO[t].color }]}
            onPress={() => setFilterType(filterType === t ? null : t)}
          >
            <Text style={[styles.chipText, filterType === t && styles.chipTextActive]}>
              {OVERTIME_TYPE_INFO[t].shortLabel}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 合计卡片 */}
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.count}</Text>
            <Text style={styles.summaryLabel}>次数</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatDuration(summary.hours)}</Text>
            <Text style={styles.summaryLabel}>时长</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#ef4444' }]}>{formatMoney(summary.income)}</Text>
            <Text style={styles.summaryLabel}>总收入</Text>
          </View>
        </View>
        {summary.subsidy > 0 ? (
          <Text style={styles.summarySub}>含补贴 {formatMoney(summary.subsidy)} · 加班工资 {formatMoney(summary.pay)}</Text>
        ) : null}
      </View>

      {/* 列表 */}
      <FlatList
        data={visibleRecords}
        keyExtractor={r => r.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>还没有记录</Text>
            <Text style={styles.emptyHint}>点击右下角 + 添加第一条</Text>
            <Text style={styles.emptyHint2}>长按记录可复制/删除</Text>
          </View>
        }
      />

      {/* 添加按钮 */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddRecord', {})}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* 长按操作弹窗 */}
      <Modal
        transparent
        visible={!!actionRecord}
        onRequestClose={() => setActionRecord(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setActionRecord(null)}>
          <Pressable style={styles.actionSheet} onPress={() => {}}>
            <Text style={styles.actionTitle}>
              {actionRecord ? `${actionRecord.date} 操作` : ''}
            </Text>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => actionRecord && handleDuplicate(actionRecord)}
            >
              <Text style={styles.actionItemText}>📋 复制新建（基于此记录新建今日）</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => actionRecord && navigation.navigate('AddRecord', { record: actionRecord }) || setActionRecord(null)}
            >
              <Text style={styles.actionItemText}>✏️ 编辑</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionItem, styles.actionDanger]}
              onPress={() => actionRecord && handleDelete(actionRecord)}
            >
              <Text style={[styles.actionItemText, { color: '#ef4444' }]}>🗑️ 删除</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionItem, styles.actionCancel]}
              onPress={() => setActionRecord(null)}
            >
              <Text style={styles.actionCancelText}>取消</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  recordTypeBar: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  monthBar: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  typeBar: {
    flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 8,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border,
  },
  chipActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  chipText: { fontSize: 13, color: THEME.textSub },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  summary: {
    backgroundColor: THEME.card, marginHorizontal: 12, marginBottom: 8,
    padding: 18, borderRadius: 16, elevation: 2,
    shadowColor: '#8b5a2b', shadowOpacity: 0.08, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 30, backgroundColor: THEME.border },
  summaryValue: { fontSize: 17, fontWeight: '700', color: THEME.text },
  summaryLabel: { fontSize: 12, color: THEME.textSub, marginTop: 4 },
  summarySub: { fontSize: 12, color: THEME.textSub, textAlign: 'center', marginTop: 10 },
  list: { paddingHorizontal: 12, paddingBottom: 90, paddingTop: 4 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 16, color: THEME.textSub },
  emptyHint: { fontSize: 13, color: THEME.textMute, marginTop: 6 },
  emptyHint2: { fontSize: 12, color: THEME.textMute, marginTop: 12 },
  fab: {
    position: 'absolute', right: 22, bottom: 28, width: 64, height: 64,
    borderRadius: 32, backgroundColor: THEME.primary,
    alignItems: 'center', justifyContent: 'center', elevation: 6,
    shadowColor: '#1e3a5f', shadowOpacity: 0.35, shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  fabText: { color: THEME.accent, fontSize: 36, fontWeight: '300', marginTop: -2 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: THEME.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 24, paddingHorizontal: 12,
  },
  actionTitle: {
    fontSize: 14, color: THEME.textSub, textAlign: 'center',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.border,
  },
  actionItem: { paddingVertical: 16, paddingHorizontal: 16 },
  actionItemText: { fontSize: 15, color: THEME.text },
  actionDanger: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: THEME.border },
  actionCancel: { marginTop: 8, backgroundColor: THEME.bg, borderRadius: 12 },
  actionCancelText: { fontSize: 15, color: THEME.textSub, textAlign: 'center' },
});
