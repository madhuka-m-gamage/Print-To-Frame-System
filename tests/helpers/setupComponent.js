import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// src/services/firebase.js calls initializeApp at import time, so it is stubbed for every
// component test. PermissionsProvider subscribes to settings/permissions through
// firebase/firestore; the stub answers synchronously from globalThis.__TEST_PERMISSIONS__,
// which renderWithProviders sets.
vi.mock('@/services/firebase', () => ({
  db: {},
  auth: { currentUser: null },
  storage: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  setDoc: vi.fn(async () => {}),
  onSnapshot: vi.fn((_ref, onNext) => {
    onNext({ exists: () => true, data: () => globalThis.__TEST_PERMISSIONS__ });
    return () => {};
  }),
}));

afterEach(() => {
  cleanup();
  delete globalThis.__TEST_PERMISSIONS__;
});
