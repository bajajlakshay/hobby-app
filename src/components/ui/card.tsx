import { View, StyleSheet, useColorScheme, type ViewProps } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, Shadows, Spacing } from '@/constants/theme';

type CardProps = ViewProps & {
  elevationLevel?: 'small' | 'medium' | 'large';
};

export function Card({ style, elevationLevel = 'small', children, ...rest }: CardProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  
  const shadowStyle = Shadows[colorScheme === 'dark' ? 'dark' : 'light'][elevationLevel];

  return (
    <View 
      style={[
        styles.card, 
        { backgroundColor: theme.card },
        shadowStyle,
        style
      ]} 
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.medium,
    padding: Spacing.three,
  }
});
