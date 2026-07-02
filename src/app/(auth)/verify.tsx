import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { ApiError } from '@/services/api/client';
import { useSession } from '@/services/auth/session-context';

const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const { email, autoResend } = useLocalSearchParams<{ email: string; autoResend?: string }>();
  const { verifyEmail, resendOtp } = useSession();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const canSubmit = code.trim().length === CODE_LENGTH && !submitting;

  async function onVerify() {
    if (!canSubmit || !email) {
      return;
    }
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      // On success the session becomes authenticated and the root guard
      // switches to (app) automatically.
      await verifyEmail(email, code.trim());
    } catch (e) {
      setError(e instanceof ApiError ? e.errors.join('\n') : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (resending || !email) {
      return;
    }
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      await resendOtp(email);
      setInfo('A new code has been sent to your email.');
    } catch (e) {
      setError(e instanceof ApiError ? e.errors.join('\n') : 'Could not resend the code. Please try again.');
    } finally {
      setResending(false);
    }
  }

  // When arriving from sign-in (unverified account), send a fresh code once.
  const autoResendDone = useRef(false);
  useEffect(() => {
    if (autoResend === '1' && email && !autoResendDone.current) {
      autoResendDone.current = true;
      onResend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoResend, email]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.form}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Verify your email</ThemedText>
            <ThemedText themeColor="textSecondary">
              Enter the {CODE_LENGTH}-digit code we sent to {email ?? 'your email'}.
            </ThemedText>
          </View>

          <TextField
            label="Verification code"
            value={code}
            onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH))}
            keyboardType="number-pad"
            inputMode="numeric"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={CODE_LENGTH}
            onSubmitEditing={onVerify}
            returnKeyType="go"
          />

          {error && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}
          {info && (
            <ThemedText type="small" themeColor="textSecondary">
              {info}
            </ThemedText>
          )}

          <PrimaryButton title="Verify" loading={submitting} disabled={!canSubmit} onPress={onVerify} />

          <View style={styles.footer}>
            <ThemedText type="small" themeColor="textSecondary">
              Didn&apos;t get a code?{' '}
            </ThemedText>
            <ThemedText type="linkPrimary" onPress={onResend}>
              {resending ? 'Sending…' : 'Resend'}
            </ThemedText>
          </View>

          <View style={styles.footer}>
            <Link href="/sign-in" replace>
              <ThemedText type="linkPrimary">Back to sign in</ThemedText>
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
