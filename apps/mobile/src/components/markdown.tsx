import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { parseInline, parseMarkdown } from '@/lib/markdown-parse';
import { usePrefs } from '@/lib/prefs';

/**
 * A small native Markdown renderer for lesson and question text (the subset the seed content
 * uses): headings, paragraphs, bullet and numbered lists, fenced code (``` or ~~~), quotes,
 * **bold**, *italic*, `code` and [links](https://…). No raw HTML, like the website (D-12).
 */

function Inline({ text, size = 16 }: { text: string; size?: number }) {
  const { colors, fonts } = usePrefs();
  return (
    <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: size, lineHeight: size * 1.5 }}>
      {parseInline(text).map((s, i) =>
        s.code ? (
          <Text key={i} style={{ fontFamily: 'monospace', color: colors.codeInk, backgroundColor: colors.panel2 }}>
            {` ${s.text} `}
          </Text>
        ) : s.href ? (
          <Text key={i} accessibilityRole="link" onPress={() => (s.href!.startsWith('https://') ? void Linking.openURL(s.href!) : undefined)} style={{ color: colors.blueInk, textDecorationLine: 'underline' }}>
            {s.text}
          </Text>
        ) : (
          <Text key={i} style={{ fontFamily: s.bold ? fonts.bold : s.italic ? fonts.medium : fonts.body, fontStyle: s.italic ? 'italic' : 'normal' }}>
            {s.text}
          </Text>
        ),
      )}
    </Text>
  );
}

export function CodeBlock({ code }: { code: string }) {
  const { colors } = usePrefs();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.code, { backgroundColor: colors.code, borderColor: colors.line }]} contentContainerStyle={{ padding: 14 }}>
      <Text selectable style={{ fontFamily: 'monospace', fontSize: 14, lineHeight: 21, color: colors.codeInk }}>
        {code}
      </Text>
    </ScrollView>
  );
}

export function Markdown({ source, size = 16 }: { source: string; size?: number }) {
  const { colors, fonts } = usePrefs();
  return (
    <View style={{ gap: 12 }}>
      {parseMarkdown(source).map((b, i) => {
        switch (b.kind) {
          case 'heading':
            return (
              <Text key={i} accessibilityRole="header" style={{ color: colors.text, fontFamily: fonts.heading, fontSize: b.level <= 1 ? 22 : b.level === 2 ? 19 : 17, lineHeight: b.level <= 1 ? 28 : 25, marginTop: 6 }}>
                {b.text}
              </Text>
            );
          case 'code':
            return <CodeBlock key={i} code={b.text} />;
          case 'quote':
            return (
              <View key={i} style={[styles.quote, { borderColor: colors.blue, backgroundColor: colors.blueTint }]}>
                <Inline text={b.text} size={size} />
              </View>
            );
          case 'list':
            return (
              <View key={i} style={{ gap: 6 }}>
                {b.items.map((item, k) => (
                  <View key={k} style={{ flexDirection: 'row', gap: 10 }}>
                    <Text style={{ color: colors.mintInk, fontFamily: fonts.bold, fontSize: size, lineHeight: size * 1.5, minWidth: 18 }}>{b.ordered ? `${k + 1}.` : '•'}</Text>
                    <View style={{ flex: 1 }}>
                      <Inline text={item} size={size} />
                    </View>
                  </View>
                ))}
              </View>
            );
          default:
            return <Inline key={i} text={b.text} size={size} />;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  code: { borderWidth: 1, borderRadius: 14, maxHeight: 360 },
  quote: { borderLeftWidth: 4, borderRadius: 12, padding: 12 },
});
