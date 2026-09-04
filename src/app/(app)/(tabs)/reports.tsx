import { useFocusEffect } from 'expo-router';
import { Directory } from 'expo-file-system';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { DateField } from '@/components/date-field';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { getDailyDashboardSummary } from '@/data/repositories/dashboard';
import type { DailyDashboardSummary } from '@/data/repositories/dashboard.types';
import { getPeriodReport } from '@/data/repositories/reports';
import type { PeriodReport } from '@/data/repositories/reports.types';
import { formatMilk, formatMoney } from '@/domain/calculations';
import { formatFarmDate } from '@/domain/dates';

function currentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const last = new Date(year, month + 1, 0).getDate();
  return { fromDate, toDate: `${year}-${String(month + 1).padStart(2, '0')}-${last}` };
}

function todayAtFarm() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }

export default function ReportsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const initial = currentMonthRange();
  const [fromDate, setFromDate] = useState(initial.fromDate);
  const [toDate, setToDate] = useState(initial.toDate);
  const [report, setReport] = useState<PeriodReport | null>(null);
  const [todaySummary, setTodaySummary] = useState<DailyDashboardSummary | null>(null);
  const [animalFilter, setAnimalFilter] = useState('all');
  const [buyerFilter, setBuyerFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const sync = await getPowerSyncSnapshot();
      if (sync.farmId) { const [period, today] = await Promise.all([getPeriodReport(sync.farmId, fromDate, toDate), getDailyDashboardSummary(sync.farmId, todayAtFarm())]); setReport(period); setTodaySummary(today); } else { setReport(null); setTodaySummary(null); }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to calculate reports.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  const exportCsv = async () => {
    if (!report) return;
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      const directory = await Directory.pickDirectoryAsync();
      const timestamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
      const file = directory.createFile(`laveri-report-${fromDate}-to-${toDate}-${timestamp}.csv`, 'text/csv');
      file.write(`\uFEFF${buildReportCsv(report)}`);
      setMessage(`CSV exported as ${file.name}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to export the CSV file.');
    } finally {
      setExporting(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const timeout = setTimeout(() => void refresh(), 0);
      return () => clearTimeout(timeout);
    }, [refresh]),
  );

  const animalOptions = useMemo(() => uniqueOptions(report?.milkEntries.map((row) => ({ id: row.animalId, label: row.animalTag })) ?? []), [report]);
  const buyerOptions = useMemo(() => uniqueOptions(report?.buyerSales.map((row) => ({ id: row.buyerId, label: row.buyerName })) ?? []), [report]);
  const visibleMilkEntries = useMemo(() => report?.milkEntries.filter((row) => animalFilter === 'all' || row.animalId === animalFilter) ?? [], [animalFilter, report]);
  const visibleBuyerSales = useMemo(() => report?.buyerSales.filter((row) => buyerFilter === 'all' || row.buyerId === buyerFilter) ?? [], [buyerFilter, report]);

  return (
    <AppScreen title="Reports" subtitle="Calculated locally from source transactions">
      <SectionCard title="Date range">
        <View style={styles.dateRow}>
          <View style={styles.dateInput}><DateField label="From date" onChange={setFromDate} value={fromDate} /></View>
          <View style={styles.dateInput}><DateField label="To date" onChange={setToDate} value={toDate} /></View>
        </View>
        <Pressable onPress={refresh} style={({ pressed }) => [styles.refresh, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={styles.refreshText}>Refresh report</Text></Pressable>
      </SectionCard>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {message ? <Text style={[styles.message, { color: colors.primary }]}>{message}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} /> : !report ? <EmptyState>Complete farm setup to calculate reports.</EmptyState> : (
        <>
          <SectionCard title="Today">
            <View style={styles.grid}>
              <ReportCard label="Today’s milk" value={formatMilk(todaySummary?.producedMl ?? 0)} />
              <ReportCard label="Household milk" value={formatMilk(Math.max(0, todaySummary?.unallocatedMl ?? 0))} />
              <ReportCard label="Turnover" value={formatMoney(todaySummary?.turnoverPaise ?? 0)} />
              <ReportCard label="Operating cost" value={formatMoney(todaySummary?.operatingCostPaise ?? 0)} />
              <ReportCard label="Operating profit" value={formatMoney(todaySummary?.operatingProfitPaise ?? 0)} />
              <ReportCard label="Investment" value={formatMoney(todaySummary?.investmentPaise ?? 0)} />
            </View>
          </SectionCard>
          <View style={styles.grid}>
            <ReportCard label="Production" value={formatMilk(report.producedMl)} />
            <ReportCard label="Milk revenue" value={formatMoney(report.milkRevenuePaise)} />
            <ReportCard label="Operating cost" value={formatMoney(report.operatingCostPaise)} />
            <ReportCard label="Operating profit" value={formatMoney(report.operatingProfitPaise)} />
            <ReportCard label="Household" value={formatMilk(report.householdMl)} />
            <ReportCard label="Investment" value={formatMoney(report.investmentPaise)} />
          </View>

          <SectionCard title="Milk allocation">
            <ReportLine label="Morning production" value={formatMilk(report.morningMl)} />
            <ReportLine label="Evening production" value={formatMilk(report.eveningMl)} />
            <ReportLine label="Sold to buyers" value={formatMilk(report.buyerMl)} />
            <ReportLine label="Household consumption" value={formatMilk(report.householdMl)} />
            <ReportLine label={report.unallocatedMl < 0 ? 'Over-allocated' : 'Unallocated'} value={formatMilk(Math.abs(report.unallocatedMl))} danger={report.unallocatedMl < 0} />
          </SectionCard>

          <SectionCard title={`Milk source entries (${visibleMilkEntries.length})`}>
            <FilterChips label="Animal" options={animalOptions} selected={animalFilter} onSelect={setAnimalFilter} />
            {visibleMilkEntries.length === 0 ? <EmptyState>No milk entries match this filter.</EmptyState> : visibleMilkEntries.map((entry) => (
              <View key={entry.id} style={[styles.detailRow, { borderTopColor: colors.border }]}>
                <View style={styles.detailCopy}>
                  <Text style={[styles.animal, { color: colors.text }]}>{entry.animalTag} · {entry.session === 'morning' ? 'Morning' : 'Evening'}</Text>
                  <Text style={[styles.sessions, { color: colors.textSecondary }]}>{formatFarmDate(entry.milkDate)} · {entry.pricingMode === 'quality' ? `FAT ${(entry.fatHundredths ?? 0) / 100}% · SNF ${(entry.snfHundredths ?? 0) / 100}%` : 'Flat rate'}</Text>
                </View>
                <View style={styles.detailValue}>
                  <Text style={[styles.productivityValue, { color: colors.text }]}>{formatMilk(entry.volumeMl)}</Text>
                  <Text style={[styles.sessions, { color: colors.textSecondary }]}>{formatMoney(entry.ratePaisePerLitre)}/L</Text>
                </View>
              </View>
            ))}
          </SectionCard>

          <SectionCard title={`Buyer sales (${visibleBuyerSales.length})`}>
            <FilterChips label="Buyer" options={buyerOptions} selected={buyerFilter} onSelect={setBuyerFilter} />
            {visibleBuyerSales.length === 0 ? <EmptyState>No buyer sales match this filter.</EmptyState> : visibleBuyerSales.map((sale) => (
              <View key={sale.id} style={[styles.detailRow, { borderTopColor: colors.border }]}>
                <View style={styles.detailCopy}>
                  <Text style={[styles.animal, { color: colors.text }]}>{sale.buyerName} · {sale.session === 'morning' ? 'Morning' : 'Evening'}</Text>
                  <Text style={[styles.sessions, { color: colors.textSecondary }]}>{formatFarmDate(sale.milkDate)} · {formatMilk(sale.volumeMl)} × {formatMoney(sale.ratePaisePerLitre)}/L</Text>
                </View>
                <Text style={[styles.productivityValue, { color: colors.text }]}>{formatMoney(sale.amountPaise)}</Text>
              </View>
            ))}
          </SectionCard>

          <SectionCard title="Cost breakdown">
            <ReportLine label="Feed" value={formatMoney(report.feedCostPaise)} />
            <ReportLine label="Treatment" value={formatMoney(report.treatmentCostPaise)} />
            <ReportLine label="Products / misc." value={formatMoney(report.productOperatingCostPaise)} />
          </SectionCard>

          <SectionCard title="Animal productivity">
            {report.animals.length === 0 ? <EmptyState>No milk records in this period.</EmptyState> : report.animals.map((animal, index) => (
              <View key={animal.animalId} style={[styles.productivity, { borderTopColor: colors.border }]}>
                <Text style={[styles.rank, { color: colors.textSecondary }]}>{index + 1}</Text>
                <View style={styles.productivityCopy}><Text style={[styles.animal, { color: colors.text }]}>{animal.tag}</Text><Text style={[styles.sessions, { color: colors.textSecondary }]}>{animal.recordedSessions} recorded sessions</Text></View>
                <Text style={[styles.productivityValue, { color: colors.text }]}>{formatMilk(animal.totalMl)}</Text>
              </View>
            ))}
          </SectionCard>

          <SectionCard title="Export">
            <Text style={[styles.exportCopy, { color: colors.textSecondary }]}>Save the current date-range summary and animal productivity rows as an Excel-compatible CSV file.</Text>
            <Pressable disabled={exporting} onPress={() => void exportCsv()} style={({ pressed }) => [styles.refresh, { backgroundColor: colors.primary }, exporting && styles.disabled, pressed && styles.pressed]}>
              {exporting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.refreshText}>Choose folder and export CSV</Text>}
            </Pressable>
          </SectionCard>
        </>
      )}
    </AppScreen>
  );
}

function buildReportCsv(report: PeriodReport) {
  const header = [
    'record_type', 'from_date', 'to_date', 'animal', 'morning_litres', 'evening_litres',
    'total_litres', 'recorded_sessions', 'buyer_litres', 'household_litres', 'unallocated_litres',
    'milk_revenue_inr', 'feed_cost_inr', 'treatment_cost_inr', 'product_cost_inr',
    'operating_cost_inr', 'operating_profit_inr', 'investment_inr',
  ];
  const summary = [
    'summary', report.fromDate, report.toDate, '', report.morningMl / 1_000, report.eveningMl / 1_000,
    report.producedMl / 1_000, '', report.buyerMl / 1_000, report.householdMl / 1_000,
    report.unallocatedMl / 1_000, report.milkRevenuePaise / 100, report.feedCostPaise / 100,
    report.treatmentCostPaise / 100, report.productOperatingCostPaise / 100,
    report.operatingCostPaise / 100, report.operatingProfitPaise / 100, report.investmentPaise / 100,
  ];
  const animals = report.animals.map((animal) => [
    'animal_productivity', report.fromDate, report.toDate, animal.tag,
    animal.morningMl / 1_000, animal.eveningMl / 1_000, animal.totalMl / 1_000,
    animal.recordedSessions, '', '', '', '', '', '', '', '', '', '',
  ]);
  const milkEntries = report.milkEntries.map((entry) => [
    'milk_entry', report.fromDate, report.toDate, `${entry.animalTag} · ${entry.milkDate} ${entry.session}`,
    entry.session === 'morning' ? entry.volumeMl / 1_000 : '', entry.session === 'evening' ? entry.volumeMl / 1_000 : '',
    entry.volumeMl / 1_000, '', '', '', '', '', '', '', '', '', '', '',
  ]);
  const buyerSales = report.buyerSales.map((sale) => [
    'buyer_sale', report.fromDate, report.toDate, `${sale.buyerName} · ${sale.milkDate} ${sale.session}`,
    '', '', sale.volumeMl / 1_000, '', sale.volumeMl / 1_000, '', '', sale.amountPaise / 100,
    '', '', '', '', '', '',
  ]);
  return [header, summary, ...animals, ...milkEntries, ...buyerSales].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function uniqueOptions(options: { id: string; label: string }[]) {
  return [...new Map(options.map((option) => [option.id, option])).values()];
}

function FilterChips({ label, options, selected, onSelect }: { label: string; options: { id: string; label: string }[]; selected: string; onSelect: (id: string) => void }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return (
    <View style={styles.filterBlock}>
      <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.filters}>
        {[{ id: 'all', label: 'All' }, ...options].map((option) => (
          <Pressable key={option.id} onPress={() => onSelect(option.id)} style={[styles.filter, { backgroundColor: selected === option.id ? colors.primary : colors.backgroundSelected }]}>
            <Text style={[styles.filterText, { color: selected === option.id ? '#FFFFFF' : colors.text }]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ReportCard({ label, value }: { label: string; value: string }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}><Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{label}</Text><Text style={[styles.cardValue, { color: colors.text }]}>{value}</Text></View>;
}

function ReportLine({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return <View style={styles.line}><Text style={[styles.lineLabel, { color: colors.textSecondary }]}>{label}</Text><Text style={[styles.lineValue, { color: danger ? colors.danger : colors.text }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', gap: 10 },
  dateInput: { flex: 1 },
  refresh: { minHeight: 46, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  refreshText: { color: '#FFFFFF', fontWeight: '700' },
  pressed: { opacity: 0.75 },
  error: { fontSize: 14, lineHeight: 20 },
  message: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48%', flexGrow: 1, minHeight: 92, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 13, justifyContent: 'space-between' },
  cardLabel: { fontSize: 12, fontWeight: '700' },
  cardValue: { fontSize: 19, fontWeight: '800' },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  lineLabel: { flex: 1, fontSize: 14 },
  lineValue: { fontSize: 14, fontWeight: '800' },
  productivity: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  rank: { width: 24, fontSize: 14, fontWeight: '800' },
  productivityCopy: { flex: 1, gap: 2 },
  animal: { fontSize: 15, fontWeight: '700' },
  sessions: { fontSize: 12 },
  productivityValue: { fontSize: 14, fontWeight: '800' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  detailCopy: { flex: 1, gap: 3 },
  detailValue: { alignItems: 'flex-end', gap: 3 },
  filterBlock: { gap: 6 },
  filterLabel: { fontSize: 12, fontWeight: '700' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filter: { minHeight: 34, borderRadius: 17, justifyContent: 'center', paddingHorizontal: 11 },
  filterText: { fontSize: 12, fontWeight: '700' },
  exportCopy: { fontSize: 13, lineHeight: 19 },
  disabled: { opacity: 0.45 },
});
