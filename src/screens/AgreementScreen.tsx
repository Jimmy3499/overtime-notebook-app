import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import MarkdownView from '../components/MarkdownView';
import { TERMS, PRIVACY } from '../agreements';
import { THEME } from '../constants';

export default function AgreementScreen() {
  const route = useRoute<any>();
  const isPrivacy = route.params?.type === 'privacy';
  const content = isPrivacy ? PRIVACY : TERMS;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyPad}>
        <MarkdownView content={content} />
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
