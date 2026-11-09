import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { getCalendarPhaseSummary } from '@/lib/database';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

export default function CalendarScreen() {
  const [displayDate, setDisplayDate] = useState(new Date());
  const [periodDays, setPeriodDays] = useState<Set<string>>(new Set());
  const [fertileDays, setFertileDays] = useState<Set<string>>(new Set());
  const [ovulationDays, setOvulationDays] = useState<Set<string>>(new Set());
  const [safeDays, setSafeDays] = useState<Set<string>>(new Set());

  const loadMonthData = useCallback(async (targetDate: Date) => {
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    const summary = await getCalendarPhaseSummary(toIsoDate(monthStart), toIsoDate(monthEnd));

    setPeriodDays(new Set(summary.periodDays));
    setFertileDays(new Set(summary.fertileDays));
    setOvulationDays(new Set(summary.ovulationDays));
    setSafeDays(new Set(summary.safeDays));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMonthData(displayDate);
    }, [displayDate, loadMonthData])
  );

  const monthLabel = useMemo(
    () => displayDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [displayDate]
  );

  const monthGrid = useMemo(() => {
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const items: (Date | null)[] = Array.from({ length: firstDayOfMonth }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      items.push(new Date(year, month, day));
    }
    while (items.length % 7 !== 0) {
      items.push(null);
    }
    return items;
  }, [displayDate]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() - 1, 1))}>
          <Text style={styles.navButton}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={() => setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 1))}>
          <Text style={styles.navButton}>›</Text>
        </Pressable>
      </View>

      <View style={styles.calendarCard}>
        <View style={styles.weekHeader}>
          {WEEKDAY_LABELS.map((label) => (
            <Text key={label} style={styles.weekday}>
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {monthGrid.map((day, index) => {
            if (!day) {
              return <View key={`empty-${index}`} style={[styles.dayCell, styles.emptyCell]} />;
            }

            const dateKey = toIsoDate(day);
            const isPeriodDay = periodDays.has(dateKey);
            const isFertileDay = fertileDays.has(dateKey);
            const isOvulationDay = ovulationDays.has(dateKey);
            const isSafeDay = safeDays.has(dateKey);

            return (
              <View
                key={dateKey}
                style={[
                  styles.dayCell,
                  isSafeDay && styles.safeDay,
                  isFertileDay && styles.fertileDay,
                  isOvulationDay && styles.ovulationDay,
                  isPeriodDay && styles.periodDay,
                ]}>
                <Text style={[styles.dayNumber, (isPeriodDay || isOvulationDay) && styles.accentDayText]}>
                  {day.getDate()}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.legend}>
        <Legend color="#E86B7B" label="Period days" />
        <Legend color="#A58BEE" label="Fertile window" />
        <Legend color="#6D4FC2" label="Ovulation day" />
        <Legend color="#BFE8C9" label="Safe days / low-risk window" />
      </View>
    </ScrollView>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF9F7',
  },
  content: {
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    fontSize: 30,
    color: '#865861',
    width: 34,
    textAlign: 'center',
  },
  monthLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3F3235',
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderColor: '#F1DBDF',
    borderWidth: 1,
    padding: 10,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: '#876268',
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  dayCell: {
    width: '13.4%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFCFD',
  },
  emptyCell: {
    backgroundColor: 'transparent',
  },
  dayNumber: {
    color: '#5D4449',
    fontSize: 14,
  },
  safeDay: {
    backgroundColor: '#BFE8C9',
  },
  fertileDay: {
    backgroundColor: '#DCD3F8',
  },
  ovulationDay: {
    backgroundColor: '#6D4FC2',
  },
  periodDay: {
    backgroundColor: '#E86B7B',
  },
  accentDayText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  legend: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1DBDF',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  legendText: {
    color: '#684A51',
  },
});
