/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * Updated to a modern materialistic design system.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1C1B1F', // Material On-Surface
    background: '#FEFBFF', // Material Surface
    backgroundElement: '#F2EDF7', // Material Surface Container
    backgroundSelected: '#EADDFF', // Material Secondary Container
    textSecondary: '#49454F', // Material On-Surface Variant
    primary: '#6750A4', // Material Primary (Indigo/Purple)
    onPrimary: '#FFFFFF',
    card: '#FFFFFF', // Material Surface (slightly elevated)
  },
  dark: {
    text: '#E6E1E5',
    background: '#1C1B1F',
    backgroundElement: '#2B2930', // Elevated Surface
    backgroundSelected: '#4A4458',
    textSecondary: '#CAC4D0',
    primary: '#D0BCFF', // Material Primary Light
    onPrimary: '#381E72',
    card: '#211F26', 
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BorderRadius = {
  small: 8,
  medium: 12,
  large: 16,
  pill: 9999,
} as const;

export const Shadows = {
  light: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
  },
  dark: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 4,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 8,
    },
  }
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
