const AUTH_KEY = "luminior-dashboard-auth";
const USERS_KEY = "luminior-dashboard-users";

function readStorage(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getStoredUsers() {
  const users = readStorage(USERS_KEY);
  return Array.isArray(users) ? users : [];
}

function persistUsers(users) {
  writeStorage(USERS_KEY, users);
}

export function registerUser({ fullName, email, password }) {
  const name = fullName?.trim();
  const normalizedEmail = email?.trim().toLowerCase();
  const safePassword = password?.trim();

  if (!name || !normalizedEmail || !safePassword) {
    return null;
  }

  if (!normalizedEmail.includes("@") || safePassword.length < 6) {
    return null;
  }

  const users = getStoredUsers();
  const exists = users.some((user) => user.email === normalizedEmail);
  if (exists) {
    return null;
  }

  const user = {
    id: `user-${Date.now()}`,
    name,
    email: normalizedEmail,
    password: safePassword,
    role: "manager",
  };

  persistUsers([...users, user]);
  return user;
}

export function authenticateUser(email, password) {
  const normalizedEmail = email?.trim().toLowerCase();
  const safePassword = password?.trim();

  if (!normalizedEmail || !safePassword) {
    return null;
  }

  const user = getStoredUsers().find(
    (candidate) => candidate.email === normalizedEmail && candidate.password === safePassword,
  );

  return user ? { ...user } : null;
}

export function getStoredSession() {
  const user = readStorage(AUTH_KEY);
  return user ? { ...user } : null;
}

export function persistSession(user) {
  writeStorage(AUTH_KEY, user);
}

export function clearStoredSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_KEY);
}
