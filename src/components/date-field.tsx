import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { formatFarmDate } from '@/domain/dates';

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function toPickerDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

function toFarmDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

/** A native calendar field that keeps dates stored as timezone-safe YYYY-MM-DD strings. */
export function DateField({ label, value, onChange, disabled = false }: DateFieldProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [visible, setVisible] = useState(false);

  const handleChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    // Android closes its dialog after a selection; iOS keeps its inline/spinner control visible.
    if (Platform.OS === 'android') setVisible(false);
    if (selectedDate) onChange(toFarmDate(selectedDate));
  };

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <Pressable
        accessibilityLabel={label}
        accessibilityHint="Opens the calendar"
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.button, { borderColor: colors.border, backgroundColor: colors.background }, disabled && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={[styles.value, { color: colors.text }]}>{formatFarmDate(value)}</Text>
        <Text style={[styles.calendar, { color: colors.primary }]}>Calendar</Text>
      </Pressable>
      {visible ? (
        <DateTimePicker
          display={Platform.OS === 'ios' ? 'compact' : 'default'}
          mode="date"
          onChange={handleChange}
          value={toPickerDate(value)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '700' },
  button: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { fontSize: 16 },
  calendar: { fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.78 },
});
