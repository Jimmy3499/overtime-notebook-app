import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AppProvider } from './src/AppContext';
import HomeScreen from './src/screens/HomeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import AddRecordScreen from './src/screens/AddRecordScreen';
import StatsScreen from './src/screens/StatsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CompOffScreen from './src/screens/CompOffScreen';
import HolidaysScreen from './src/screens/HolidaysScreen';
import AgreementScreen from './src/screens/AgreementScreen';
import GuideScreen from './src/screens/GuideScreen';
import SwipeableTabs from './src/components/SwipeableTabs';
import AppHeader from './src/components/AppHeader';
import { THEME } from './src/constants';

const Stack = createNativeStackNavigator();

// 主 Tab：记录 / 日历 / 统计 / 设置（支持左右滑动切换）
function MainTabs() {
  const tabs = [
    { key: 'Home', label: '记录', title: '加班记录', icon: '📋', component: HomeScreen },
    { key: 'Calendar', label: '日历', title: '加班日历', icon: '📅', component: CalendarScreen },
    { key: 'Stats', label: '统计', title: '统计', icon: '📊', component: StatsScreen },
    { key: 'Settings', label: '设置', title: '设置', icon: '⚙️', component: SettingsScreen },
  ];
  return <SwipeableTabs tabs={tabs} />;
}

// 根 Stack：Tab + 添加/编辑记录页（覆盖在 Tab 之上）
function RootStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Main"
        component={MainTabs}
        options={{
          header: () => <AppHeader title="加班本" />,
        }}
      />
      <Stack.Screen
        name="AddRecord"
        component={AddRecordScreen}
        options={({ route }: any) => ({
          header: () => (
            <AppHeader
              title={route.params?.record ? '编辑记录' : '添加记录'}
              showBack
            />
          ),
        })}
      />
      <Stack.Screen
        name="Holidays"
        component={HolidaysScreen}
        options={{
          header: () => <AppHeader title="节假日配置" showBack />,
        }}
      />
      <Stack.Screen
        name="Agreement"
        component={AgreementScreen}
        options={({ route }: any) => ({
          header: () => (
            <AppHeader
              title={route.params?.type === 'privacy' ? '隐私政策' : '使用协议'}
              showBack
            />
          ),
        })}
      />
      <Stack.Screen
        name="Guide"
        component={GuideScreen}
        options={{
          header: () => <AppHeader title="使用说明" showBack />,
        }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AppProvider>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: THEME.primary }}>
          <NavigationContainer>
            <RootStack />
          </NavigationContainer>
          <StatusBar style="light" />
        </SafeAreaView>
      </SafeAreaProvider>
    </AppProvider>
  );
}
