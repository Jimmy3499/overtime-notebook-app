import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, TextInput, Modal, Pressable, ActivityIndicator,
} from 'react-native';
import { useApp } from '../AppContext';
import { THEME } from '../constants';
import { formatDate, todayStr } from '../utils';
import { loadHolidaySyncMeta } from '../storage';
import type { HolidaySyncMeta } from '../storage';
import type { HolidayConfig } from '../types';

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; holiday: HolidayConfig }
  | null;

export default function HolidaysScreen() {
  const { holidays, updateHolidays, syncHolidaysFromNetwork } = useApp();
  const [modal, setModal] = useState<ModalState>(null);
  const [formDate, setFormDate] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'holiday' | 'makeup'>('holiday');
  const [syncing, setSyncing] = useState(false);
  const [syncMeta, setSyncMeta] = useState<HolidaySyncMeta | null>(null);

  const sorted = [...holidays].sort((a, b) => (a.date < b.date ? -1 : 1));

  // 读取上次同步信息
  useEffect(() => {
    (async () => {
      try {
        setSyncMeta(await loadHolidaySyncMeta());
      } catch {
        /* 忽略 */
      }
    })();
  }, []);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const r = await syncHolidaysFromNetwork();
      setSyncMeta({
        year: new Date().getFullYear(),
        at: Date.now(),
        source: 'jsdelivr',
      });
      Alert.alert(
        '同步完成',
        `已拉取近三年官方节假日。\n新增 ${r.added} 条，更新 ${r.updated} 条，保留原有 ${r.kept} 条。`,
      );
    } catch {
      Alert.alert(
        '同步失败',
        '未能从网络获取官方节假日，当前使用应用内置的节假日数据（已覆盖 2025–2026 年），功能不受影响。你可以稍后重试，或在下方手动添加 / 编辑。',
      );
    } finally {
      setSyncing(false);
    }
  };

  const openAdd = () => {
    setFormDate(todayStr());
    setFormName('');
    setFormType('holiday');
    setModal({ type: 'add' });
  };

  const openEdit = (h: HolidayConfig) => {
    setFormDate(h.date);
    setFormName(h.name);
    setFormType(h.type);
    setModal({ type: 'edit', holiday: h });
  };

  const confirmAdd = () => {
    if (!formDate || !/^\d{4}-\d{2}-\d{2}$/.test(formDate)) {
      Alert.alert('请输入正确的日期格式', '如 2026-10-01');
      return;
    }
    if (!formName.trim()) {
      Alert.alert('请输入名称');
      return;
    }
    const newHoliday: HolidayConfig = {
      date: formDate,
      name: formName.trim(),
      type: formType,
    };
    const exists = holidays.find(h => h.date === formDate);
    if (exists) {
      Alert.alert('该日期已存在', '是否覆盖？', [
        { text: '取消', style: 'cancel' },
        { text: '覆盖', onPress: () => {
          updateHolidays(holidays.map(h => h.date === formDate ? newHoliday : h));
          setModal(null);
        }},
      ]);
      return;
    }
    updateHolidays([...holidays, newHoliday]);
    setModal(null);
  };

  const confirmEdit = () => {
    if (modal?.type !== 'edit') return;
    if (!formName.trim()) {
      Alert.alert('请输入名称');
      return;
    }
    const updated: HolidayConfig = {
      date: modal.holiday.date,
      name: formName.trim(),
      type: formType,
    };
    updateHolidays(holidays.map(h => h.date === modal.holiday.date ? updated : h));
    setModal(null);
  };

  const handleDelete = (h: HolidayConfig) => {
    Alert.alert('删除', `确定删除 ${h.date} ${h.name}？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => {
        updateHolidays(holidays.filter(x => x.date !== h.date));
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* 说明 */}
        <View style={styles.tipCard}>
          <Text style={styles.tipText}>
            ? 配置节假日后，添加记录时会自动判断日期类型。{'\n'}
            红色 = 法定假日（按节假日工资算）{'\n'}
            橙色 = 调休补班（按工作日工资算）
          </Text>
        </View>

        {/* 同步官方节假日 */}
        <View style={styles.syncCard}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.syncTitle}>官方节假日</Text>
            <Text style={styles.syncSub}>
              {syncMeta
                ? `上次同步：${new Date(syncMeta.at).toLocaleDateString('zh-CN')}（近三年）`
                : '尚未同步，点击从网络拉取近三年法定节假日与调休补班'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.syncBtnText}>同步</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 列表 */}
        <Text style={styles.sectionTitle}>已配置节假日（{sorted.length}）</Text>
        <View style={styles.listCard}>
          {sorted.length === 0 ? (
            <Text style={styles.emptyText}>还没有配置节假日</Text>
          ) : (
            sorted.map(h => (
              <TouchableOpacity
                key={h.date}
                style={styles.itemRow}
                onPress={() => openEdit(h)}
              >
                <View style={[styles.typeDot, { backgroundColor: h.type === 'holiday' ? '#ef4444' : '#f59e0b' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemDate}>{formatDate(h.date)}</Text>
                  <Text style={styles.itemName}>{h.name}</Text>
                </View>
                <Text style={styles.itemType}>
                  {h.type === 'holiday' ? '假日' : '补班'}
                </Text>
                <Text style={styles.chevron}>?</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* 添加按钮 */}
      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* 弹窗 */}
      <Modal transparent visible={!!modal} onRequestClose={() => setModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModal(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {modal?.type === 'add' ? '添加节假日' : '编辑节假日'}
            </Text>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>日期</Text>
              <TextInput
                style={styles.textInput}
                value={formDate}
                onChangeText={setFormDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={THEME.textMute}
              />
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>名称</Text>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={formName}
                onChangeText={setFormName}
                placeholder="如：国庆节"
                placeholderTextColor={THEME.textMute}
              />
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>类型</Text>
              <View style={styles.typeSwitch}>
                <TouchableOpacity
                  style={[styles.typeBtn, formType === 'holiday' && styles.typeBtnActive]}
                  onPress={() => setFormType('holiday')}
                >
                  <Text style={[styles.typeBtnText, formType === 'holiday' && styles.typeBtnTextActive]}>
                    法定假日
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, formType === 'makeup' && styles.typeBtnMakeup]}
                  onPress={() => setFormType('makeup')}
                >
                  <Text style={[styles.typeBtnText, formType === 'makeup' && styles.typeBtnTextActive]}>
                    调休补班
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              {modal?.type === 'edit' ? (
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnDanger]}
                  onPress={() => modal.type === 'edit' && handleDelete(modal.holiday)}
                >
                  <Text style={styles.modalBtnDangerText}>删除</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setModal(null)}>
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={modal?.type === 'add' ? confirmAdd : confirmEdit}
              >
                <Text style={styles.modalBtnConfirmText}>确定</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  sectionTitle: {
    fontSize: 13, color: THEME.textSub, fontWeight: '500',
    marginTop: 16, marginBottom: 6, paddingHorizontal: 12,
  },
  tipCard: {
    backgroundColor: THEME.accent,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
  },
  tipText: { fontSize: 12, color: THEME.brown, lineHeight: 18 },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.card,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  syncTitle: { fontSize: 14, color: THEME.text, fontWeight: '600' },
  syncSub: { fontSize: 11, color: THEME.textSub, marginTop: 4, lineHeight: 16 },
  syncBtn: {
    backgroundColor: THEME.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    height: 40,
  },
  syncBtnDisabled: { opacity: 0.6 },
  syncBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  listCard: {
    backgroundColor: THEME.card,
    marginHorizontal: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.divider,
  },
  typeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  itemDate: { fontSize: 14, color: THEME.text, fontWeight: '500' },
  itemName: { fontSize: 12, color: THEME.textSub, marginTop: 2 },
  itemType: { fontSize: 12, color: THEME.textMute, marginRight: 4 },
  chevron: { fontSize: 20, color: THEME.textMute, marginTop: -2 },
  emptyText: {
    fontSize: 13, color: THEME.textMute, textAlign: 'center', paddingVertical: 24,
  },
  fab: {
    position: 'absolute', right: 22, bottom: 28, width: 56, height: 56,
    borderRadius: 28, backgroundColor: THEME.primary,
    alignItems: 'center', justifyContent: 'center', elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 30, fontWeight: '300', marginTop: -2 },
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
  inputLabel: { width: 60, fontSize: 14, color: THEME.textSub },
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
  typeSwitch: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  typeBtnActive: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  typeBtnMakeup: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  typeBtnText: { fontSize: 13, color: THEME.textSub },
  typeBtnTextActive: { color: '#fff', fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
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
  modalBtnDanger: { backgroundColor: '#fef2f2', flex: 0.8 },
  modalBtnDangerText: { color: '#ef4444', fontSize: 14, fontWeight: '500' },
});
