import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance } from 'react-native';

import { describeAuthError, hasErrors, validateLogin, type FieldErrors } from '@/auth/authForm';
import { useAuth } from '@/auth/AuthContext';
import { AuthShell, FormBanner } from '@/components/auth/AuthShell';
import { Button, Text, TextField } from '@/components/ui';
import { colors, typeScale } from '@/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  const submit = async () => {
    if (submitting) return;
    const errors = validateLogin(username, password);
    setFieldErrors(errors);
    setFormError(null);
    if (hasErrors(errors)) return;
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      // The root guard swaps to the tabs once the session is set.
    } catch (err) {
      const { fields, form } = describeAuthError(err, 'login');
      setFieldErrors(fields);
      setFormError(form);
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      testID="login-screen"
      eyebrow="Welcome back"
      title="Log in to keep your streak"
      footer={
        <Text variant="body" tone="muted" align="center">
          New to Loopy?{' '}
          <Link href="/register" replace style={styles.link}>
            Create an account
          </Link>
        </Text>
      }
    >
      {formError ? <FormBanner message={formError} /> : null}
      <TextField
        testID="login-username"
        label="Username"
        placeholder="e.g. bode_fan"
        value={username}
        onChangeText={(v) => {
          setUsername(v);
          if (fieldErrors.username) setFieldErrors((e) => ({ ...e, username: undefined }));
        }}
        error={fieldErrors.username}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        autoFocus
      />
      <TextField
        ref={passwordRef}
        testID="login-password"
        label="Password"
        placeholder="Your password"
        secure
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: undefined }));
        }}
        error={fieldErrors.password}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button testID="login-submit" label={submitting ? 'Logging in' : 'Log in'} loading={submitting} onPress={submit} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  link: { ...typeScale.bodyStrong, color: colors.primary.base },
});
