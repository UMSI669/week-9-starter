import { Text } from 'react-native';
import type { RedactionSpan } from '../models/types';
import { placeholderFor } from '../services/privacy/placeholders';
import { colors, styles } from './ui';

/**
 * Renders a segment with its redaction spans:
 *  - mode "original": original words, accepted spans highlighted, rejected struck through
 *  - mode "changes":  original words struck out followed by their placeholder
 */
export function HighlightedText({
  text,
  spans,
  identityMap,
  mode,
}: {
  text: string;
  spans: RedactionSpan[];
  identityMap: Record<string, string>;
  mode: 'original' | 'changes';
}) {
  const ordered = [...spans].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ordered.forEach((span) => {
    if (span.start < cursor || text.slice(span.start, span.end) !== span.text) return;
    parts.push(text.slice(cursor, span.start));
    if (span.status === 'rejected') {
      parts.push(
        <Text key={span.id} style={{ textDecorationLine: 'underline', textDecorationStyle: 'dotted', color: colors.muted }}>
          {span.text}
        </Text>,
      );
    } else if (mode === 'original') {
      parts.push(
        <Text key={span.id} style={{ backgroundColor: colors.highlight, fontWeight: '600' }}>
          {span.text}
        </Text>,
      );
    } else {
      parts.push(
        <Text key={span.id}>
          <Text style={{ textDecorationLine: 'line-through', color: colors.danger }}>{span.text}</Text>
          <Text style={{ backgroundColor: colors.placeholder, color: colors.primaryDark, fontWeight: '700' }}>
            {' '}
            {placeholderFor(span, identityMap)}
          </Text>
        </Text>,
      );
    }
    cursor = span.end;
  });
  parts.push(text.slice(cursor));
  return <Text style={styles.body}>{parts}</Text>;
}

/** Renders cloud-bound text with placeholders emphasized. */
export function MaskedText({ text }: { text: string }) {
  const pieces = text.split(/(\[[A-Z]+_\d+\])/g);
  return (
    <Text style={styles.body}>
      {pieces.map((piece, i) =>
        /^\[[A-Z]+_\d+\]$/.test(piece) ? (
          <Text key={i} style={{ backgroundColor: colors.placeholder, color: colors.primaryDark, fontWeight: '700' }}>
            {piece}
          </Text>
        ) : (
          piece
        ),
      )}
    </Text>
  );
}
