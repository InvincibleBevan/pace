import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  FlowLevel,
  Mood,
  Symptom,
  calculateCycleStatistics,
  getLogForDate,
  upsertDailyLog,
} from '@/lib/database';

const symptoms: Symptom[] = ['cramps', 'acne', 'headache', 'fatigue'];
const flowOptions: FlowLevel[] = ['none', 'light', 'medium', 'heavy'];
const moods: Mood[] = ['happy', 'neutral', 'sad', 'irritable', 'anxious'];

const today = new Date().toISOString().slice(0, 10);

export default function HomeScreen() {
  const [flowLevel, setFlowLevel] = useState<FlowLevel>('none');
  const [selectedSymptoms, setSelectedSymptoms] = useState<Symptom[]>([]);
  const [mood, setMood] = useState<Mood>('neutral');
  const [notes, setNotes] = useState('');
  const [cycleDay, setCycleDay] = useState<number | null>(null);
  const [daysUntilNextPeriod, setDaysUntilNextPeriod] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [existingLog, stats] = await Promise.all([getLogForDate(today), calculateCycleStatistics()]);
    if (existingLog) {
      setFlowLevel(existingLog.flowLevel);
      setSelectedSymptoms(existingLog.symptoms);
      setMood(existingLog.mood || 'neutral');
      setNotes(existingLog.notes);
    }
    setCycleDay(stats.currentCycleDay);
    setDaysUntilNextPeriod(stats.daysUntilNextPeriod);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const cycleText = useMemo(() => (cycleDay ? `Day ${cycleDay}` : 'No cycle data yet'), [cycleDay]);
  const countdownText = useMemo(() => {
    if (daysUntilNextPeriod === null) {
      return 'Add period logs to start prediction';
    }
    return daysUntilNextPeriod === 0
      ? 'Predicted to start today'
      : `${daysUntilNextPeriod} day${daysUntilNextPeriod === 1 ? '' : 's'} to next predicted period`;
  }, [daysUntilNextPeriod]);

  const toggleSymptom = (symptom: Symptom) => {
    setSelectedSymptoms((current) =>
      current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom]
    );
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await upsertDailyLog({
        date: today,
        flowLevel,
        symptoms: selectedSymptoms,
        mood,
        notes: notes.trim(),
      });
      const stats = await calculateCycleStatistics();
      setCycleDay(stats.currentCycleDay);
      setDaysUntilNextPeriod(stats.daysUntilNextPeriod);
      Alert.alert('Saved', 'Today’s log has been stored locally on this device.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current cycle</Text>
        <Text style={styles.cycleDay}>{cycleText}</Text>
        <Text style={styles.countdown}>{countdownText}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Symptoms</Text>
        <View style={styles.chipGrid}>
          {symptoms.map((symptom) => (
            <Pressable
              key={symptom}
              onPress={() => toggleSymptom(symptom)}
              style={[styles.chip, selectedSymptoms.includes(symptom) && styles.chipSelected]}>
              <Text style={[styles.chipText, selectedSymptoms.includes(symptom) && styles.chipTextSelected]}>
                {symptom}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Flow intensity</Text>
        <View style={styles.chipGrid}>
          {flowOptions.map((option) => (
            <Pressable
              key={option}
              onPress={() => setFlowLevel(option)}
              style={[styles.chip, flowLevel === option && styles.chipSelected]}>
              <Text style={[styles.chipText, flowLevel === option && styles.chipTextSelected]}>{option}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mood</Text>
        <View style={styles.chipGrid}>
          {moods.map((option) => (
            <Pressable
              key={option}
              onPress={() => setMood(option)}
              style={[styles.chip, mood === option && styles.chipSelected]}>
              <Text style={[styles.chipText, mood === option && styles.chipTextSelected]}>{option}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="How are you feeling today?"
          multiline
          style={styles.notesInput}
        />
      </View>

      <Pressable onPress={onSave} disabled={saving} style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save today’s log'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF9F7',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFECEF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F6C6CF',
  },
  cardTitle: {
    fontSize: 15,
    color: '#815B63',
    marginBottom: 8,
  },
  cycleDay: {
    fontSize: 30,
    fontWeight: '700',
    color: '#3B2C2F',
  },
  countdown: {
    marginTop: 8,
    color: '#6D5258',
    fontSize: 14,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1DBDF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3F3235',
    marginBottom: 10,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EBCED4',
    backgroundColor: '#FFF9FB',
  },
  chipSelected: {
    backgroundColor: '#E86B7B',
    borderColor: '#E86B7B',
  },
  chipText: {
    color: '#754E55',
    textTransform: 'capitalize',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#EBCED4',
    borderRadius: 10,
    minHeight: 90,
    textAlignVertical: 'top',
    padding: 12,
    color: '#3F3235',
    backgroundColor: '#FFFCFD',
  },
  saveButton: {
    backgroundColor: '#E86B7B',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
