import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { AppScreen, SectionCard } from '@/components/app-screen';
import { Colors } from '@/constants/theme';
import { formatMoney } from '@/domain/calculations';

function parseNumber(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(\.\d{0,3})?$/.test(normalized)) return null;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

export default function PricingScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [fat, setFat] = useState('');
  const [snf, setSnf] = useState('');
  const [cmFat, setCmFat] = useState('');
  const [smFat, setSmFat] = useState('');
  const fatValue = parseNumber(fat);
  const snfValue = parseNumber(snf);
  const cmFatValue = parseNumber(cmFat);
  const smFatValue = parseNumber(smFat);
  const calculatedPaise = useMemo(() => {
    if ([fatValue, snfValue, cmFatValue, smFatValue].some((value) => value === null)) return null;
    return Math.round(((fatValue! * cmFatValue!) + (snfValue! * smFatValue!)) * 100);
  }, [cmFatValue, fatValue, smFatValue, snfValue]);

  return (
    <AppScreen title="Price calculator" subtitle="A reference calculator; buyer rates are set separately in Master data.">
      <SectionCard title="Milk quality inputs">
        <View style={styles.row}>
          <Field label="FAT %" value={fat} onChangeText={setFat} placeholder="Example: 4.2" invalid={fat.length > 0 && fatValue === null} />
          <Field label="SNF %" value={snf} onChangeText={setSnf} placeholder="Example: 8.5" invalid={snf.length > 0 && snfValue === null} />
        </View>
      </SectionCard>
      <SectionCard title="Coefficients">
        <Field label="CMFAT coefficient (₹)" value={cmFat} onChangeText={setCmFat} placeholder="Example: 6.00" invalid={cmFat.length > 0 && cmFatValue === null} />
        <Field label="SMFAT coefficient (₹)" value={smFat} onChangeText={setSmFat} placeholder="Example: 2.00" invalid={smFat.length > 0 && smFatValue === null} />
      </SectionCard>
      <SectionCard title="Calculated price">
        <Text style={[styles.result, { color: colors.text }]}>{calculatedPaise === null ? 'Enter FAT, SNF, CMFAT, and SMFAT.' : `${formatMoney(calculatedPaise)} / L`}</Text>
        <Text style={[styles.helper, { color: colors.textSecondary }]}>Formula: FAT% × CMFAT + SNF% × SMFAT.</Text>
      </SectionCard>
    </AppScreen>
  );
}

function Field({ label, value, onChangeText, placeholder, invalid, numeric }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; invalid: boolean; numeric?: boolean }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput accessibilityLabel={label} keyboardType={numeric ? 'decimal-pad' : 'numbers-and-punctuation'} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, borderColor: invalid ? colors.danger : colors.border }]} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  helper: { fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 10 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 16 },
  result: { fontSize: 28, fontWeight: '800' },
});
