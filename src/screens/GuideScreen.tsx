import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import MarkdownView from '../components/MarkdownView';
import { GUIDE } from '../guide';
import { THEME } from '../constants';

export default function GuideScreen() {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyPad}>
        <MarkdownView content={GUIDE} />
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  body: { flex: 1 },
  bodyPad: { paddingHorizontal: 16, paddingTop: 8 },
});
