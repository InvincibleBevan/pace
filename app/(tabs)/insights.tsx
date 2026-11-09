import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { calculateCycleStatistics, exportDatabaseToShareSheet } from '@/lib/database';

export default function InsightsScreen() {
  const [averageCycleLength, setAverageCycleLength] = useState(28);
  const [symptomFrequency, setSymptomFrequency] = useState<Record<string, number>>({
    cramps: 0,
    acne: 0,
    headache: 0,
    fatigue: 0,
  });
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const stats = await calculateCycleStatistics();
    setAverageCycleLength(stats.averageCycleLength);
    setSymptomFrequency(stats.symptomFrequency);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onExport = async () => {
    setExporting(true);
    try {
      const fileUri = await exportDatabaseToShareSheet();
      Alert.alert('Export ready', `A local backup has been created:\n${fileUri}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Average cycle length</Text>
        <Text style={styles.cardValue}>{averageCycleLength} days</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Common symptoms frequency</Text>
        {Object.entries(symptomFrequency).map(([symptom, count]) => (
          <View key={symptom} style={styles.statRow}>
            <Text style={styles.statLabel}>{symptom}</Text>
            <Text style={styles.statValue}>{count}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Data & backup</Text>
        <Text style={styles.helperText}>All health data is kept locally in SQLite on this device.</Text>
        <Pressable style={[styles.exportButton, exporting && styles.exportButtonDisabled]} onPress={onExport}>
          <Text style={styles.exportButtonText}>{exporting ? 'Preparing export…' : 'Export Data'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cramp relief guide</Text>
        <Text style={styles.guideSectionTitle}>Medication options</Text>
        <Text style={styles.guideText}>
          Ibuprofen (Brufen/Nurofen) and Paracetamol can help with moderate-to-severe period pain when used exactly as
          directed on the label.
        </Text>
        <Text style={styles.disclaimerText}>
          Important: This app is not medical advice. Follow package instructions, avoid doses above label guidance, and
          talk to a clinician or pharmacist if pain is severe, persistent, or you have other health conditions.
        </Text>

        <Text style={[styles.guideSectionTitle, styles.guideSpacing]}>Kenyan local comfort ideas</Text>
        <Text style={styles.guideText}>• Fresh Ginger Tea (Chai ya Tangawizi) or chamomile tea for calming cramps.</Text>
        <Text style={styles.guideText}>• Bananas (Ndizi) for potassium and magnesium support.</Text>
        <Text style={styles.guideText}>• Freshly cooked Sukuma Wiki or spinach for iron and magnesium.</Text>
        <Text style={styles.guideText}>• Warm water or fresh juices to reduce dehydration-linked cramping.</Text>
      </View>
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
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1DBDF',
    padding: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3F3235',
    marginBottom: 10,
  },
  cardValue: {
    fontSize: 30,
    color: '#E86B7B',
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1DBDF',
  },
  statLabel: {
    color: '#684A51',
    textTransform: 'capitalize',
  },
  statValue: {
    color: '#3F3235',
    fontWeight: '700',
  },
  helperText: {
    color: '#6D5258',
    marginBottom: 14,
  },
  exportButton: {
    backgroundColor: '#E86B7B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  exportButtonDisabled: {
    opacity: 0.7,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  guideSectionTitle: {
    color: '#4E383D',
    fontWeight: '700',
    marginBottom: 4,
  },
  guideSpacing: {
    marginTop: 10,
  },
  guideText: {
    color: '#674C52',
    lineHeight: 20,
    marginBottom: 4,
  },
  disclaimerText: {
    marginTop: 8,
    color: '#7B5960',
    lineHeight: 18,
    fontSize: 12,
  },
});
