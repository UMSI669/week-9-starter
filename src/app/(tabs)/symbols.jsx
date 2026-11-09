/**
 * Symbols / Interpretations — the destination of the moon button.
 *
 * A bundled, searchable, editorial catalog. It is explicitly labelled as
 * reflection prompts rather than research, it invents no citations, and every
 * association is phrased tentatively. A symbol the AI produced that is not in
 * the catalog gets the general reflection entry instead of a crash.
 */

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  CATALOG_DISCLAIMER,
  GENERAL_SYMBOL_ENTRY,
  resolveSymbolEntry,
  searchSymbols,
} from '../../data/symbolCatalog';
import { getMoonPhase } from '../../services/moonPhase';
import {
  Card,
  EmptyState,
  Input,
  PageHeading,
  Screen,
  SectionTitle,
  StatusMessage,
} from '../../components/ui';
import { colors, fontSizes, radii, spacing, touchTarget } from '../../theme';

export default function SymbolsScreen() {
  // Opened from a dream card with ?symbol=... to land on that entry.
  const { symbol: requestedSymbol, label: requestedLabel } = useLocalSearchParams();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() =>
    requestedSymbol ? resolveSymbolEntry(requestedSymbol, requestedLabel).key : null,
  );

  const moon = useMemo(() => getMoonPhase(), []);
  const results = useMemo(() => searchSymbols(query), [query]);

  // When a dream's symbol is not in the catalog, show the general entry at the
  // top rather than an empty screen.
  const requestedEntry = requestedSymbol
    ? resolveSymbolEntry(requestedSymbol, requestedLabel)
    : null;
  const showGeneral = requestedEntry?.isGeneral && !query;

  return (
    <Screen>
      <PageHeading
        eyebrow="Reflections"
        title="Dream symbols"
        description={`Tonight’s moon is approximately ${moon.phaseName.toLowerCase()}, about ${Math.round(moon.illumination * 100)} percent lit.`}
      />

      <StatusMessage tone="info">{CATALOG_DISCLAIMER}</StatusMessage>

      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search water, flying, doors..."
        accessibilityLabel="Search dream symbols"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />

      {showGeneral ? (
        <>
          <SectionTitle>Your dream&apos;s symbol</SectionTitle>
          <SymbolEntry
            entry={requestedEntry}
            expanded
            onToggle={() => {}}
            highlight
          />
        </>
      ) : null}

      <SectionTitle>
        {query ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}` : 'The catalog'}
      </SectionTitle>

      {results.length === 0 ? (
        <Card>
          <EmptyState
            title="No catalog entry for that"
            body="The catalog is small and personal symbols are endless. A dream image that is not listed is completely normal."
          />
          <SymbolEntry entry={GENERAL_SYMBOL_ENTRY} expanded onToggle={() => {}} />
        </Card>
      ) : (
        <View style={styles.list}>
          {results.map((entry) => (
            <SymbolEntry
              key={entry.key}
              entry={entry}
              expanded={expanded === entry.key}
              onToggle={() => setExpanded(expanded === entry.key ? null : entry.key)}
              highlight={requestedEntry?.key === entry.key}
            />
          ))}
        </View>
      )}

      <Card>
        <Text style={styles.footerNote}>
          Dream Decoder offers reflective possibilities, not scientific, diagnostic, supernatural,
          or predictive conclusions. The moon phase shown here is calculated on the device from the
          current date and is approximate.
        </Text>
      </Card>
    </Screen>
  );
}

function SymbolEntry({ entry, expanded, onToggle, highlight = false }) {
  return (
    <View style={[styles.entry, highlight && styles.entryHighlight]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${entry.label}. ${expanded ? 'Collapse' : 'Expand'} reflection prompts.`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [styles.entryHeader, pressed && styles.pressed]}
      >
        <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.entryEmoji}>
          {entry.emoji}
        </Text>
        <Text style={styles.entryLabel}>{entry.label}</Text>
        <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.chevron}>
          {expanded ? '−' : '+'}
        </Text>
      </Pressable>

      {expanded ? (
        <View style={styles.entryBody}>
          {entry.associations.map((association) => (
            <Text key={association} style={styles.association}>
              {'•'} {association}
            </Text>
          ))}
          <View style={styles.questionBlock}>
            <Text style={styles.questionLabel}>Something to sit with</Text>
            <Text style={styles.question}>{entry.reflectionQuestion}</Text>
          </View>
          <Text style={styles.contextNote}>
            Personal and cultural context matter more than any list. What this image means in your
            dream may be nothing like what it means in someone else&apos;s.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  entry: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  entryHighlight: { borderColor: colors.accent, borderWidth: 2 },
  entryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: touchTarget + 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  entryEmoji: { fontSize: 24 },
  entryLabel: { color: colors.textPrimary, flex: 1, fontSize: fontSizes.bodyLarge, fontWeight: '700' },
  chevron: { color: colors.accent, fontSize: 22, fontWeight: '800', width: 22, textAlign: 'center' },
  entryBody: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  association: { color: colors.textSecondary, fontSize: fontSizes.body, lineHeight: 22 },
  questionBlock: {
    backgroundColor: 'rgba(196,181,253,0.1)',
    borderRadius: radii.md,
    gap: 3,
    marginTop: spacing.xs,
    padding: spacing.md,
  },
  questionLabel: {
    color: colors.accent,
    fontSize: fontSizes.caption,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  question: { color: colors.textPrimary, fontSize: fontSizes.body, lineHeight: 22 },
  contextNote: { color: colors.textMuted, fontSize: fontSizes.caption, lineHeight: 18 },
  footerNote: { color: colors.textMuted, fontSize: fontSizes.caption, lineHeight: 18 },
  pressed: { opacity: 0.72 },
});
