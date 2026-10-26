/**
 * Validation and error copy shared by the login and register screens.
 * Rules mirror the server: username `^[a-zA-Z0-9_]{3,20}$`, password >= 8.
 */
import { ApiError, NETWORK_ERROR_STATUS } from '@/api/client';
import { API_URL } from '@/config';

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
export const MIN_PASSWORD_LENGTH = 8;

export type FieldErrors = { username?: string; password?: string };

/** Where a server error belongs: next to a field, or in the form-level banner. */
export type SubmitError = { fields: FieldErrors; form: string | null };

export function validateLogin(username: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!username.trim()) errors.username = 'Enter your username.';
  if (!password) errors.password = 'Enter your password.';
  return errors;
}

export function validateRegister(username: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const name = username.trim();
  if (!name) errors.username = 'Pick a username.';
  else if (!USERNAME_PATTERN.test(name)) errors.username = 'Use 3–20 letters, numbers or underscores.';
  if (!password) errors.password = 'Choose a password.';
  else if (password.length < MIN_PASSWORD_LENGTH)
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  return errors;
}

export const hasErrors = (errors: FieldErrors) => Object.values(errors).some(Boolean);

export function networkErrorMessage(): string {
  return `Can’t reach the Loopy server at ${API_URL}. Make sure the API is running and try again.`;
}

export function describeAuthError(err: unknown, mode: 'login' | 'register'): SubmitError {
  const status = err instanceof ApiError ? err.status : NETWORK_ERROR_STATUS;
  if (status === NETWORK_ERROR_STATUS) return { fields: {}, form: networkErrorMessage() };
  if (mode === 'register' && status === 409) {
    return { fields: { username: 'Username taken. Try another one.' }, form: null };
  }
  if (mode === 'login' && status === 401) {
    return { fields: {}, form: 'Wrong username or password. Check both and try again.' };
  }
  if (status === 400) {
    // Server-side validation; its message names the problem.
    return { fields: {}, form: err instanceof ApiError && err.message ? err.message : 'Check your username and password.' };
  }
  if (status === 429) return { fields: {}, form: 'Too many attempts. Wait a minute, then try again.' };
  return { fields: {}, form: `Something went wrong on our side (${status}). Try again in a moment.` };
}
