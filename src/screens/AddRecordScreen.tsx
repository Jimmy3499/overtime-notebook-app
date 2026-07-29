import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, Switch, Alert, Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '../AppContext';
import { OVERTIME_TYPES, OVERTIME_TYPE_INFO, RECORD_TYPES, RECORD_TYPE_INFO, THEME } from '../constants';
import {
  todayStr, nowTimeStr, formatMoney, formatDuration,
  calcRawDurationHours, calcEffectiveDuration, calcPay, calcTotalIncome,
  calcLateDurationHours, calcLateDeduction, calcEndTimeFromDuration,
  timeToMinutes, minutesToTime,
} from '../utils';
import type { OvertimeType, RecordType } from '../types';

export default function AddRecordScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { addRecord, updateRecord, settings, detectType } = useApp();
  const editing = route.params?.record;

  const [recordType, setRecordType] = useState<RecordType>(editing?.recordType || 'overtime');
  const [date, setDate] = useState(editing?.date || route.params?.initialDate || todayStr());
  const [type, setType] = useState<OvertimeType>(editing?.type || 'weekday');
  const [normalOffTime, setNormalOffTime] = useState(editing?.normalOffTime || '18:00');
  const [actualOffTime, setActualOffTime] = useState(editing?.actualOffTime || '20:00');
  const [crossDay, setCrossDay] = useState(editing?.crossDay || false);
  const [reason, setReason] = useState(editing?.reason || '');
  const [subsidy, setSubsidy] = useState<string>(String(editing?.subsidy || 0));
  const [useCompOff, setUseCompOff] = useState(editing?.useCompOff || false);
  const [location, setLocation] = useState(editing?.location || '');
  const [durationHours, setDurationHours] = useState<string>(
    editing?.manualDuration > 0 ? String(editing.manualDuration) : '',
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const isLeave = recordType === 'leave';
  const isLate = recordType === 'late';

  // 根据日期自动判断类型
  useEffect(() => {
    if (!editing) {
      const detected = detectType(date);
      setType(detected);
    }
  }, [date, editing, detectType]);

  // 记录类型变化时，初始化默认时间
  useEffect(() => {
    if (editing) return;
    const isWeekend = detectType(date) !== 'weekday';
    if (isLate) {
      // 迟到：应到时间=默认上班时间，实到时间=此刻
      const workStart = isWeekend ? settings.weekendWorkStartTime : settings.weekdayWorkStartTime;
      setNormalOffTime(workStart);
      setActualOffTime(nowTimeStr(true));
      setDurationHours('');
    } else if (isLeave) {
      // 请假：开始=默认上班时间，结束=默认下班时间（早8晚6 = 10小时？不对，一般8小时）
      const workStart = isWeekend ? settings.weekendWorkStartTime : settings.weekdayWorkStartTime;
      const workEnd = isWeekend ? '18:00' : '18:00';
      setNormalOffTime(workStart);
      setActualOffTime(workEnd);
      setDurationHours('');
    } else {
      // 加班：开始=默认加班开始时间，结束=此刻或2小时后
      const start = isWeekend ? settings.weekendStartTime : settings.weekdayStartTime;
      setNormalOffTime(start);
      const now = timeToMinutes(nowTimeStr(true));
      const startM = timeToMinutes(start);
      if (now > startM) {
        setActualOffTime(minutesToTime(now));
      } else {
        setActualOffTime(minutesToTime(startM + 120));
      }
      setDurationHours('');
    }
    setCrossDay(false);
  }, [recordType, date, editing, settings, detectType]);

  // 计算预览值
  const preview = useMemo(() => {
    const durVal = parseFloat(durationHours);
    const hasManualDuration = !isNaN(durVal) && durVal > 0;

    if (isLate) {
      const rawLate = calcLateDurationHours(normalOffTime, actualOffTime);
      const deduction = calcLateDeduction(rawLate, settings);
      return {
        rawHours: rawLate,
        effectiveHours: rawLate,
        pay: 0,
        totalIncome: 0,
        deduction,
        netIncome: -deduction,
        hasManualDuration,
      };
    }

    let rawHours: number;
    if (hasManualDuration) {
      rawHours = durVal;
    } else {
      rawHours = calcRawDurationHours(normalOffTime, actualOffTime, crossDay);
    }
    const effective = isLeave
      ? rawHours
      : calcEffectiveDuration(rawHours, settings, type);
    const pay = isLeave ? 0 : calcPay(effective, type, settings);
    const sub = parseFloat(subsidy) || 0;
    const totalIncome = calcTotalIncome(pay, sub);
    return {
      rawHours,
      effectiveHours: effective,
      pay,
      totalIncome,
      deduction: 0,
      netIncome: totalIncome,
      hasManualDuration,
    };
  }, [recordType, normalOffTime, actualOffTime, crossDay, durationHours, type, subsidy, isLeave, isLate, settings]);

  // 时长变化 → 推算结束时间
  const onDurationChange = (text: string) => {
    const num = parseFloat(text);
    setDurationHours(text);
    if (!isNaN(num) && num > 0 && !isLate) {
      // 加班/请假：根据开始时间和时长推算结束时间
      const end = calcEndTimeFromDuration(normalOffTime, num);
      setActualOffTime(end);
      // 判断是否跨天
      const startM = timeToMinutes(normalOffTime);
      const endM = timeToMinutes(end);
      setCrossDay(endM <= startM);
    }
  };

  // 时间变化 → 如果手动时长有值，重新推算时长
  const onStartTimeChange = (time: string) => {
    setNormalOffTime(time);
    const durVal = parseFloat(durationHours);
    if (!isNaN(durVal) && durVal > 0 && !isLate) {
      const end = calcEndTimeFromDuration(time, durVal);
      setActualOffTime(end);
      const startM = timeToMinutes(time);
      const endM = timeToMinutes(end);
      setCrossDay(endM <= startM);
    }
  };

  const onEndTimeChange = (time: string) => {
    setActualOffTime(time);
    // 清空手动时长，因为用户手动改了结束时间
    if (durationHours) setDurationHours('');
  };

  // 此刻按钮
  const setNow = (which: 'start' | 'end') => {
    const now = nowTimeStr(true);
    if (which === 'start') {
      onStartTimeChange(now);
    } else {
      onEndTimeChange(now);
    }
  };

  const handleSave = () => {
    const durVal = parseFloat(durationHours) || 0;
    const subVal = parseFloat(subsidy) || 0;

    if (isLate) {
      const lateHours = calcLateDurationHours(normalOffTime, actualOffTime);
      if (lateHours <= 0) {
        Alert.alert('提示', '实到时间不能早于或等于应到时间');
        return;
      }
    } else if (durVal <= 0 && calcRawDurationHours(normalOffTime, actualOffTime, crossDay) <= 0) {
      Alert.alert('提示', '请设置有效的时长或起止时间');
      return;
    }

    const input = {
      date,
      normalOffTime,
      actualOffTime,
      crossDay,
      type,
      reason,
      recordType,
      manualDuration: durVal,
      useCompOff,
      subsidy: subVal,
      location,
    };

    if (editing) {
      updateRecord(editing.id, input);
    } else {
      addRecord(input);
    }
    navigation.goBack();
  };

  // 时间选择器
  const renderTimePicker = (show: boolean, value: string, onChange: (t: string) => void, onClose: () => void) => (
    show ? (
      <DateTimePicker
        value={(function () {
          const [h, m] = value.split(':').map(Number);
          const d = new Date();
          d.setHours(h, m, 0, 0);
          return d;
        })()}
        mode="time"
        is24Hour
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={(_, date) => {
          if (Platform.OS === 'android') onClose();
          if (date) {
            const t = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            onChange(t);
          }
        }}
      />
    ) : null
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 记录类型选择 */}
        <Text style={styles.sectionTitle}>记录类型</Text>
        <View style={styles.recordTypeRow}>
          {RECORD_TYPES.map(rt => {
            const info = RECORD_TYPE_INFO[rt];
            const active = recordType === rt;
            return (
              <TouchableOpacity
                key={rt}
                style={[
                  styles.recordTypeBtn,
                  active && { backgroundColor: info.color, borderColor: info.color },
                ]}
                onPress={() => setRecordType(rt)}
              >
                <Text style={styles.recordTypeIcon}>{info.icon}</Text>
                <Text style={[styles.recordTypeBtnText, active && { color: '#fff' }]}>
                  {info.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 日期 */}
        <Text style={styles.sectionTitle}>日期</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.label}>日期</Text>
            <Text style={styles.valueText}>{date}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={new Date(date + 'T00:00:00')}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, d) => {
                if (Platform.OS === 'android') setShowDatePicker(false);
                if (d) {
                  setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                }
              }}
            />
          )}
        </View>

        {/* 类型（加班时显示加班类型；请假/迟到时显示工作日/周末/节假日类型） */}
        <Text style={styles.sectionTitle}>{isLate ? '日期类型' : isLeave ? '请假类型' : '加班类型'}</Text>
        <View style={styles.typeRow}>
          {OVERTIME_TYPES.map(t => {
            const info = OVERTIME_TYPE_INFO[t];
            const active = type === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, active && { backgroundColor: info.color, borderColor: info.color }]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.typeBtnText, active && { color: '#fff' }]}>
                  {info.shortLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 时间设置 */}
        <Text style={styles.sectionTitle}>
          {isLate ? '迟到时间' : isLeave ? '请假时间' : '加班时间'}
        </Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>{isLate ? '应到时间' : isLeave ? '开始时间' : '开始时间'}</Text>
            <View style={styles.timeRow}>
              <TouchableOpacity style={styles.timeBtn} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.timeText}>{normalOffTime}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nowBtn} onPress={() => setNow('start')}>
                <Text style={styles.nowBtnText}>此刻</Text>
              </TouchableOpacity>
            </View>
          </View>
          {renderTimePicker(showStartPicker, normalOffTime, onStartTimeChange, () => setShowStartPicker(false))}

          <View style={styles.row}>
            <Text style={styles.label}>{isLate ? '实到时间' : isLeave ? '结束时间' : '结束时间'}</Text>
            <View style={styles.timeRow}>
              <TouchableOpacity style={styles.timeBtn} onPress={() => setShowEndPicker(true)}>
                <Text style={styles.timeText}>{actualOffTime}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nowBtn} onPress={() => setNow('end')}>
                <Text style={styles.nowBtnText}>此刻</Text>
              </TouchableOpacity>
            </View>
          </View>
          {renderTimePicker(showEndPicker, actualOffTime, onEndTimeChange, () => setShowEndPicker(false))}

          {!isLate && (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>跨天（次日结束）</Text>
              <Switch
                value={crossDay}
                onValueChange={setCrossDay}
                trackColor={{ false: THEME.border, true: THEME.primary }}
              />
            </View>
          )}
        </View>

        {/* 时长直接输入 */}
        <Text style={styles.sectionTitle}>时长设置</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                {isLate ? '迟到时长（小时）' : isLeave ? '请假时长（小时）' : '加班时长（小时）'}
              </Text>
              <Text style={styles.subLabel}>
                填写后自动推算{isLate ? '实到' : '结束'}时间；留空则按起止时间计算
              </Text>
            </View>
            <TextInput
              style={[styles.input, { width: 100, textAlign: 'center' }]}
              value={durationHours}
              onChangeText={onDurationChange}
              placeholder="例如: 2.5"
              placeholderTextColor={THEME.textMute}
              keyboardType="numeric"
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickDurRow}>
            {Array.from({ length: 48 }, (_, i) => (i + 1) * 0.5).map(h => (
              <TouchableOpacity
                key={h}
                style={[styles.quickDurBtn, parseFloat(durationHours) === h && styles.quickDurBtnActive]}
                onPress={() => onDurationChange(String(h))}
              >
                <Text style={[styles.quickDurText, parseFloat(durationHours) === h && styles.quickDurTextActive]}>
                  {h % 1 === 0 ? `${h}` : `${h}`}小时
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 实时预览 */}
        <Text style={styles.sectionTitle}>实时预览</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>原始时长</Text>
            <Text style={styles.valueText}>{formatDuration(preview.rawHours)}</Text>
          </View>
          {!isLeave && !isLate && (
            <View style={styles.row}>
              <Text style={styles.label}>有效时长（扣休息后）</Text>
              <Text style={[styles.valueText, { color: THEME.primary }]}>
                {formatDuration(preview.effectiveHours)}
              </Text>
            </View>
          )}
          {isLate ? (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>迟到时长</Text>
                <Text style={[styles.valueText, { color: THEME.danger }]}>
                  {formatDuration(preview.effectiveHours)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>扣款金额</Text>
                <Text style={[styles.valueText, { color: THEME.danger, fontWeight: '700' }]}>
                  -{formatMoney(preview.deduction)}
                </Text>
              </View>
            </>
          ) : isLeave ? (
            <View style={styles.row}>
              <Text style={styles.label}>请假时长</Text>
              <Text style={[styles.valueText, { color: THEME.primary }]}>
                {formatDuration(preview.effectiveHours)}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>加班工资</Text>
                <Text style={styles.valueText}>{formatMoney(preview.pay)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>补贴</Text>
                <Text style={styles.valueText}>{formatMoney(parseFloat(subsidy) || 0)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={[styles.label, { fontWeight: '600' }]}>合计收入</Text>
                <Text style={[styles.valueText, { color: THEME.primary, fontWeight: '700', fontSize: 18 }]}>
                  {formatMoney(preview.totalIncome)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* 补贴（仅加班） */}
        {!isLeave && !isLate && (
          <>
            <Text style={styles.sectionTitle}>补贴/交通</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>补贴金额（元）</Text>
                <TextInput
                  style={[styles.input, { width: 120 }]}
                  value={subsidy}
                  onChangeText={setSubsidy}
                  placeholder="0"
                  placeholderTextColor={THEME.textMute}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </>
        )}

        {/* 地点 */}
        <Text style={styles.sectionTitle}>地点 / 事由</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>{isLate ? '备注' : '地点'}</Text>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={location}
              onChangeText={setLocation}
              placeholder={isLate ? '迟到原因等' : '例如：公司'}
              placeholderTextColor={THEME.textMute}
            />
          </View>
          <View style={[styles.row, { alignItems: 'flex-start' }]}>
            <Text style={[styles.label, { flex: 0, width: 70 }]}>事由/备注</Text>
            <TextInput
              style={[styles.input, styles.textArea, { flex: 1 }]}
              value={reason}
              onChangeText={setReason}
              placeholder="选填"
              placeholderTextColor={THEME.textMute}
              multiline
            />
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* 底部保存按钮 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{editing ? '保存修改' : '保存'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  scroll: { padding: 12, paddingBottom: 20 },
  sectionTitle: {
    fontSize: 13, color: THEME.textSub, fontWeight: '500',
    marginTop: 12, marginBottom: 6, paddingLeft: 2,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    elevation: 1,
    shadowColor: '#8b5a2b',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  recordTypeRow: {
    flexDirection: 'row', gap: 8, marginBottom: 4,
  },
  recordTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: THEME.card,
    borderWidth: 1.5,
    borderColor: THEME.border,
  },
  recordTypeIcon: { fontSize: 16 },
  recordTypeBtnText: { fontSize: 14, color: THEME.text, fontWeight: '500' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    alignItems: 'center',
    backgroundColor: THEME.card,
    borderWidth: 1, borderColor: THEME.border,
  },
  typeBtnText: { fontSize: 13, color: THEME.textSub },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.divider,
  },
  label: { fontSize: 14, color: THEME.text, flex: 1 },
  subLabel: { fontSize: 11, color: THEME.textMute, marginTop: 2 },
  valueText: { fontSize: 14, color: THEME.text },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: THEME.accent,
    borderRadius: 8,
  },
  timeText: { fontSize: 15, fontWeight: '600', color: THEME.primary },
  nowBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: THEME.primary,
    borderRadius: 8,
  },
  nowBtnText: { fontSize: 12, color: THEME.accent, fontWeight: '500' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10,
  },
  switchLabel: { flex: 1, fontSize: 14, color: THEME.text },
  input: {
    backgroundColor: THEME.bg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: THEME.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  quickDurRow: {
    flexDirection: 'row', gap: 6,
    paddingTop: 6, paddingBottom: 12,
  },
  quickDurBtn: {
    paddingHorizontal: 8, paddingVertical: 5,
    backgroundColor: THEME.accent,
    borderRadius: 14,
    minWidth: 46, alignItems: 'center',
  },
  quickDurBtnActive: { backgroundColor: THEME.primary },
  quickDurText: { fontSize: 11, color: THEME.primary, fontWeight: '500' },
  quickDurTextActive: { color: '#fff' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: THEME.card,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.border,
  },
  saveBtn: {
    backgroundColor: THEME.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: THEME.accent, fontSize: 16, fontWeight: '600' },
});
