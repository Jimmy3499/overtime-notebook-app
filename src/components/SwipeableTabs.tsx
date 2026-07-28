import React, { useRef, useState } from 'react';
import {
  StyleSheet, View, ScrollView, TouchableOpacity, Text, Dimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { THEME } from '../constants';

export interface TabItem {
  key: string;
  label: string;
  title: string;
  icon: string;  // emoji 图标
  component: React.ComponentType<any>;
}

interface SwipeableTabsProps {
  tabs: TabItem[];
  initialTab?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SwipeableTabs({ tabs, initialTab = 0 }: SwipeableTabsProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(initialTab);
  const [isScrolling, setIsScrolling] = useState(false);

  const scrollToTab = (index: number) => {
    if (scrollRef.current) {
      setIsScrolling(true);
      scrollRef.current.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
      setTimeout(() => setIsScrolling(false), 300);
    }
  };

  const handleTabPress = (index: number) => {
    setActiveIndex(index);
    scrollToTab(index);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isScrolling) return;
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== activeIndex && index >= 0 && index < tabs.length) {
      setActiveIndex(index);
    }
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index >= 0 && index < tabs.length) {
      setActiveIndex(index);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {tabs.map((tab) => {
          const Comp = tab.component;
          return (
            <View key={tab.key} style={{ width: SCREEN_WIDTH, flex: 1 }}>
              <Comp />
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.tabBar}>
        {tabs.map((tab, i) => {
          const active = i === activeIndex;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => handleTabPress(i)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabIcon, active && styles.tabIconActive]}>
                {tab.icon}
              </Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pager: { flex: 1, backgroundColor: THEME.bg },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: THEME.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.border,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    marginHorizontal: 3,
  },
  tabItemActive: {
    backgroundColor: THEME.accent + '40',
  },
  tabIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  tabIconActive: {
    fontSize: 24,
  },
  tabLabel: {
    fontSize: 13,
    color: THEME.textMute,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: THEME.primary,
    fontWeight: '700',
    fontSize: 14,
  },
});
