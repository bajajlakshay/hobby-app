import { Alert, Platform } from 'react-native';

type ConfirmOptions = {
  title: string;
  message?: string;
  /** Label of the destructive action button, e.g. "Delete". */
  confirmLabel: string;
};

/**
 * Asks the user to confirm a destructive action. Resolves `true` only when the
 * destructive option is explicitly chosen. Uses the native alert on iOS/Android
 * and `window.confirm` on web (where Alert renders nothing).
 */
export function confirmDestructive({ title, message, confirmLabel }: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(globalThis.confirm?.(text) ?? true);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
