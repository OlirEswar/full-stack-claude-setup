import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import * as api from '@/api/client';
import { AuthProvider } from '@/auth/AuthContext';

import { RootNavigator } from '../app/_layout';
import AuthLayout from '../app/(auth)/_layout';
import LoginScreen from '../app/(auth)/login';
import RegisterScreen from '../app/(auth)/register';
import TabsLayout from '../app/(tabs)/_layout';
import HomeScreen from '../app/(tabs)/index';
import ProfileScreen from '../app/(tabs)/profile';

jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  // The home tab's data endpoints stay offline here; these tests only care about routing.
  const offline = () => Promise.reject(new actual.ApiError(0, 'offline'));
  return {
    ...actual,
    login: jest.fn(),
    register: jest.fn(),
    getMe: jest.fn(),
    logout: jest.fn(),
    getPath: jest.fn(offline),
    getDaily: jest.fn(offline),
    getMistakes: jest.fn(offline),
    getStats: jest.fn(offline),
  };
});

let mockStoredToken: string | null = null;
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: {
    getToken: jest.fn(async () => mockStoredToken),
    setToken: jest.fn(async (t: string) => {
      mockStoredToken = t;
    }),
    clearToken: jest.fn(async () => {
      mockStoredToken = null;
    }),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const user = { id: 1, username: 'bode_fan', timezone: 'UTC', dailyXpGoal: 20 };
const authResponse = { token: 'tok-123', user };

function AuthWrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

/** The real route tree, guarded by the real root navigator. */
const routes = {
  _layout: RootNavigator,
  '(auth)/_layout': AuthLayout,
  '(auth)/login': LoginScreen,
  '(auth)/register': RegisterScreen,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': HomeScreen,
  '(tabs)/profile': ProfileScreen,
};

async function renderApp(initialUrl = '/') {
  const result = await renderRouter(routes, { initialUrl, wrapper: AuthWrapper });
  return result;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStoredToken = null;
  mockedApi.getMe.mockResolvedValue({ user } as Awaited<ReturnType<typeof api.getMe>>);
  mockedApi.logout.mockResolvedValue(undefined);
});

describe('route guard', () => {
  it('sends a signed-out user to /login', async () => {
    const app = await renderApp('/');
    expect(await screen.findByTestId('login-screen')).toBeTruthy();
    expect(app.getPathname()).toBe('/login');
  });

  it('sends a returning user with a stored token to the tabs, even if /api/me is unreachable', async () => {
    mockStoredToken = 'tok-old';
    mockedApi.getMe.mockRejectedValue(new api.ApiError(0, 'offline'));
    const app = await renderApp('/login');
    expect(await screen.findByTestId('home-screen')).toBeTruthy();
    expect(app.getPathname()).toBe('/');
  });
});

describe('login screen', () => {
  it('login shows validation error for empty fields', async () => {
    await renderApp('/login');
    await fireEvent.press(await screen.findByTestId('login-submit'));
    expect(await screen.findByText('Enter your username.')).toBeTruthy();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(mockedApi.login).not.toHaveBeenCalled();
  });

  it('login calls api.login with entered credentials', async () => {
    mockedApi.login.mockResolvedValue(authResponse);
    const app = await renderApp('/login');
    await fireEvent.changeText(await screen.findByTestId('login-username'), ' bode_fan ');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'hunter22!');
    await fireEvent.press(screen.getByTestId('login-submit'));
    await waitFor(() => expect(mockedApi.login).toHaveBeenCalledWith({ username: 'bode_fan', password: 'hunter22!' }));
    // Guard swaps to the tabs once the session is set.
    expect(await screen.findByText('Hi, bode_fan!')).toBeTruthy();
    expect(app.getPathname()).toBe('/');
  });

  it('submits from the keyboard (enter on the password field)', async () => {
    mockedApi.login.mockResolvedValue(authResponse);
    await renderApp('/login');
    await fireEvent.changeText(await screen.findByTestId('login-username'), 'bode_fan');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'hunter22!');
    await fireEvent(screen.getByTestId('login-password'), 'submitEditing');
    await waitFor(() => expect(mockedApi.login).toHaveBeenCalledTimes(1));
  });

  it('shows bad credentials (401) as a form error', async () => {
    mockedApi.login.mockRejectedValue(new api.ApiError(401, 'Invalid username or password'));
    await renderApp('/login');
    await fireEvent.changeText(await screen.findByTestId('login-username'), 'bode_fan');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'wrongpass');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText(/Wrong username or password/)).toBeTruthy();
    expect(screen.getByTestId('login-screen')).toBeTruthy();
  });

  it('explains a network error (status 0) and names the API URL', async () => {
    mockedApi.login.mockRejectedValue(new api.ApiError(0, 'offline'));
    await renderApp('/login');
    await fireEvent.changeText(await screen.findByTestId('login-username'), 'bode_fan');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'hunter22!');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText(/Can’t reach the Loopy server at http:\/\/localhost:3000/)).toBeTruthy();
  });
});

describe('register screen', () => {
  async function fillRegister(username: string, password: string) {
    await fireEvent.changeText(await screen.findByTestId('register-username'), username);
    await fireEvent.changeText(screen.getByTestId('register-password'), password);
    await fireEvent.press(screen.getByTestId('register-submit'));
  }

  it('register shows 409 as "Username taken"', async () => {
    mockedApi.register.mockRejectedValue(new api.ApiError(409, 'Username already taken'));
    await renderApp('/register');
    await fillRegister('bode_fan', 'longenough1');
    expect(await screen.findByText(/Username taken/)).toBeTruthy();
    expect(screen.getByTestId('register-screen')).toBeTruthy();
  });

  it('register requires password >= 8 chars', async () => {
    await renderApp('/register');
    await fillRegister('bode_fan', 'short');
    expect(await screen.findByText('Password must be at least 8 characters.')).toBeTruthy();
    expect(mockedApi.register).not.toHaveBeenCalled();
  });

  it('rejects usernames the server would reject', async () => {
    await renderApp('/register');
    await fillRegister('no spaces!', 'longenough1');
    expect(await screen.findByText('Use 3–20 letters, numbers or underscores.')).toBeTruthy();
    expect(mockedApi.register).not.toHaveBeenCalled();
  });

  it('creates the account and lands in the tabs', async () => {
    mockedApi.register.mockResolvedValue(authResponse);
    const app = await renderApp('/register');
    await fillRegister('bode_fan', 'longenough1');
    await waitFor(() =>
      expect(mockedApi.register).toHaveBeenCalledWith(expect.objectContaining({ username: 'bode_fan', password: 'longenough1' })),
    );
    expect(await screen.findByTestId('home-screen')).toBeTruthy();
    expect(app.getPathname()).toBe('/');
  });

  it('logging out returns to /login', async () => {
    mockStoredToken = 'tok-old';
    const app = await renderApp('/profile');
    await fireEvent.press(await screen.findByText('Log out'));
    expect(await screen.findByTestId('login-screen')).toBeTruthy();
    expect(app.getPathname()).toBe('/login');
  });
});
