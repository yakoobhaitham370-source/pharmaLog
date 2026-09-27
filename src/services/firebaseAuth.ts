import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline',
});

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'pharmalog_google_access_token',
  USER_INFO: 'pharmalog_google_user_info',
  AUTH_TIMESTAMP: 'pharmalog_auth_timestamp',
};

let isSigningIn = false;
let cachedAccessToken: string | null = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) : null);
let cachedUser: User | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check stored access token on load
  if (typeof window !== 'undefined') {
    const storedToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (storedToken) {
      cachedAccessToken = storedToken;
    }
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    cachedUser = user;
    const token = cachedAccessToken || (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) : null);

    if (user) {
      // Store user metadata in localStorage for offline/fast load
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            STORAGE_KEYS.USER_INFO,
            JSON.stringify({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
            })
          );
        } catch (e) {
          // ignore
        }
      }
      if (onAuthSuccess) onAuthSuccess(user, token || '');
    } else {
      // Check if we have stored token or user info
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) : null;
      if (!storedToken) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain Google Workspace access token. Please ensure popup is permitted.');
    }

    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;

    // Persist to localStorage across page reloads
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, credential.accessToken);
      localStorage.setItem(STORAGE_KEYS.AUTH_TIMESTAMP, Date.now().toString());
      try {
        localStorage.setItem(
          STORAGE_KEYS.USER_INFO,
          JSON.stringify({
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
          })
        );
      } catch (e) {
        // ignore
      }
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (stored) {
      cachedAccessToken = stored;
      return stored;
    }
  }
  return null;
};

export const getCurrentUser = (): User | null => {
  if (cachedUser) return cachedUser;
  if (auth.currentUser) return auth.currentUser;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USER_INFO);
      if (raw) {
        return JSON.parse(raw) as User;
      }
    } catch (e) {
      // ignore
    }
  }
  return null;
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.error('Error signing out of Firebase:', e);
  }
  cachedAccessToken = null;
  cachedUser = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_INFO);
    localStorage.removeItem(STORAGE_KEYS.AUTH_TIMESTAMP);
  }
};
