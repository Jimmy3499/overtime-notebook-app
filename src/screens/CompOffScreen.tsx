import React, { useMemo, useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, TextInput, Modal, Pressable,
} from 'react-native';
import { useApp } from '../AppContext';
import { THEME, RECORD_TYPE_INFO } from '../constants';
import { formatDuration, formatDate, formatMoney, todayStr } from '../utils';
import type { CompOffRecord, OvertimeRecord } from '../types';

type ModalState =
  | { type: 'add'; record: OvertimeRecord | null }
  | { type: 'use'; hours: number }
  | null;

export default function CompOffScreen() {
  const { compOff, records, settings, addCompOffRecord, useCompOffHours } = useApp();
  const [modal, setModal] = useState<ModalState>(null);
  const [inputHours, setInputHours] = useState('');
  const [inputNote, setInputNote] = useState('');

  const overtimeRecords = useMemo(
    () => records.filter(r => (r.recordType || 'overtime') === 'overtime' && !r.useCompOff),
    [records]
  );

  const usedHours = compOff.usedHours;

  const handleAddFromRecord = (record: OvertimeRecord) => {
    const hours = record.durationHours * (settings.compOffRate || 1);
    setInputHours(hours.toFixed(2));
    setInputNote(`${formatDate(record.date)} ${RECORD_TYPE_INFO.overtime.label}`);
    setModal({ type: 'add', record });
  };

  const handleAddManual = () => {
    setInputHours('');
    setInputNote('');
    setModal({ type: 'add', record: null });
  };

  const confirmAdd = () => {
    const hours = parseFloat(inputHours) || 0;
    if (hours <= 0) {
      Alert.alert('请输入有效时长');
      return;
    }
    addCompOffRecord({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: todayStr(),
      hours,
      sourceRecordId: modal?.type === 'add' ? modal.record?.id : undefined,
      note: inputNote || '手动添加',
      createdAt: Date.now(),
    });
    setModal(null);
    Alert.alert('已添加', `调休增加 ${formatDuration(hours)}`);
  };

  const handleUse = () => {
    setInputHours('');
    setInputNote('');
    setModal({ type: 'use', hours: 0 });
  };

  const confirmUse = () => {
    const hours = parseFloat(inputHours) || 0;
    if (hours <= 0) {
      Alert.alert('请输入有效时长');
      return;
    }
    if (hours > compOff.totalHours) {
      Alert.alert('调休不足', `当前可用 ${formatDuration(compOff.totalHours)}`);
      return;
    }
    useCompOffHours(hours, inputNote || '使用调休');
    setModal(null);
    Alert.alert('已使用', `扣减调休 ${formatDuration(hours)}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* 总览卡片 */}
      <View style={styles.overview}>
        <View style={styles.overviewRow}>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{formatDuration(compOff.totalHours)}</Text>
            <Text style={styles.overviewLabel}>可用调休</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{formatDuration(usedHours)}</Text>
            <Text style={styles.overviewLabel}>已使用</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{compOff.records.length}</Text>
            <Text style={styles.overviewLabel}>流水记录</Text>
          </View>
        </View>
        <View style={styles.overviewActions}>
          <TouchableOpacity style={[styles.overviewBtn, styles.btnAdd]} onPress={handleAddManual}>
            <Text style={styles.overviewBtnText}>+ 增加调休</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.overviewBtn, styles.btnUse, compOff.totalHours <= 0 && styles.btnDisabled]}
            onPress={handleUse}
            disabled={compOff.totalHours <= 0}
          >
            <Text style={styles.overviewBtnText}>- 使用调休</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 流水记录 */}
      <Text style={styles.sectionTitle}>调休流水</Text>
      <View style={styles.listCard}>
        {compOff.records.length === 0 ? (
          <Text style={styles.emptyText}>暂无调休记录</Text>
        ) : (
          compOff.records
            .slice()
            .sort((a, b) => b.createdAt - a.createdAt)
            .map(r => (
              <View key={r.id} style={styles.recordRow}>
                <View style={styles.recordLeft}>
                  <Text style={styles.recordDate}>{formatDate(r.date)}</Text>
                  <Text style={styles.recordNote} numberOfLines={1}>{r.note}</Text>
                </View>
                <Text style={[
                  styles.recordHours,
                  r.hours > 0 ? styles.hoursAdd : styles.hoursUse,
                ]}>
                  {r.hours > 0 ? '+' : ''}{formatDuration(r.hours)}
                </Text>
              </View>
            ))
        )}
      </View>

      {/* 可转调休的加班记录 */}
      {overtimeRecords.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>可转调休的加班（未使用）</Text>
          <View style={styles.listCard}>
            {overtimeRecords.slice(0, 10).map(r => (
              <TouchableOpacity
                key={r.id}
                style={styles.recordRow}
                onPress={() => handleAddFromRecord(r)}
              >
                <View style={styles.recordLeft}>
                  <Text style={styles.recordDate}>{formatDate(r.date)}</Text>
                  <Text style={styles.recordNote}>
                    加班 {formatDuration(r.durationHours)} × {settings.compOffRate || 1}倍
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
            {overtimeRecords.length > 10 ? (
              <Text style={styles.moreText}>还有 {overtimeRecords.length - 10} 条未显示...</Text>
            ) : null}
          </View>
        </>
      )}

      {/* 弹窗 */}
      <Modal transparent visible={!!modal} onRequestClose={() => setModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModal(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {modal?.type === 'add' ? '增加调休' : '使用调休'}
            </Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>时长（小时）</Text>
              <TextInput
                style={styles.textInput}
                value={inputHours}
                onChangeText={setInputHours}
                keyboardType="numeric"
                placeholder="例如: 2.5"
                placeholderTextColor={THEME.textMute}
              />
            </View>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>备注</Text>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={inputNote}
                onChangeText={setInputNote}
                placeholder="选填"
                placeholderTextColor={THEME.textMute}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setModal(null)}>
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={modal?.type === 'add' ? confirmAdd : confirmUse}
              >
                <Text style={styles.modalBtnConfirmText}>确定</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  sectionTitle: {
    fontSize: 13, color: THEME.textSub, fontWeight: '500',
    marginTop: 16, marginBottom: 6, paddingHorizontal: 12,
  },
  overview: {
    backgroundColor: THEME.card,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    elevation: 2,
  },
  overviewRow: { flexDirection: 'row', alignItems: 'center' },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewDivider: { width: 1, height: 36, backgroundColor: THEME.border },
  overviewValue: { fontSize: 18, fontWeight: '700', color: THEME.primary },
  overviewLabel: { fontSize: 12, color: THEME.textSub, marginTop: 4 },
  overviewActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  overviewBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnAdd: { backgroundColor: THEME.primary },
  btnUse: { backgroundColor: THEME.brown },
  btnDisabled: { opacity: 0.4 },
  overviewBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  listCard: {
    backgroundColor: THEME.card,
    marginHorizontal: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.divider,
  },
  recordLeft: { flex: 1 },
  recordDate: { fontSize: 14, color: THEME.text, fontWeight: '500' },
  recordNote: { fontSize: 12, color: THEME.textMute, marginTop: 2 },
  recordHours: { fontSize: 14, fontWeight: '700' },
  hoursAdd: { color: THEME.success },
  hoursUse: { color: THEME.danger },
  emptyText: {
    fontSize: 13, color: THEME.textMute, textAlign: 'center', paddingVertical: 24,
  },
  moreText: { fontSize: 12, color: THEME.textMute, textAlign: 'center', paddingVertical: 10 },
  chevron: { fontSize: 20, color: THEME.textMute, marginTop: -2 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: THEME.text, marginBottom: 16 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12,
  },
  inputLabel: { width: 80, fontSize: 14, color: THEME.textSub },
  textInput: {
    flex: 1,
    backgroundColor: THEME.bg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: THEME.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnCancel: { backgroundColor: THEME.bg },
  modalBtnCancelText: { color: THEME.textSub, fontSize: 14 },
  modalBtnConfirm: { backgroundColor: THEME.primary },
  modalBtnConfirmText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
