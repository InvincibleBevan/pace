import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';

export type FlowLevel = 'none' | 'light' | 'medium' | 'heavy';
export type Mood = 'happy' | 'neutral' | 'sad' | 'irritable' | 'anxious';
export type Symptom = 'cramps' | 'acne' | 'headache' | 'fatigue';

export type DailyLog = {
  id: number;
  date: string;
  flowLevel: FlowLevel;
  symptoms: Symptom[];
  mood: Mood | '';
  notes: string;
};

export type CycleStatistics = {
  averageCycleLength: number;
  symptomFrequency: Record<Symptom, number>;
  cycleStarts: string[];
  currentCycleStart: string | null;
  currentCycleDay: number | null;
  predictedPeriodStarts: string[];
  daysUntilNextPeriod: number | null;
};

export type CalendarPhaseSummary = {
  periodDays: string[];
  fertileDays: string[];
  ovulationDays: string[];
  safeDays: string[];
};

const DB_NAME = 'pace.db';
const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;
const PREDICTION_WINDOW = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let dbPromise: Promise<SQLiteDatabase> | null = null;
let initializedPromise: Promise<void> | null = null;

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * ONE_DAY_MS);
const diffDays = (start: Date, end: Date) => Math.floor((end.getTime() - start.getTime()) / ONE_DAY_MS);

const parseSymptoms = (raw: string): Symptom[] => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed.filter(Boolean) as Symptom[]) : [];
  } catch {
    return [];
  }
};

const mapRowToLog = (row: {
  id: number;
  date: string;
  flow_level: FlowLevel;
  symptoms: string;
  mood: Mood | '';
  notes: string;
}): DailyLog => ({
  id: row.id,
  date: row.date,
  flowLevel: row.flow_level,
  symptoms: parseSymptoms(row.symptoms),
  mood: row.mood,
  notes: row.notes,
});

const getDb = async () => {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
};

const ensureInitialized = async () => {
  if (!initializedPromise) {
    initializedPromise = (async () => {
      const db = await getDb();
      await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS user_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      flow_level TEXT NOT NULL DEFAULT 'none',
      symptoms TEXT NOT NULL DEFAULT '[]',
      mood TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT OR IGNORE INTO user_profile (id, name) VALUES (1, '');
  `);
    })();
  }
  await initializedPromise;
};

export const initializeDatabase = async () => {
  await ensureInitialized();
};

export const upsertDailyLog = async (input: Omit<DailyLog, 'id'>) => {
  await ensureInitialized();
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO user_logs (date, flow_level, symptoms, mood, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(date) DO UPDATE SET
      flow_level = excluded.flow_level,
      symptoms = excluded.symptoms,
      mood = excluded.mood,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP;`,
    input.date,
    input.flowLevel,
    JSON.stringify(input.symptoms),
    input.mood,
    input.notes
  );
};

export const getLogsByDateRange = async (startDate: string, endDate: string): Promise<DailyLog[]> => {
  await ensureInitialized();
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    date: string;
    flow_level: FlowLevel;
    symptoms: string;
    mood: Mood | '';
    notes: string;
  }>(
    `SELECT id, date, flow_level, symptoms, mood, notes
     FROM user_logs
     WHERE date BETWEEN ? AND ?
     ORDER BY date ASC;`,
    startDate,
    endDate
  );
  return rows.map(mapRowToLog);
};

export const getLogForDate = async (date: string): Promise<DailyLog | null> => {
  await ensureInitialized();
  const db = await getDb();
  const row = await db.getFirstAsync<{
    id: number;
    date: string;
    flow_level: FlowLevel;
    symptoms: string;
    mood: Mood | '';
    notes: string;
  }>(
    `SELECT id, date, flow_level, symptoms, mood, notes
     FROM user_logs
     WHERE date = ?;`,
    date
  );

  return row ? mapRowToLog(row) : null;
};

export const getUserName = async (): Promise<string | null> => {
  await ensureInitialized();
  const db = await getDb();
  const row = await db.getFirstAsync<{ name: string }>(`SELECT name FROM user_profile WHERE id = 1;`);
  const trimmed = row?.name?.trim() ?? '';
  return trimmed.length ? trimmed : null;
};

export const saveUserName = async (name: string) => {
  await ensureInitialized();
  const db = await getDb();
  const trimmedName = name.trim();
  await db.runAsync(
    `INSERT INTO user_profile (id, name, updated_at)
     VALUES (1, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      updated_at = CURRENT_TIMESTAMP;`,
    trimmedName
  );
};

const getPeriodDayDates = (logs: DailyLog[]) =>
  logs
    .filter((log) => log.flowLevel !== 'none')
    .map((log) => log.date)
    .sort((a, b) => a.localeCompare(b));

const getCycleStarts = (periodDates: string[]) => {
  if (!periodDates.length) {
    return [];
  }

  const starts: string[] = [periodDates[0]];
  for (let i = 1; i < periodDates.length; i += 1) {
    const previous = new Date(periodDates[i - 1]);
    const current = new Date(periodDates[i]);
    if (diffDays(previous, current) > 1) {
      starts.push(periodDates[i]);
    }
  }
  return starts;
};

export const calculateCycleStatistics = async (): Promise<CycleStatistics> => {
  await ensureInitialized();
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    date: string;
    flow_level: FlowLevel;
    symptoms: string;
    mood: Mood | '';
    notes: string;
  }>(
    `SELECT id, date, flow_level, symptoms, mood, notes
     FROM user_logs
     ORDER BY date ASC;`
  );
  const logs = rows.map(mapRowToLog);
  const periodDates = getPeriodDayDates(logs);
  const cycleStarts = getCycleStarts(periodDates);

  const cycleLengths: number[] = [];
  for (let i = 1; i < cycleStarts.length; i += 1) {
    cycleLengths.push(diffDays(new Date(cycleStarts[i - 1]), new Date(cycleStarts[i])));
  }

  const averageCycleLength =
    cycleLengths.length > 0
      ? Math.round(cycleLengths.reduce((sum, value) => sum + value, 0) / cycleLengths.length)
      : DEFAULT_CYCLE_LENGTH;

  const symptomFrequency: Record<Symptom, number> = {
    cramps: 0,
    acne: 0,
    headache: 0,
    fatigue: 0,
  };

  logs.forEach((log) => {
    log.symptoms.forEach((symptom) => {
      if (symptom in symptomFrequency) {
        symptomFrequency[symptom] += 1;
      }
    });
  });

  const today = new Date();
  const currentCycleStart = cycleStarts.length ? cycleStarts[cycleStarts.length - 1] : null;
  const currentCycleDay = currentCycleStart ? diffDays(new Date(currentCycleStart), today) + 1 : null;

  const predictedPeriodStarts: string[] = [];
  if (currentCycleStart) {
    const lastStart = new Date(currentCycleStart);
    for (let i = 1; i <= PREDICTION_WINDOW; i += 1) {
      predictedPeriodStarts.push(toIsoDate(addDays(lastStart, averageCycleLength * i)));
    }
  }

  let daysUntilNextPeriod: number | null = null;
  if (predictedPeriodStarts.length) {
    const nextStart = new Date(predictedPeriodStarts[0]);
    daysUntilNextPeriod = Math.max(0, diffDays(today, nextStart));
  }

  return {
    averageCycleLength,
    symptomFrequency,
    cycleStarts,
    currentCycleStart,
    currentCycleDay,
    predictedPeriodStarts,
    daysUntilNextPeriod,
  };
};

export const getCalendarPhaseSummary = async (startDate: string, endDate: string): Promise<CalendarPhaseSummary> => {
  const [logs, stats] = await Promise.all([getLogsByDateRange(startDate, endDate), calculateCycleStatistics()]);

  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);
  const periodLoggedDays = new Set(logs.filter((log) => log.flowLevel !== 'none').map((log) => log.date));

  const periodDays = new Set<string>(periodLoggedDays);
  const fertileDays = new Set<string>();
  const ovulationDays = new Set<string>();
  const safeDays = new Set<string>();

  if (!stats.cycleStarts.length) {
    return {
      periodDays: [],
      fertileDays: [],
      ovulationDays: [],
      safeDays: [],
    };
  }

  const cycleStartDates = stats.cycleStarts.map((date) => new Date(date)).sort((a, b) => a.getTime() - b.getTime());
  const cycleLength = Math.max(21, stats.averageCycleLength);
  const extensionStart = addDays(rangeStart, -cycleLength);
  const extensionEnd = addDays(rangeEnd, cycleLength);

  while (cycleStartDates[0].getTime() > extensionStart.getTime()) {
    cycleStartDates.unshift(addDays(cycleStartDates[0], -cycleLength));
  }
  while (cycleStartDates[cycleStartDates.length - 1].getTime() < extensionEnd.getTime()) {
    cycleStartDates.push(addDays(cycleStartDates[cycleStartDates.length - 1], cycleLength));
  }

  for (const cycleStart of cycleStartDates) {
    for (let dayOffset = 0; dayOffset < DEFAULT_PERIOD_LENGTH; dayOffset += 1) {
      const date = addDays(cycleStart, dayOffset);
      if (date.getTime() >= rangeStart.getTime() && date.getTime() <= rangeEnd.getTime()) {
        periodDays.add(toIsoDate(date));
      }
    }
  }

  const ovulationCycleDay = Math.max(1, cycleLength - 14);
  const fertileStartCycleDay = Math.max(1, ovulationCycleDay - 5);
  const fertileEndCycleDay = Math.min(cycleLength, ovulationCycleDay + 1);

  for (let date = new Date(rangeStart); date.getTime() <= rangeEnd.getTime(); date = addDays(date, 1)) {
    const dateKey = toIsoDate(date);

    let cycleStartForDay = cycleStartDates[0];
    for (let i = 1; i < cycleStartDates.length; i += 1) {
      if (cycleStartDates[i].getTime() <= date.getTime()) {
        cycleStartForDay = cycleStartDates[i];
      } else {
        break;
      }
    }

    const cycleDay = diffDays(cycleStartForDay, date) + 1;
    const isOvulation = cycleDay === ovulationCycleDay;
    const isFertile = cycleDay >= fertileStartCycleDay && cycleDay <= fertileEndCycleDay;
    const isPeriod = periodDays.has(dateKey);

    if (isPeriod) {
      continue;
    }

    if (isOvulation) {
      ovulationDays.add(dateKey);
      fertileDays.add(dateKey);
      continue;
    }

    if (isFertile) {
      fertileDays.add(dateKey);
      continue;
    }

    safeDays.add(dateKey);
  }

  return {
    periodDays: [...periodDays].sort(),
    fertileDays: [...fertileDays].sort(),
    ovulationDays: [...ovulationDays].sort(),
    safeDays: [...safeDays].sort(),
  };
};

export const exportLogsAsJson = async (): Promise<string> => {
  await ensureInitialized();
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    date: string;
    flow_level: FlowLevel;
    symptoms: string;
    mood: Mood | '';
    notes: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, date, flow_level, symptoms, mood, notes, created_at, updated_at
     FROM user_logs
     ORDER BY date ASC;`
  );

  const name = await getUserName();

  const payload = {
    exportedAt: new Date().toISOString(),
    profile: {
      name,
    },
    logs: rows.map((row) => ({
      ...row,
      symptoms: parseSymptoms(row.symptoms),
    })),
  };

  return JSON.stringify(payload, null, 2);
};

export const exportDatabaseToShareSheet = async () => {
  const json = await exportLogsAsJson();
  const fileUri = `${FileSystem.cacheDirectory}pace-backup-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(fileUri, json);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export Pace data',
      UTI: 'public.json',
    });
  }

  return fileUri;
};
