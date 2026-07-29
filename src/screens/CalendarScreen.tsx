import React, { useMemo, useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList, Modal, Pressable, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../AppContext';
import { THEME, OVERTIME_TYPE_INFO, RECORD_TYPE_INFO } from '../constants';
import {
  monthRange, dateListOfMonth, formatDate, formatDuration, formatMoney,
  dayOfWeek,
} from '../utils';
import RecordCard from '../components/RecordCard';
import type { OvertimeRecord } from '../types';

export default function CalendarScreen() {
  const navigation = useNavigation<any>();
  const { records, holidays, markedDates, toggleMarkedDate } = useApp();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const { days } = monthRange(year, month);
  const dates = dateListOfMonth(year, month);
  const firstDayOfWeek = dayOfWeek(dates[0]);

  // 按日期分组记录
  const recordsByDate = useMemo(() => {
    const map: Record<string, OvertimeRecord[]> = {};
    records.forEach(r => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    });
    return map;
  }, [records]);

  // 节假日/补班
  const holidayMap = useMemo(() => {
    const map: Record<string, { type: string; name: string }> = {};
    holidays.forEach(h => { map[h.date] = h; });
    return map;
  }, [holidays]);

  // 当天是否有记录
  const getDateInfo = (dateStr: string) => {
    const dayRecords = recordsByDate[dateStr] || [];
    const hasOvertime = dayRecords.some(r => (r.recordType || 'overtime') === 'overtime');
    const hasLeave = dayRecords.some(r => r.recordType === 'leave');
    const hasLate = dayRecords.some(r => r.recordType === 'late');
    const holiday = holidayMap[dateStr];
    const isWeekend = dayOfWeek(dateStr) === 0 || dayOfWeek(dateStr) === 6;

    // 主标记颜色（优先显示）
    let markColor = null;
    if (hasOvertime) {
      const types = dayRecords.filter(r => (r.recordType || 'overtime') === 'overtime').map(r => r.type);
      if (types.includes('holiday')) markColor = OVERTIME_TYPE_INFO.holiday.color;
      else if (types.includes('weekend')) markColor = OVERTIME_TYPE_INFO.weekend.color;
      else markColor = OVERTIME_TYPE_INFO.weekday.color;
    }

    // 灰色标记：普通工作日（非周末、非假期、非调休补班、无加班记录）
    return { hasOvertime, hasLeave, hasLate, holiday, isWeekend, markColor, dayRecords };
  };

  const selectedRecords = selectedDate ? recordsByDate[selectedDate] || [] : [];

  // 切换月份
  const goPrevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };
  const goNextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  // 年月选择器用：生成可选年份范围（前后各扩展几年）
  const pickerYears = useMemo(() => {
    const currentYear = now.getFullYear();
    const years: number[] = [];
    for (let y = currentYear - 5; y <= currentYear + 10; y++) years.push(y);
    return years;
  }, []);
  const pickerMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // 生成日历格子数组（前面补空白）
  const cells = useMemo(() => {
    const arr: (string | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) arr.push(null);
    arr.push(...dates);
    // 补全最后一行
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [dates, firstDayOfWeek]);

  const renderDayCell = (dateStr: string | null) => {
    if (!dateStr) return <View style={styles.dayCell} />;

    const info = getDateInfo(dateStr);
    const dayNum = parseInt(dateStr.split('-')[2], 10);
    const isToday = dateStr === new Date().toISOString().slice(0, 10);
    const isSelected = dateStr === selectedDate;
    const isMarked = markedDates.includes(dateStr);

    let textColor = THEME.text;
    if (info.isWeekend) textColor = THEME.textSub;
    if (info.holiday?.type === 'holiday') textColor = '#ef4444';
    if (info.holiday?.type === 'makeup') textColor = '#f59e0b';

    return (
      <TouchableOpacity
        style={[styles.dayCell, isMarked && styles.dayMarked, isSelected && styles.daySelected]}
        onPress={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
        onLongPress={() => toggleMarkedDate(dateStr)}
        activeOpacity={0.7}
      >
        {isToday ? (
          <View style={styles.todayCircle}>
            <Text style={[styles.dayText, { color: '#fff' }]}>{dayNum}</Text>
          </View>
        ) : (
          <Text style={[styles.dayText, { color: textColor }]}>{dayNum}</Text>
        )}

        {/* 记录标记区（右上角） */}
        <View style={styles.markContainer}>
          {info.hasOvertime && <View style={[styles.markDot, { backgroundColor: info.markColor }]} />}
          {info.hasLeave && <View style={[styles.markSquare, { backgroundColor: RECORD_TYPE_INFO.leave.color }]} />}
          {info.hasLate && <View style={[styles.markTriangle, { borderBottomColor: RECORD_TYPE_INFO.late.color }]} />}
        </View>

        {/* 节日名称 */}
        {info.holiday ? (
          <Text style={styles.holidayText} numberOfLines={1}>{info.holiday.name}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* 月份选择 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goPrevMonth}>
          <Text style={styles.navBtn}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMonthPicker(true)} activeOpacity={0.7}>
          <Text style={styles.monthTitle}>{year}年{month}月</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goNextMonth}>
          <Text style={styles.navBtn}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 年月选择器弹窗 */}
      <Modal
        transparent
        visible={showMonthPicker}
        onRequestClose={() => setShowMonthPicker(false)}
        animationType="fade"
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setShowMonthPicker(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>选择年月</Text>

            {/* 年份选择 */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearScroll}>
              {pickerYears.map(y => (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearChip, y === year && styles.yearChipActive]}
                  onPress={() => setYear(y)}
                >
                  <Text style={[styles.yearChipText, y === year && styles.yearChipTextActive]}>
                    {y}年
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 月份网格 */}
            <View style={styles.monthGrid}>
              {pickerMonths.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.monthChip, m === month && styles.monthChipActive]}
                  onPress={() => { setMonth(m); setShowMonthPicker(false); }}
                >
                  <Text style={[styles.monthChipText, m === month && styles.monthChipTextActive]}>
                    {m}月
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 快捷跳转 */}
            <View style={styles.quickJumpRow}>
              <TouchableOpacity
                style={styles.quickJumpBtn}
                onPress={() => {
                  const n = new Date();
                  setYear(n.getFullYear());
                  setMonth(n.getMonth() + 1);
                  setShowMonthPicker(false);
                }}
              >
                <Text style={styles.quickJumpBtnText}>📍 今天</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickJumpBtn}
                onPress={() => setShowMonthPicker(false)}
              >
                <Text style={styles.quickJumpBtnText}>取消</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 星期表头 */}
      <View style={styles.weekRow}>
        {weekDays.map((d, i) => (
          <Text key={i} style={[
            styles.weekText,
            i === 0 || i === 6 ? { color: THEME.textSub } : null,
          ]}>{d}</Text>
        ))}
      </View>

      {/* 日历网格 */}
      <View style={styles.calendar}>
        {cells.map((dateStr, idx) => (
          <View key={idx} style={styles.cellWrap}>
            {renderDayCell(dateStr)}
          </View>
        ))}
      </View>

      {/* 图例 */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.markDot, { backgroundColor: OVERTIME_TYPE_INFO.weekday.color }]} />
          <Text style={styles.legendText}>加班</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.markSquare, { backgroundColor: RECORD_TYPE_INFO.leave.color }]} />
          <Text style={styles.legendText}>请假</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.markTriangle, { borderBottomColor: RECORD_TYPE_INFO.late.color }]} />
          <Text style={styles.legendText}>迟到</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.markSquare, { backgroundColor: '#e5e7eb' }]} />
          <Text style={styles.legendText}>标记</Text>
        </View>
      </View>

      {/* 选中日期的记录列表 */}
      {selectedDate ? (
        <View style={styles.listContainer}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              {formatDate(selectedDate)} · 共{selectedRecords.length}条
            </Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => navigation.navigate('AddRecord', { initialDate: selectedDate })}
            >
              <Text style={styles.addBtnText}>+ 添加</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={selectedRecords}
            keyExtractor={r => r.id}
            renderItem={({ item }) => (
              <RecordCard
                record={item}
                onPress={() => navigation.navigate('AddRecord', { record: item })}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyText}>当天没有记录</Text>
                <TouchableOpacity
                  style={styles.emptyAddBtn}
                  onPress={() => navigation.navigate('AddRecord', { initialDate: selectedDate })}
                >
                  <Text style={styles.emptyAddBtnText}>+ 写一条加班/请假/迟到</Text>
                </TouchableOpacity>
              </View>
            }
            contentContainerStyle={styles.listContent}
          />
        </View>
      ) : (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>点击日期查看记录 · 长按日期标记/取消灰色块</Text>
        </View>
      )}

      {/* 悬浮添加按钮 */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddRecord', { initialDate: selectedDate || undefined })}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: THEME.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.border,
  },
  monthTitle: { fontSize: 17, fontWeight: '600', color: THEME.text },
  navBtn: { fontSize: 28, color: THEME.primary, paddingHorizontal: 8, marginTop: -2 },
  weekRow: {
    flexDirection: 'row', paddingVertical: 6,
    backgroundColor: THEME.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.divider,
  },
  weekText: { flex: 1, textAlign: 'center', fontSize: 12, color: THEME.textSub },
  calendar: {
    flexDirection: 'row', flexWrap: 'wrap',
    backgroundColor: THEME.card,
    paddingBottom: 8,
  },
  cellWrap: { width: '14.2857%', paddingHorizontal: 2, paddingVertical: 2 },
  dayCell: {
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  dayMarked: {
    backgroundColor: '#e5e7eb',
  },
  daySelected: {
    borderWidth: 2,
    borderColor: THEME.primary,
  },
  todayCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: THEME.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  dayText: { fontSize: 14, color: THEME.text },
  holidayText: {
    fontSize: 9, color: '#ef4444', marginTop: 1,
    maxWidth: '100%',
  },
  markContainer: {
    position: 'absolute',
    top: 2,
    right: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  markDot: {
    width: 5, height: 5, borderRadius: 2.5,
  },
  markSquare: {
    width: 5, height: 5,
    borderRadius: 1,
  },
  markTriangle: {
    width: 0, height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderBottomWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
    backgroundColor: THEME.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.divider,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendText: { fontSize: 11, color: THEME.textSub },
  listContainer: {
    flex: 1,
    backgroundColor: THEME.bg,
    padding: 12,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listTitle: { fontSize: 14, fontWeight: '600', color: THEME.text },
  addBtn: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addBtnText: { color: THEME.accent, fontSize: 12, fontWeight: '500' },
  listContent: { paddingBottom: 20 },
  emptyText: {
    textAlign: 'center', color: THEME.textSub, fontSize: 13, marginTop: 20,
  },
  emptyList: { alignItems: 'center', marginTop: 30 },
  emptyAddBtn: {
    marginTop: 16, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, backgroundColor: THEME.primary,
  },
  emptyAddBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  hintContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hintText: { fontSize: 14, color: THEME.textMute },
  fab: {
    position: 'absolute', right: 22, bottom: 28, width: 60, height: 60,
    borderRadius: 30, backgroundColor: THEME.primary,
    alignItems: 'center', justifyContent: 'center', elevation: 6,
    shadowColor: '#1e3a5f', shadowOpacity: 0.35, shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  fabText: { color: '#fff', fontSize: 32, fontWeight: '300', marginTop: -2 },
  // 年月选择器
  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  pickerCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 20,
    width: '85%',
    maxWidth: 340,
  },
  pickerTitle: {
    fontSize: 17, fontWeight: '600', color: THEME.text,
    textAlign: 'center', marginBottom: 16,
  },
  yearScroll: {
    flexDirection: 'row', gap: 8, paddingBottom: 12,
  },
  yearChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: THEME.bg, borderRadius: 16,
    borderWidth: 1, borderColor: THEME.border,
  },
  yearChipActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  yearChipText: { fontSize: 13, color: THEME.textSub, fontWeight: '500' },
  yearChipTextActive: { color: '#fff' },
  monthGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginTop: 4,
  },
  monthChip: {
    width: '22%', aspectRatio: 1.4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: THEME.bg, borderRadius: 12,
    borderWidth: 1, borderColor: THEME.border,
  },
  monthChipActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  monthChipText: { fontSize: 14, color: THEME.textSub, fontWeight: '500' },
  monthChipTextActive: { color: '#fff', fontWeight: '700' },
  quickJumpRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 16,
    marginTop: 16, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.border,
  },
  quickJumpBtn: {
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 10, backgroundColor: THEME.bg,
  },
  quickJumpBtnText: { fontSize: 14, color: THEME.textSub, fontWeight: '500' },
});
