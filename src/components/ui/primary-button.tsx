import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PrimaryButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  loading?: boolean;
};

export function PrimaryButton({ title, loading, disabled, style, ...rest }: PrimaryButtonProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDisabled = disabled || loading;

  const shadowStyle = Shadows[colorScheme === 'dark' ? 'dark' : 'light'].small;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={(state) => [
        styles.button,
        { backgroundColor: theme.primary },
        shadowStyle,
        isDisabled && styles.disabled,
        state.pressed && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={theme.onPrimary} />
      ) : (
        <ThemedText style={[styles.label, { color: theme.onPrimary }]}>{title}</ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }], // subtle micro-animation
  },
  label: {
    fontWeight: '700',
    fontSize: 16,
  },
});
