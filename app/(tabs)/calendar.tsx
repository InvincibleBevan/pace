import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { calculateCycleStatistics, getLogsByDateRange } from '@/lib/database';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PREDICTED_PERIOD_LENGTH = 5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * ONE_DAY_MS);

export default function CalendarScreen() {
  const [displayDate, setDisplayDate] = useState(new Date());
  const [periodDays, setPeriodDays] = useState<Set<string>>(new Set());
  const [currentCycleWindow, setCurrentCycleWindow] = useState<Set<string>>(new Set());
  const [predictedDays, setPredictedDays] = useState<Set<string>>(new Set());

  const loadMonthData = useCallback(async (targetDate: Date) => {
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    const [logs, stats] = await Promise.all([
      getLogsByDateRange(toIsoDate(monthStart), toIsoDate(monthEnd)),
      calculateCycleStatistics(),
    ]);

    setPeriodDays(new Set(logs.filter((log) => log.flowLevel !== 'none').map((log) => log.date)));

    const cycleWindow = new Set<string>();
    if (stats.currentCycleStart) {
      const start = new Date(stats.currentCycleStart);
      for (let i = 0; i < stats.averageCycleLength; i += 1) {
        cycleWindow.add(toIsoDate(addDays(start, i)));
      }
    }
    setCurrentCycleWindow(cycleWindow);

    const predictedWindow = new Set<string>();
    stats.predictedPeriodStarts.forEach((dateString) => {
      const start = new Date(dateString);
      for (let i = 0; i < PREDICTED_PERIOD_LENGTH; i += 1) {
        predictedWindow.add(toIsoDate(addDays(start, i)));
      }
    });
    setPredictedDays(predictedWindow);
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
            const isCurrentCycleDay = currentCycleWindow.has(dateKey);
            const isPredictedDay = predictedDays.has(dateKey);

            return (
              <View
                key={dateKey}
                style={[
                  styles.dayCell,
                  isCurrentCycleDay && styles.currentCycleDay,
                  isPredictedDay && styles.predictedDay,
                  isPeriodDay && styles.periodDay,
                ]}>
                <Text style={[styles.dayNumber, isPeriodDay && styles.periodDayText]}>{day.getDate()}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.legend}>
        <Legend color="#E86B7B" label="Logged period days" />
        <Legend color="#F4E2E5" label="Current cycle window" />
        <Legend color="#F6C6CF" label="Predicted periods" border />
      </View>
    </ScrollView>
  );
}

function Legend({ color, label, border = false }: { color: string; label: string; border?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }, border && styles.legendSwatchBorder]} />
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
  currentCycleDay: {
    backgroundColor: '#F4E2E5',
  },
  predictedDay: {
    borderWidth: 1,
    borderColor: '#F6C6CF',
  },
  periodDay: {
    backgroundColor: '#E86B7B',
  },
  periodDayText: {
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
  legendSwatchBorder: {
    borderWidth: 1,
    borderColor: '#EAAAB5',
  },
  legendText: {
    color: '#684A51',
  },
});
