import { StyleSheet, TextInput, View, type TextInputProps, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useState } from 'react';

type TextFieldProps = TextInputProps & {
  label: string;
};

export function TextField({ label, style, onFocus, onBlur, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" style={{ color: isFocused ? theme.primary : theme.textSecondary }}>
        {label}
      </ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          { 
            color: theme.text, 
            backgroundColor: theme.background,
            borderColor: isFocused ? theme.primary : theme.textSecondary,
            borderWidth: isFocused ? 2 : 1,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
    width: '100%',
  },
  input: {
    borderRadius: BorderRadius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
});
