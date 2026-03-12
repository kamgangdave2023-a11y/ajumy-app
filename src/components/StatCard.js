import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';

export default function StatCard({ value, label, color = '#1F3864', small = false }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View style={[
      styles.card,
      { backgroundColor: color },
      isDesktop && styles.cardDesktop,
      small && styles.cardSmall,
    ]}>
      <Text style={[styles.value, isDesktop && styles.valueDesktop]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1, borderRadius: 12, padding: 14,
    alignItems: 'center', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4,
  },
  cardDesktop: { padding: 20, borderRadius: 16 },
  cardSmall: { padding: 10 },
  value: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  valueDesktop: { fontSize: 28 },
  label: { color: '#D6E4F0', fontSize: 10, marginTop: 4, textAlign: 'center' },
});