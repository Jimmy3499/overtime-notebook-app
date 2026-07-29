import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../constants';

/** 将内联 markdown（**加粗** 与 `代码`）渲染为带样式的 Text 片段 */
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*.+?\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) {
      nodes.push(<Text key={`${keyBase}-t${i}`}>{text.slice(lastIndex, m.index)}</Text>);
      i++;
    }
    const tok = m[0];
    if (tok.startsWith('**')) {
      nodes.push(
        <Text key={`${keyBase}-b${i}`} style={{ fontWeight: '700', color: THEME.text }}>
          {tok.slice(2, -2)}
        </Text>,
      );
    } else {
      nodes.push(
        <Text key={`${keyBase}-c${i}`} style={styles.code}>
          {tok.slice(1, -1)}
        </Text>,
      );
    }
    i++;
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(<Text key={`${keyBase}-t${i}`}>{text.slice(lastIndex)}</Text>);
  }
  return nodes;
}

/** 渲染一张简单表格（首行为表头，第二行为分隔行，其后为正文） */
function renderTable(header: string[], body: string[][], keyBase: string): React.ReactNode {
  return (
    <View style={styles.table}>
      <View style={styles.tr}>
        {header.map((c, idx) => (
          <Text key={idx} style={[styles.td, styles.th]}>
            {renderInline(c, `${keyBase}-h${idx}`)}
          </Text>
        ))}
      </View>
      {body.map((row, r) => (
        <View key={r} style={[styles.tr, r % 2 === 1 && { backgroundColor: THEME.bg }]}>
          {row.map((c, idx) => (
            <Text key={idx} style={styles.td}>
              {renderInline(c, `${keyBase}-${r}-${idx}`)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** 极简 markdown 解析：标题 / 分隔线 / 引用 / 列表 / 表格 / 段落 */
function parseMarkdown(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  const isSpecial = (s: string) =>
    /^(#{1,3}\s|[-*]\s|\d+\.\s|>|-\*\*|@{3,})/.test(s) || s.startsWith('|');

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '') {
      i++;
      continue;
    }

    // 标题
    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      const level = h[1].length;
      out.push(
        <Text
          key={key++}
          style={level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3}
        >
          {renderInline(h[2], `h${key}`)}
        </Text>,
      );
      i++;
      continue;
    }

    // 分隔线
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      out.push(<View key={key++} style={styles.hr} />);
      i++;
      continue;
    }

    // 引用
    if (trimmed.startsWith('>')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(
        <View key={key++} style={styles.quote}>
          <Text style={styles.quoteText}>{renderInline(buf.join(' '), `q${key}`)}</Text>
        </View>,
      );
      continue;
    }

    // 表格
    if (trimmed.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].trim().split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      const header = rows[0] || [];
      const body = rows.slice(2);
      out.push(<View key={key++} style={styles.tableWrap}>{renderTable(header, body, `t${key}`)}</View>);
      continue;
    }

    // 无序列表
    if (/^[-*]\s+/.test(trimmed)) {
      const buf: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      out.push(
        <View key={key++} style={styles.list}>
          {buf.map((it, idx) => (
            <View key={idx} style={styles.li}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.liText}>{renderInline(it, `li${key}-${idx}`)}</Text>
            </View>
          ))}
        </View>,
      );
      continue;
    }

    // 有序列表
    if (/^\d+\.\s+/.test(trimmed)) {
      const buf: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      out.push(
        <View key={key++} style={styles.list}>
          {buf.map((it, idx) => (
            <View key={idx} style={styles.li}>
              <Text style={styles.bullet}>{idx + 1}.</Text>
              <Text style={styles.liText}>{renderInline(it, `nl${key}-${idx}`)}</Text>
            </View>
          ))}
        </View>,
      );
      continue;
    }

    // 段落
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !isSpecial(lines[i].trim())) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) {
      out.push(
        <Text key={key++} style={styles.p}>
          {renderInline(para.join(' '), `p${key}`)}
        </Text>,
      );
    } else {
      i++;
    }
  }
  return out;
}

export default function MarkdownView({ content }: { content: string }) {
  return <View>{parseMarkdown(content)}</View>;
}

const styles = StyleSheet.create({
  h1: { fontSize: 20, fontWeight: '700', color: THEME.text, marginTop: 8, marginBottom: 10 },
  h2: { fontSize: 16, fontWeight: '700', color: THEME.primary, marginTop: 16, marginBottom: 6 },
  h3: { fontSize: 15, fontWeight: '700', color: THEME.text, marginTop: 12, marginBottom: 4 },
  p: { fontSize: 14, color: THEME.text, lineHeight: 22, marginVertical: 5 },
  hr: { height: StyleSheet.hairlineWidth, backgroundColor: THEME.divider, marginVertical: 12 },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: THEME.primary,
    backgroundColor: THEME.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 6,
    borderRadius: 4,
  },
  quoteText: { fontSize: 13, color: THEME.textSub, lineHeight: 20 },
  list: { marginVertical: 4 },
  li: { flexDirection: 'row', marginVertical: 3 },
  bullet: { width: 18, fontSize: 14, color: THEME.text, fontWeight: '700' },
  liText: { flex: 1, fontSize: 14, color: THEME.text, lineHeight: 21 },
  code: {
    fontSize: 13,
    fontFamily: 'monospace',
    backgroundColor: THEME.bg,
    color: THEME.primary,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  tableWrap: { marginVertical: 8 },
  table: { borderWidth: StyleSheet.hairlineWidth, borderColor: THEME.border, borderRadius: 8, overflow: 'hidden' },
  tr: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: THEME.divider },
  td: { flex: 1, padding: 8, fontSize: 12, color: THEME.text, lineHeight: 17 },
  th: { fontWeight: '700', backgroundColor: THEME.card, color: THEME.text },
});
