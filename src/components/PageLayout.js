import React from 'react';
import {
  View, ScrollView, StyleSheet, useWindowDimensions
} from 'react-native';

export default function PageLayout({ children, scrollable = true, style }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const content = (
    <View style={[
      styles.container,
      isDesktop && styles.containerDesktop,
      style
    ]}>
      {children}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && styles.scrollContentDesktop
        ]}
      >
        {content}
      </ScrollView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F0F4F8' },
  scrollContent: { flexGrow: 1 },
  scrollContentDesktop: { alignItems: 'center', paddingVertical: 24 },
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  containerDesktop: { width: '100%', maxWidth: 900 },
});