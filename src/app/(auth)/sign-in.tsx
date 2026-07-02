import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { ApiError } from '@/services/api/client';
import { useSession } from '@/services/auth/session-context';

export default function SignInScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function onSubmit() {
    if (!canSubmit) {
      return;
    }
    setError(null);
    setSubmitting(true);
    const trimmedEmail = email.trim();
    try {
      // On success the session updates and the root guard switches to (app).
      await signIn(trimmedEmail, password);
    } catch (e) {
      // 403 => credentials are valid but the email isn't verified yet.
      if (e instanceof ApiError && e.status === 403) {
        router.push({ pathname: '/verify', params: { email: trimmedEmail, autoResend: '1' } });
        return;
      }
      setError(e instanceof ApiError ? e.errors.join('\n') : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.form}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Welcome back</ThemedText>
            <ThemedText themeColor="textSecondary">Sign in to continue.</ThemedText>
          </View>

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            placeholder="you@example.com"
          />

          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoComplete="current-password"
            secureTextEntry
            placeholder="Your password"
            onSubmitEditing={onSubmit}
            returnKeyType="go"
          />

          {error && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}

          <PrimaryButton title="Sign in" loading={submitting} disabled={!canSubmit} onPress={onSubmit} />

          <View style={styles.footer}>
            <ThemedText type="small" themeColor="textSecondary">
              Don&apos;t have an account?{' '}
            </ThemedText>
            <Link href="/sign-up" replace>
              <ThemedText type="linkPrimary">Sign up</ThemedText>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },
  header: {
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  error: {
    color: '#E5484D',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
