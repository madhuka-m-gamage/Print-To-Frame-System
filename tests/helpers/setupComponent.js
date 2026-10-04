import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// src/services/firebase.js calls initializeApp at import time, so it is stubbed for every
// component test. PermissionsProvider subscribes to settings/permissions through
// firebase/firestore; the stub answers synchronously from globalThis.__TEST_PERMISSIONS__,
// which renderWithProviders sets; settings/fleet answers from globalThis.__TEST_FLEET__ (absent = missing).
vi.mock('@/services/firebase', () => ({
  db: {},
  auth: { currentUser: null },
  storage: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, col, id) => ({ path: `${col}/${id}` })),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  setDoc: vi.fn(async () => {}),
  onSnapshot: vi.fn((ref, onNext) => {
    if (ref?.path === 'settings/fleet') {
      const fleet = globalThis.__TEST_FLEET__;
      onNext({ exists: () => !!fleet, data: () => fleet });
      return () => {};
    }
    onNext({ exists: () => true, data: () => globalThis.__TEST_PERMISSIONS__ });
    return () => {};
  }),
  increment: vi.fn((n) => ({ increment: n })),
}));

afterEach(() => {
  cleanup();
  delete globalThis.__TEST_PERMISSIONS__;
  delete globalThis.__TEST_FLEET__;
});
