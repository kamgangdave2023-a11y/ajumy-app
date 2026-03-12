import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  useWindowDimensions, Platform
} from 'react-native';

export default function AppHeader({
  title, onBack, rightLabel, onRight, rightColor = '#FFD700', color = '#1F3864'
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View style={[styles.header, { backgroundColor: color },
      isDesktop && styles.headerDesktop
    ]}>
      <View style={[styles.inner, isDesktop && { maxWidth: 900, alignSelf: 'center', width: '100%' }]}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
        ) : <View style={styles.backBtn} />}

        <Text style={[styles.title, isDesktop && styles.titleDesktop]}>{title}</Text>

        {rightLabel ? (
          <TouchableOpacity onPress={onRight} style={styles.rightBtn}>
            <Text style={[styles.rightText, { color: rightColor }]}>{rightLabel}</Text>
          </TouchableOpacity>
        ) : <View style={styles.backBtn} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === 'web' ? 16 : 40,
    paddingBottom: 12,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  headerDesktop: {
    paddingTop: 16,
    paddingHorizontal: 40,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { minWidth: 70 },
  backText: { color: '#D6E4F0', fontSize: 14 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center', flex: 1 },
  titleDesktop: { fontSize: 22 },
  rightBtn: { minWidth: 70, alignItems: 'flex-end' },
  rightText: { fontSize: 14, fontWeight: 'bold' },
});