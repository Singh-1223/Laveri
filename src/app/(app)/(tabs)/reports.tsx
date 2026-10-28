import { Directory } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { DateField } from '@/components/date-field';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot, refreshPowerSync } from '@/data/powersync/platform';
import { getAnimalMilkGraph, getFarmAverageMilk, getPeriodReport, getQualityRecords } from '@/data/repositories/reports';
import type { AnimalMilkGraphSnapshot, FarmAverageMilkPoint, MilkQualityRecord, PeriodReport } from '@/data/repositories/reports.types';
import { formatMilk, formatMoney } from '@/domain/calculations';
import { formatFarmDate, shiftTenDayCycle, tenDayCycleEnd, tenDayCycleStart } from '@/domain/dates';

function currentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const last = new Date(year, month + 1, 0).getDate();
  return { fromDate, toDate: `${year}-${String(month + 1).padStart(2, '0')}-${last}` };
}
function todayAtFarm() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
function addDays(date: string, days: number) { return new Date(new Date(`${date}T12:00:00`).getTime() + days * 86_400_000).toISOString().slice(0, 10); }
function lastCompletedFarmDay() { return addDays(todayAtFarm(), -1); }
const graphColors = ['#2563EB', '#D9468B', '#059669', '#EA580C', '#7C3AED', '#0891B2', '#CA8A04', '#DC2626'];

export default function ReportsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const initial = currentMonthRange();
  const [fromDate, setFromDate] = useState(initial.fromDate);
  const [toDate, setToDate] = useState(initial.toDate);
  const [report, setReport] = useState<PeriodReport | null>(null);
  const [qualityCycleStart, setQualityCycleStart] = useState(tenDayCycleStart(todayAtFarm()));
  const [qualityRecords, setQualityRecords] = useState<MilkQualityRecord[]>([]);
  const [qualityGraphRecords, setQualityGraphRecords] = useState<MilkQualityRecord[]>([]);
  const [qualityGraphRangeDays, setQualityGraphRangeDays] = useState<10 | 30 | 90>(10);
  const [qualityGraphCustomFrom, setQualityGraphCustomFrom] = useState('');
  const [qualityGraphCustomTo, setQualityGraphCustomTo] = useState('');
  const [graphRangeDays, setGraphRangeDays] = useState<10 | 30 | 90>(10);
  const [graphCustomFrom, setGraphCustomFrom] = useState('');
  const [graphCustomTo, setGraphCustomTo] = useState('');
  const [animalMilkGraph, setAnimalMilkGraph] = useState<AnimalMilkGraphSnapshot>({ animals: [], points: [] });
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);
  const [farmAverage, setFarmAverage] = useState<FarmAverageMilkPoint[]>([]);
  const [farmAvgRangeDays, setFarmAvgRangeDays] = useState<10 | 30 | 90>(10);
  const [farmAvgCustomFrom, setFarmAvgCustomFrom] = useState('');
  const [farmAvgCustomTo, setFarmAvgCustomTo] = useState('');
  const [farmAvgLoading, setFarmAvgLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [graphLoading, setGraphLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const sync = await getPowerSyncSnapshot();
      if (sync.farmId) { const period = await getPeriodReport(sync.farmId, fromDate, toDate); setReport(period); } else { setReport(null); setQualityRecords([]); }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to calculate reports.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  const loadQuality = useCallback(async () => { setQualityLoading(true); try { const sync = await getPowerSyncSnapshot(); setQualityRecords(sync.farmId ? await getQualityRecords(sync.farmId, qualityCycleStart, tenDayCycleEnd(qualityCycleStart)) : []); } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to load FAT/SNF records.'); } finally { setQualityLoading(false); } }, [qualityCycleStart]);
  const graphLastDay = lastCompletedFarmDay();
  const qualityGraphFromDate = qualityGraphCustomFrom || addDays(graphLastDay, -(qualityGraphRangeDays - 1));
  const qualityGraphToDate = !qualityGraphCustomTo || qualityGraphCustomTo > graphLastDay ? graphLastDay : qualityGraphCustomTo;
  const graphFromDate = graphCustomFrom || addDays(graphLastDay, -(graphRangeDays - 1));
  const graphToDate = !graphCustomTo || graphCustomTo > graphLastDay ? graphLastDay : graphCustomTo;
  // Farm average always excludes today: the upper bound is clamped to yesterday (graphLastDay).
  const farmAvgFromDate = farmAvgCustomFrom || addDays(graphLastDay, -(farmAvgRangeDays - 1));
  const farmAvgToDate = !farmAvgCustomTo || farmAvgCustomTo > graphLastDay ? graphLastDay : farmAvgCustomTo;
  const loadAnimalMilkGraph = useCallback(async () => {
    setGraphLoading(true);
    try {
      const sync = await getPowerSyncSnapshot();
      const nextGraph = sync.farmId ? await getAnimalMilkGraph(sync.farmId, graphFromDate, graphToDate) : { animals: [], points: [] };
      setAnimalMilkGraph(nextGraph);
      setSelectedAnimalIds((current) => {
        const availableIds = nextGraph.animals.map((animal) => animal.id);
        const retained = current.filter((id) => availableIds.includes(id));
        return retained.length ? retained : availableIds;
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load the combined animal graph.');
    } finally {
      setGraphLoading(false);
    }
  }, [graphFromDate, graphToDate]);
  const loadQualityGraph = useCallback(async () => { try { const sync = await getPowerSyncSnapshot(); setQualityGraphRecords(sync.farmId ? await getQualityRecords(sync.farmId, qualityGraphFromDate, qualityGraphToDate) : []); } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to load FAT/SNF graphs.'); } }, [qualityGraphFromDate, qualityGraphToDate]);
  const loadFarmAverage = useCallback(async () => { setFarmAvgLoading(true); try { const sync = await getPowerSyncSnapshot(); setFarmAverage(sync.farmId ? await getFarmAverageMilk(sync.farmId, farmAvgFromDate, farmAvgToDate) : []); } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to load farm average milk production.'); } finally { setFarmAvgLoading(false); } }, [farmAvgFromDate, farmAvgToDate]);
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
  useEffect(() => { const timeout = setTimeout(() => void loadQuality(), 0); return () => clearTimeout(timeout); }, [loadQuality]);
  useEffect(() => { const timeout = setTimeout(() => void loadAnimalMilkGraph(), 0); return () => clearTimeout(timeout); }, [loadAnimalMilkGraph]);
  useEffect(() => { const timeout = setTimeout(() => void loadQualityGraph(), 0); return () => clearTimeout(timeout); }, [loadQualityGraph]);
  useEffect(() => { const timeout = setTimeout(() => void loadFarmAverage(), 0); return () => clearTimeout(timeout); }, [loadFarmAverage]);

  const qualityCycleEnd = tenDayCycleEnd(qualityCycleStart);
  const selectedAnimals = useMemo(() => animalMilkGraph.animals.filter((animal) => selectedAnimalIds.includes(animal.id)), [animalMilkGraph.animals, selectedAnimalIds]);
  const graphDates = useMemo(() => [...new Set(animalMilkGraph.points.filter((point) => selectedAnimalIds.includes(point.animalId)).map((point) => point.milkDate))].sort(), [animalMilkGraph.points, selectedAnimalIds]);
  const pointsByAnimal = useMemo(() => {
    const totals = new Map<string, Map<string, number>>();
    for (const point of animalMilkGraph.points) {
      const animalPoints = totals.get(point.animalId) ?? new Map<string, number>();
      animalPoints.set(point.milkDate, point.volumeMl);
      totals.set(point.animalId, animalPoints);
    }
    return totals;
  }, [animalMilkGraph.points]);
  const animalGraphColors = useMemo(() => new Map(animalMilkGraph.animals.map((animal, index) => [animal.id, graphColors[index % graphColors.length]])), [animalMilkGraph.animals]);

  return (
    <AppScreen enableTabSwipe onRefresh={async () => { try { await refreshPowerSync(); } finally { await Promise.all([refresh(), loadQuality(), loadAnimalMilkGraph(), loadQualityGraph(), loadFarmAverage()]); } }} title="Reports">
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
            <ReportLine label="Milk Calf consumption" value={formatMilk(report.milkCalfMl)} />
            <ReportLine label="Household consumption" value={formatMilk(report.householdMl)} />
            <ReportLine label={report.unallocatedMl < 0 ? 'Over-allocated' : 'Unallocated'} value={formatMilk(Math.abs(report.unallocatedMl))} danger={report.unallocatedMl < 0} />
          </SectionCard>

          <SectionCard title="Combined animal milk history">
            <Text style={[styles.graphCopy, { color: colors.textSecondary }]}>Daily milk total per selected animal. Today is excluded.</Text>
            <View style={styles.rangeButtons}>{([10, 30, 90] as const).map((value) => <Pressable key={value} onPress={() => { setGraphRangeDays(value); setGraphCustomFrom(''); setGraphCustomTo(''); }} style={[styles.rangeButton, { backgroundColor: graphRangeDays === value && !graphCustomFrom && !graphCustomTo ? colors.primary : colors.backgroundSelected }]}><Text style={{ color: graphRangeDays === value && !graphCustomFrom && !graphCustomTo ? '#FFFFFF' : colors.text }}>{value === 10 ? '10 days' : value === 30 ? '1 month' : '3 months'}</Text></Pressable>)}</View>
            <View style={styles.dateRow}><View style={styles.dateInput}><DateField label="Custom from (optional)" value={graphCustomFrom} onChange={setGraphCustomFrom} /></View><View style={styles.dateInput}><DateField label="Custom to (optional)" value={graphCustomTo} onChange={setGraphCustomTo} /></View></View>
            <View style={styles.selectionHeader}><Text style={[styles.selectionLabel, { color: colors.text }]}>Animals</Text><Pressable onPress={() => setSelectedAnimalIds((current) => current.length === animalMilkGraph.animals.length ? [] : animalMilkGraph.animals.map((animal) => animal.id))}><Text style={{ color: colors.primary, fontWeight: '800' }}>{selectedAnimalIds.length === animalMilkGraph.animals.length ? 'Clear all' : 'Select all'}</Text></Pressable></View>
            <View style={styles.animalChoices}>{animalMilkGraph.animals.map((animal, index) => { const selected = selectedAnimalIds.includes(animal.id); const color = graphColors[index % graphColors.length]; return <Pressable key={animal.id} onPress={() => setSelectedAnimalIds((current) => current.includes(animal.id) ? current.filter((id) => id !== animal.id) : [...current, animal.id])} style={[styles.animalChoice, { borderColor: selected ? color : colors.border, backgroundColor: selected ? colors.backgroundSelected : colors.backgroundElement }]}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={{ color: colors.text, fontWeight: '700' }}>{animal.tag}</Text></Pressable>; })}</View>
            {graphLoading ? <ActivityIndicator color={colors.primary} /> : selectedAnimals.length === 0 ? <EmptyState>Select one or more animals to view their milk lines.</EmptyState> : graphDates.length === 0 ? <EmptyState>No completed milk records in this date range.</EmptyState> : <CombinedMilkChart animals={selectedAnimals} dates={graphDates} pointsByAnimal={pointsByAnimal} animalColors={animalGraphColors} colors={colors} />}
          </SectionCard>

          <SectionCard title="Farm Average Milk Production">
            <Text style={[styles.graphCopy, { color: colors.textSecondary }]}>Daily average = total milk produced (morning + evening) ÷ number of milking animals that day. Milk Calf consumption is excluded. Today is excluded.</Text>
            <View style={styles.rangeButtons}>{([10, 30, 90] as const).map((value) => <Pressable key={value} onPress={() => { setFarmAvgRangeDays(value); setFarmAvgCustomFrom(''); setFarmAvgCustomTo(''); }} style={[styles.rangeButton, { backgroundColor: farmAvgRangeDays === value && !farmAvgCustomFrom && !farmAvgCustomTo ? colors.primary : colors.backgroundSelected }]}><Text style={{ color: farmAvgRangeDays === value && !farmAvgCustomFrom && !farmAvgCustomTo ? '#FFFFFF' : colors.text }}>{value === 10 ? '10 days' : value === 30 ? '1 month' : '3 months'}</Text></Pressable>)}</View>
            <View style={styles.dateRow}><View style={styles.dateInput}><DateField label="Custom from (optional)" value={farmAvgCustomFrom} onChange={setFarmAvgCustomFrom} /></View><View style={styles.dateInput}><DateField label="Custom to (optional)" value={farmAvgCustomTo} onChange={setFarmAvgCustomTo} /></View></View>
            {farmAvgLoading ? <ActivityIndicator color={colors.primary} /> : farmAverage.length === 0 ? <EmptyState>No completed milk records in this date range.</EmptyState> : <><FarmAverageChart points={farmAverage} colors={colors} /><View style={[styles.qualityTableRow, styles.qualityTableHeader, { borderBottomColor: colors.border }]}><Text style={[styles.qualityDateColumn, styles.qualityTableHeading, { color: colors.textSecondary }]}>Date</Text><Text style={[styles.qualityValueColumn, styles.qualityTableHeading, { color: colors.textSecondary }]}>Milking</Text><Text style={[styles.qualityValueColumn, styles.qualityTableHeading, { color: colors.textSecondary }]}>Avg/animal</Text></View>{farmAverage.map((point) => <View key={point.milkDate} style={[styles.qualityTableRow, { borderBottomColor: colors.border }]}><Text style={[styles.qualityDateColumn, { color: colors.text }]}>{formatFarmDate(point.milkDate)}</Text><Text style={[styles.qualityValueColumn, { color: colors.text }]}>{point.milkingAnimals}</Text><Text style={[styles.qualityValueColumn, { color: colors.text }]}>{formatMilk(point.averageMl)}</Text></View>)}</>}
          </SectionCard>

          <SectionCard title="FAT & SNF history"><Text style={[styles.graphCopy, { color: colors.textSecondary }]}>Morning and Evening are shown as separate lines. Today is excluded.</Text><View style={styles.rangeButtons}>{([10, 30, 90] as const).map((value) => <Pressable key={value} onPress={() => { setQualityGraphRangeDays(value); setQualityGraphCustomFrom(''); setQualityGraphCustomTo(''); }} style={[styles.rangeButton, { backgroundColor: qualityGraphRangeDays === value && !qualityGraphCustomFrom && !qualityGraphCustomTo ? colors.primary : colors.backgroundSelected }]}><Text style={{ color: qualityGraphRangeDays === value && !qualityGraphCustomFrom && !qualityGraphCustomTo ? '#FFFFFF' : colors.text }}>{value === 10 ? '10 days' : value === 30 ? '1 month' : '3 months'}</Text></Pressable>)}</View><View style={styles.dateRow}><View style={styles.dateInput}><DateField label="Custom from (optional)" value={qualityGraphCustomFrom} onChange={setQualityGraphCustomFrom} /></View><View style={styles.dateInput}><DateField label="Custom to (optional)" value={qualityGraphCustomTo} onChange={setQualityGraphCustomTo} /></View></View>{qualityGraphRecords.length === 0 ? <EmptyState>No FAT/SNF records in this date range.</EmptyState> : <><Text style={[styles.qualityGraphTitle, { color: colors.text }]}>FAT %</Text><QualityLineChart records={qualityGraphRecords} value="fat" colors={colors} /><Text style={[styles.qualityGraphTitle, { color: colors.text }]}>SNF %</Text><QualityLineChart records={qualityGraphRecords} value="snf" colors={colors} /></>}</SectionCard>

          <SectionCard title={`FAT & SNF records (${qualityRecords.length})`}><View style={styles.shiftNavigation}><Pressable onPress={() => setQualityCycleStart((value) => shiftTenDayCycle(value, -1))}><Text style={{ color: colors.primary }}>‹ Previous</Text></Pressable><Text style={{ color: colors.text }}>{formatFarmDate(qualityCycleStart)} – {formatFarmDate(qualityCycleEnd)}</Text><Pressable onPress={() => setQualityCycleStart((value) => shiftTenDayCycle(value, 1))}><Text style={{ color: colors.primary }}>Next ›</Text></Pressable></View>
            {qualityLoading ? <ActivityIndicator color={colors.primary} /> : qualityRecords.length === 0 ? <EmptyState>No FAT/SNF records in this date range.</EmptyState> : <View style={styles.qualityTable}>
              <View style={[styles.qualityTableRow, styles.qualityTableHeader, { borderBottomColor: colors.border }]}><Text style={[styles.qualityDateColumn, styles.qualityTableHeading, { color: colors.textSecondary }]}>Date & time</Text><Text style={[styles.qualityValueColumn, styles.qualityTableHeading, { color: colors.textSecondary }]}>FAT %</Text><Text style={[styles.qualityValueColumn, styles.qualityTableHeading, { color: colors.textSecondary }]}>SNF %</Text></View>
              {qualityRecords.map((record) => <View key={`${record.milkDate}:${record.session}`} style={[styles.qualityTableRow, { borderBottomColor: colors.border }]}><Text style={[styles.qualityDateColumn, { color: colors.text }]}>{formatFarmDate(record.milkDate)} · {record.session === 'morning' ? 'Morning' : 'Evening'}</Text><Text style={[styles.qualityValueColumn, { color: colors.text }]}>{record.fatHundredths === null ? '—' : record.fatHundredths / 100}</Text><Text style={[styles.qualityValueColumn, { color: colors.text }]}>{record.snfHundredths === null ? '—' : record.snfHundredths / 100}</Text></View>)}
            </View>}
          </SectionCard>


          <SectionCard title="Cost breakdown">
            <ReportLine label="Feed" value={formatMoney(report.feedCostPaise)} />
            <ReportLine label="Treatment" value={formatMoney(report.treatmentCostPaise)} />
            <ReportLine label="Products / misc." value={formatMoney(report.productOperatingCostPaise)} />
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

function CombinedMilkChart({ animals, dates, pointsByAnimal, animalColors, colors }: { animals: AnimalMilkGraphSnapshot['animals']; dates: string[]; pointsByAnimal: Map<string, Map<string, number>>; animalColors: Map<string, string>; colors: typeof Colors.light | typeof Colors.dark }) {
  const chartLeft = 44;
  const chartTop = 20;
  const chartBottom = 136;
  const chartWidth = Math.max(280, chartLeft + dates.length * 52);
  const allVolumes = animals.flatMap((animal) => [...(pointsByAnimal.get(animal.id)?.values() ?? [])]);
  const axisMaximum = Math.max(1_000, Math.ceil(Math.max(1, ...allVolumes) / 1_000) * 1_000);
  const yTicks = [axisMaximum, axisMaximum / 2, 0];
  const milkY = (volumeMl: number) => chartBottom - ((volumeMl / axisMaximum) * (chartBottom - chartTop));
  const pointX = (date: string) => chartLeft + dates.indexOf(date) * 52;

  return <ScrollView horizontal showsHorizontalScrollIndicator>
      <View>
        <Svg width={chartWidth} height={156}>
          <SvgText x="0" y="12" fill={colors.textSecondary} fontSize="10">Milk (L)</SvgText>
          {yTicks.flatMap((tick) => { const y = milkY(tick); return [<Line key={`grid-${tick}`} x1={chartLeft} y1={y} x2={chartWidth - 8} y2={y} stroke={colors.border} strokeDasharray={tick === 0 ? undefined : '3 3'} />, <SvgText key={`label-${tick}`} x={chartLeft - 5} y={y + 4} fill={colors.textSecondary} fontSize="10" textAnchor="end">{formatMilk(tick)}</SvgText>]; })}
          <Line x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartBottom} stroke={colors.border} />
          {animals.map((animal) => {
            const entries = pointsByAnimal.get(animal.id) ?? new Map<string, number>();
            const points = dates.filter((date) => entries.has(date)).map((date) => `${pointX(date)},${milkY(entries.get(date) ?? 0)}`).join(' ');
            const color = animalColors.get(animal.id) ?? colors.primary;
            return <Fragment key={animal.id}>{points ? <Polyline points={points} fill="none" stroke={color} strokeWidth="3" /> : null}{dates.filter((date) => entries.has(date)).map((date) => <Circle key={`${animal.id}-${date}`} cx={pointX(date)} cy={milkY(entries.get(date) ?? 0)} r="3.5" fill={color} />)}</Fragment>;
          })}
        </Svg>
        <View style={styles.chartLabels}>{dates.map((date) => <Text key={date} style={[styles.chartLabel, { color: colors.textSecondary }]}>{formatFarmDate(date)}</Text>)}</View>
      </View>
    </ScrollView>;
}

function FarmAverageChart({ points, colors }: { points: FarmAverageMilkPoint[]; colors: typeof Colors.light | typeof Colors.dark }) {
  const chartLeft = 44;
  const chartTop = 20;
  const chartBottom = 136;
  const chartWidth = Math.max(280, chartLeft + points.length * 52);
  const axisMaximum = Math.max(1_000, Math.ceil(Math.max(1, ...points.map((point) => point.averageMl)) / 1_000) * 1_000);
  const yTicks = [axisMaximum, axisMaximum / 2, 0];
  const milkY = (volumeMl: number) => chartBottom - ((volumeMl / axisMaximum) * (chartBottom - chartTop));
  const pointX = (index: number) => chartLeft + index * 52;
  const linePoints = points.map((point, index) => `${pointX(index)},${milkY(point.averageMl)}`).join(' ');
  return <ScrollView horizontal showsHorizontalScrollIndicator>
    <View>
      <Svg width={chartWidth} height={156}>
        <SvgText x="0" y="12" fill={colors.textSecondary} fontSize="10">Avg (L)</SvgText>
        {yTicks.flatMap((tick) => { const y = milkY(tick); return [<Line key={`grid-${tick}`} x1={chartLeft} y1={y} x2={chartWidth - 8} y2={y} stroke={colors.border} strokeDasharray={tick === 0 ? undefined : '3 3'} />, <SvgText key={`label-${tick}`} x={chartLeft - 5} y={y + 4} fill={colors.textSecondary} fontSize="10" textAnchor="end">{formatMilk(tick)}</SvgText>]; })}
        <Line x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartBottom} stroke={colors.border} />
        <Polyline points={linePoints} fill="none" stroke="#059669" strokeWidth="3" />
        {points.map((point, index) => <Circle key={point.milkDate} cx={pointX(index)} cy={milkY(point.averageMl)} r="3.5" fill="#059669" />)}
      </Svg>
      <View style={styles.chartLabels}>{points.map((point) => <Text key={point.milkDate} style={[styles.chartLabel, { color: colors.textSecondary }]}>{formatFarmDate(point.milkDate)}</Text>)}</View>
    </View>
  </ScrollView>;
}

function QualityLineChart({ records, value, colors }: { records: MilkQualityRecord[]; value: 'fat' | 'snf'; colors: typeof Colors.light | typeof Colors.dark }) {
  const dates = [...new Set(records.map((record) => record.milkDate))].sort();
  const morning = new Map(records.filter((record) => record.session === 'morning').map((record) => [record.milkDate, (value === 'fat' ? record.fatHundredths : record.snfHundredths) === null ? null : (value === 'fat' ? record.fatHundredths : record.snfHundredths)! / 100]));
  const evening = new Map(records.filter((record) => record.session === 'evening').map((record) => [record.milkDate, (value === 'fat' ? record.fatHundredths : record.snfHundredths) === null ? null : (value === 'fat' ? record.fatHundredths : record.snfHundredths)! / 100]));
  const values = [...morning.values(), ...evening.values()].filter((item): item is number => item !== null);
  const minimum = Math.floor(Math.min(...values) * 10) / 10 - 0.1;
  const maximum = Math.ceil(Math.max(...values) * 10) / 10 + 0.1;
  const left = 36; const top = 12; const bottom = 118; const width = Math.max(280, left + dates.length * 52);
  const x = (date: string) => left + dates.indexOf(date) * 52;
  const y = (amount: number) => bottom - ((amount - minimum) / Math.max(0.1, maximum - minimum)) * (bottom - top);
  const renderLine = (entries: Map<string, number | null>, color: string, label: string) => { const points = dates.filter((date) => entries.get(date) !== null && entries.get(date) !== undefined).map((date) => `${x(date)},${y(entries.get(date)!)}`).join(' '); return <Fragment key={label}>{points ? <Polyline points={points} fill="none" stroke={color} strokeWidth="3" /> : null}{dates.filter((date) => entries.get(date) !== null && entries.get(date) !== undefined).map((date) => <Circle key={`${label}-${date}`} cx={x(date)} cy={y(entries.get(date)!)} r="3.5" fill={color} />)}</Fragment>; };
  return <><View style={styles.qualityLegend}><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} /><Text style={{ color: colors.textSecondary }}>Morning</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#D9468B' }]} /><Text style={{ color: colors.textSecondary }}>Evening</Text></View></View><ScrollView horizontal showsHorizontalScrollIndicator><View><Svg width={width} height={138}><Line x1={left} y1={top} x2={left} y2={bottom} stroke={colors.border} /><Line x1={left} y1={bottom} x2={width - 8} y2={bottom} stroke={colors.border} /><SvgText x={left - 5} y={top + 4} textAnchor="end" fontSize="10" fill={colors.textSecondary}>{maximum.toFixed(1)}</SvgText><SvgText x={left - 5} y={bottom + 4} textAnchor="end" fontSize="10" fill={colors.textSecondary}>{minimum.toFixed(1)}</SvgText>{renderLine(morning, '#2563EB', 'morning')}{renderLine(evening, '#D9468B', 'evening')}</Svg><View style={styles.chartLabels}>{dates.map((date) => <Text key={date} style={[styles.chartLabel, { color: colors.textSecondary }]}>{formatFarmDate(date)}</Text>)}</View></View></ScrollView></>;
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
  shiftNavigation: { flexDirection: 'row', justifyContent: 'space-between' },
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
  qualityTable: { gap: 0 },
  qualityTableRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40, borderBottomWidth: StyleSheet.hairlineWidth },
  qualityTableHeader: { minHeight: 34 },
  qualityDateColumn: { flex: 1.6, fontSize: 13 },
  qualityValueColumn: { flex: 0.7, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  qualityTableHeading: { fontWeight: '800', textTransform: 'uppercase', fontSize: 11 },
  graphCopy: { fontSize: 13, lineHeight: 19 },
  qualityGraphTitle: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  qualityLegend: { flexDirection: 'row', gap: 16 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  rangeButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  rangeButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  selectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  selectionLabel: { fontSize: 14, fontWeight: '800' },
  animalChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  animalChoice: { minHeight: 36, borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  chartLabels: { flexDirection: 'row', paddingLeft: 44 },
  chartLabel: { width: 52, fontSize: 10, textAlign: 'center' },
  animal: { fontSize: 15, fontWeight: '700' },
  sessions: { fontSize: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  detailCopy: { flex: 1, gap: 3 },
  exportCopy: { fontSize: 13, lineHeight: 19 },
  diaryInput: { borderWidth: 1, borderRadius: 12, minHeight: 76, padding: 12, textAlignVertical: 'top' },
  diaryActions: { gap: 10 },
  disabled: { opacity: 0.45 },
});
