import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { useColorScheme } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius } from '@/constants/theme';

export function BlurLoader() {
  const colorScheme = useColorScheme();
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <GlassView 
        style={styles.blurView} 
        tint={colorScheme === 'dark' ? 'dark' : 'light'} 
        intensity={60}
      >
        <View style={[styles.indicatorContainer, { backgroundColor: theme.card }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  blurView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorContainer: {
    padding: 24,
    borderRadius: BorderRadius.large,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
});
