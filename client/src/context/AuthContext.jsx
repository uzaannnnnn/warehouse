import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loginRequest } from "../features/auth/api/authApi";
import { AUTH_STORAGE_KEY } from "../constants/storage";

const isBrowser = typeof window !== "undefined";
const defaultState = {
  user: null,
  token: null,
  expiresAt: null,
  isAuthenticated: false,
};

const AuthContext = createContext(null);

function readPersistedState() {
  if (!isBrowser) return defaultState;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    if (parsed?.expiresAt && parsed.expiresAt < Date.now()) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return defaultState;
    }
    return {
      user: parsed?.user ?? null,
      token: parsed?.token ?? null,
      expiresAt: parsed?.expiresAt ?? null,
      isAuthenticated: Boolean(parsed?.token),
    };
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return defaultState;
  }
}

function persistState(nextState) {
  if (!isBrowser) return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextState));
}

function clearPersistedState() {
  if (isBrowser) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

const durationMap = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

function computeExpiryTimestamp(expiresIn) {
  if (!expiresIn) return Date.now() + durationMap.h;
  if (typeof expiresIn === "number") {
    return Date.now() + expiresIn * 1000;
  }

  const match = /^(\d+)([smhd])$/i.exec(expiresIn);
  if (match) {
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    return Date.now() + value * (durationMap[unit] ?? durationMap.h);
  }

  const numeric = Number(expiresIn);
  if (!Number.isNaN(numeric)) {
    return Date.now() + numeric * 1000;
  }

  return Date.now() + durationMap.h;
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => readPersistedState());

  const login = useCallback(async ({ email, password, captchaToken }) => {
    const response = await loginRequest({ email, password, captchaToken });
    const nextState = {
      user: response.user,
      token: response.token,
      expiresAt: computeExpiryTimestamp(response.expiresIn),
      isAuthenticated: true,
    };
    setState(nextState);
    persistState(nextState);
    return response.user;
  }, []);

  const logout = useCallback(() => {
    setState(defaultState);
    clearPersistedState();
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      login,
      logout,
    }),
    [state, login, logout],
  );

  useEffect(() => {
    if (!state.expiresAt || !state.isAuthenticated) return undefined;
    const now = Date.now();
    const remaining = state.expiresAt - now;
    if (remaining <= 0) {
      const immediate = window.setTimeout(() => logout(), 0);
      return () => window.clearTimeout(immediate);
    }
    const timeout = window.setTimeout(() => logout(), remaining);
    return () => window.clearTimeout(timeout);
  }, [state.expiresAt, state.isAuthenticated, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
