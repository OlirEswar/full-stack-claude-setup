import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance } from 'react-native';

import { describeAuthError, hasErrors, MIN_PASSWORD_LENGTH, validateRegister, type FieldErrors } from '@/auth/authForm';
import { useAuth } from '@/auth/AuthContext';
import { AuthShell, FormBanner } from '@/components/auth/AuthShell';
import { Button, Text, TextField } from '@/components/ui';
import { colors, typeScale } from '@/theme';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  const submit = async () => {
    if (submitting) return;
    const errors = validateRegister(username, password);
    setFieldErrors(errors);
    setFormError(null);
    if (hasErrors(errors)) return;
    setSubmitting(true);
    try {
      await register(username.trim(), password);
      // The root guard swaps to the tabs once the session is set.
    } catch (err) {
      const { fields, form } = describeAuthError(err, 'register');
      setFieldErrors(fields);
      setFormError(form);
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      testID="register-screen"
      eyebrow="Start your first loop"
      title="Create your account"
      footer={
        <Text variant="body" tone="muted" align="center">
          Already have an account?{' '}
          <Link href="/login" replace style={styles.link}>
            Log in
          </Link>
        </Text>
      }
    >
      {formError ? <FormBanner message={formError} /> : null}
      <TextField
        testID="register-username"
        label="Username"
        placeholder="e.g. nyquist_nerd"
        hint="3–20 letters, numbers or underscores. Shown on the leaderboard."
        value={username}
        onChangeText={(v) => {
          setUsername(v);
          if (fieldErrors.username) setFieldErrors((e) => ({ ...e, username: undefined }));
        }}
        error={fieldErrors.username}
        autoComplete="username-new"
        textContentType="username"
        maxLength={20}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        autoFocus
      />
      <TextField
        ref={passwordRef}
        testID="register-password"
        label="Password"
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        secure
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: undefined }));
        }}
        error={fieldErrors.password}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button
        testID="register-submit"
        label={submitting ? 'Creating account' : 'Create account'}
        loading={submitting}
        onPress={submit}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  link: { ...typeScale.bodyStrong, color: colors.primary.base },
});
