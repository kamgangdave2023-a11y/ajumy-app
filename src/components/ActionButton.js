import React from 'react';
import {
  TouchableOpacity, Text, StyleSheet,
  ActivityIndicator, useWindowDimensions
} from 'react-native';

export default function ActionButton({
  label, onPress, color = '#1F3864',
  loading = false, outline = false, style
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor: outline ? 'transparent' : color },
        outline && { borderWidth: 1.5, borderColor: color },
        isDesktop && styles.btnDesktop,
        style,
      ]}
      onPress={onPress}
      disabled={loading}
    >
      {loading
        ? <ActivityIndicator color={outline ? color : '#fff'} />
        : <Text style={[styles.label, outline && { color }]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 12, padding: 16,
    alignItems: 'center', marginVertical: 6,
    elevation: 2,
  },
  btnDesktop: { padding: 18, borderRadius: 14 },
  label: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});