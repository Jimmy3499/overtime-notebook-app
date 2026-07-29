import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { THEME } from '../constants';

interface AppHeaderProps {
  title: string;
  showBack?: boolean;
}

/**
 * 自定义顶部导航栏。
 * 用纯 RN View 实现，避免原生 Stack 工具栏的最低高度钳制，
 * 从而可以把栏高精确压到 40dp（明显矮于原生默认约 56dp）。
 */
export default function AppHeader({ title, showBack = false }: AppHeaderProps) {
  const navigation = useNavigation<any>();
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {showBack ? (
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.6}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>‹ 返回</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    backgroundColor: THEME.primary,
    paddingHorizontal: 12,
  },
  side: { width: 72, justifyContent: 'center' },
  backBtn: { justifyContent: 'center' },
  backText: { color: '#fff', fontSize: 15 },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
