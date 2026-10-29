/* StreamVault shared auth service.
 *
 * Plain JavaScript (no JSX) so it can be loaded by login.html, admin.html and
 * index.html/app.js. Load it BEFORE admin.js / app.js on every page.
 *
 * NOTE: this is a front-end demo. Accounts and sessions live in the browser's
 * localStorage, so this is not real security — a real app must validate
 * credentials on a server.
 */
(function (global) {
  "use strict";

  const SESSION_KEY = "sv_session";
  const USERS_KEY = "sv_users";
  const LEGACY_KEY = "sv_admin_auth"; // written by the old login page

  const DEFAULT_ADMIN = {
    username: "admin",
    password: "streamvault123",
    name: "Administrator",
    role: "admin",
  };

  const readJson = (storage, key) => {
    try {
      return JSON.parse(storage.getItem(key) || "null");
    } catch (e) {
      return null;
    }
  };

  const readUsers = () => {
    const stored = readJson(localStorage, USERS_KEY);
    if (Array.isArray(stored) && stored.length) return stored;
    const fresh = [{ ...DEFAULT_ADMIN }];
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(fresh));
    } catch (e) {}
    return fresh;
  };

  const writeUsers = (users) => {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (e) {}
  };

  const emit = () => {
    try {
      global.dispatchEvent(new CustomEvent("sv:auth", { detail: getUser() }));
    } catch (e) {}
  };

  const getUser = () => {
    const session = readJson(localStorage, SESSION_KEY);
    if (!session || !session.username) return null;
    return session;
  };

  const startSession = (account) => {
    const session = {
      username: account.username,
      name: account.name || account.username,
      role: account.role || "user",
      t: Date.now(),
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      if (session.role === "admin") {
        localStorage.setItem(
          LEGACY_KEY,
          btoa(JSON.stringify({ u: session.username, t: session.t })),
        );
      } else {
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch (e) {}
    emit();
    return session;
  };

  const login = (username, password) => {
    const name = (username || "").trim();
    if (!name || !password) {
      return { ok: false, error: "Enter your username and password." };
    }
    const account = readUsers().find(
      (u) => u.username.toLowerCase() === name.toLowerCase(),
    );
    if (!account || account.password !== password) {
      return { ok: false, error: "Invalid username or password." };
    }
    return { ok: true, user: startSession(account) };
  };

  const register = (username, password, displayName) => {
    const name = (username || "").trim();
    if (name.length < 3) {
      return { ok: false, error: "Username must be at least 3 characters." };
    }
    if ((password || "").length < 6) {
      return { ok: false, error: "Password must be at least 6 characters." };
    }
    const users = readUsers();
    if (users.some((u) => u.username.toLowerCase() === name.toLowerCase())) {
      return { ok: false, error: "That username is already taken." };
    }
    const account = {
      username: name,
      password,
      name: (displayName || "").trim() || name,
      role: "user",
    };
    writeUsers([...users, account]);
    return { ok: true, user: startSession(account) };
  };

  const logout = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(LEGACY_KEY);
    } catch (e) {}
    emit();
  };

  const isAdmin = () => {
    const user = getUser();
    return !!user && user.role === "admin";
  };

  const onChange = (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = () => callback(getUser());
    global.addEventListener("sv:auth", handler);
    global.addEventListener("storage", handler);
    return () => {
      global.removeEventListener("sv:auth", handler);
      global.removeEventListener("storage", handler);
    };
  };

  // Migrate a session created by the old login.html (sessionStorage, base64).
  const migrateLegacySession = () => {
    if (getUser()) return;
    try {
      const raw =
        sessionStorage.getItem(LEGACY_KEY) || localStorage.getItem(LEGACY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(atob(raw));
      if (parsed && parsed.u) {
        startSession({
          username: parsed.u,
          name: "Administrator",
          role: "admin",
        });
      }
    } catch (e) {}
  };

  readUsers();
  migrateLegacySession();

  global.SV_AUTH = {
    SESSION_KEY,
    USERS_KEY,
    getUser,
    login,
    register,
    logout,
    isAdmin,
    onChange,
  };
})(window);
