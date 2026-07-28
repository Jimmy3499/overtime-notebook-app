import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import type { OvertimeRecord } from '../types';
import { OVERTIME_TYPE_INFO, RECORD_TYPE_INFO, THEME } from '../constants';
import { formatDate, formatMoney, formatDuration } from '../utils';

interface Props {
  record: OvertimeRecord;
  onPress?: () => void;
  onLongPress?: () => void;
}

export default function RecordCard({ record, onPress, onLongPress }: Props) {
  const recordType = record.recordType || 'overtime';
  const recordTypeInfo = RECORD_TYPE_INFO[recordType];
  const info = OVERTIME_TYPE_INFO[record.type];
  const isLeave = recordType === 'leave';
  const isLate = recordType === 'late';

  const leftColor = isLeave
    ? recordTypeInfo.color
    : isLate
      ? recordTypeInfo.color
      : info.color;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={[styles.colorBar, { backgroundColor: leftColor }]} />
      <View style={styles.body}>
        <View style={styles.row1}>
          <Text style={styles.date}>{formatDate(record.date)}</Text>
          <View style={[styles.tag, { backgroundColor: leftColor }]}>
            <Text style={styles.tagText}>
              {isLeave || isLate ? recordTypeInfo.shortLabel : info.shortLabel}
            </Text>
          </View>
        </View>

        <View style={styles.row2}>
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>
              {isLate ? '应到' : isLeave ? '开始' : '开始'}
            </Text>
            <Text style={styles.timeValue}>{record.normalOffTime}</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>
              {isLate ? '实到' : isLeave ? '结束' : '结束'}
              {!isLeave && !isLate && record.crossDay ? ' (次日)' : ''}
            </Text>
            <Text style={styles.timeValue}>{record.actualOffTime}</Text>
          </View>
          <View style={styles.durBox}>
            <Text style={styles.durLabel}>时长</Text>
            <Text style={styles.durValue}>{formatDuration(record.durationHours)}</Text>
          </View>
        </View>

        <View style={styles.row3}>
          <Text style={styles.incomeLabel}>
            {isLeave ? '请假时长' : isLate ? '迟到扣款' : '本次收入'}
          </Text>
          <Text style={[
            styles.income,
            isLeave && { color: THEME.text },
            isLate && { color: THEME.danger },
          ]}>
            {isLeave
              ? formatDuration(record.durationHours)
              : isLate
                ? `-${formatMoney(record.deduction || 0)}`
                : formatMoney(record.totalIncome)}
          </Text>
        </View>

        {record.location || record.reason ? (
          <View style={styles.row4}>
            {record.location ? (
              <Text style={styles.meta}>📍 {record.location}</Text>
            ) : null}
            {record.reason ? (
              <Text style={styles.meta} numberOfLines={1}>📝 {record.reason}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: THEME.card,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#8b5a2b',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    overflow: 'hidden',
  },
  colorBar: {
    width: 4,
    backgroundColor: THEME.primary,
  },
  body: {
    flex: 1,
    padding: 12,
  },
  row1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: THEME.primary,
  },
  tagText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  timeBox: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 11,
    color: THEME.textMute,
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text,
  },
  arrow: {
    fontSize: 14,
    color: THEME.textSub,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  durBox: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  durLabel: {
    fontSize: 11,
    color: THEME.textMute,
    marginBottom: 2,
  },
  durValue: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.primary,
  },
  row3: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.divider,
  },
  incomeLabel: {
    fontSize: 12,
    color: THEME.textSub,
  },
  income: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.primary,
  },
  row4: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  meta: {
    fontSize: 12,
    color: THEME.textSub,
    flex: 1,
  },
});
