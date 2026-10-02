import { describe, it, expect } from 'vitest';
import { emulatorPorts } from '@/services/emulatorPorts';

describe('emulatorPorts', () => {
  it('defaults to the ports in firebase.json', () => {
    expect(emulatorPorts({})).toEqual({ firestore: 8080, auth: 9099, storage: 9199 });
    expect(emulatorPorts(undefined)).toEqual({ firestore: 8080, auth: 9099, storage: 9199 });
  });

  it('reads slot ports from the VITE_EMULATOR_* variables', () => {
    expect(
      emulatorPorts({ VITE_EMULATOR_FIRESTORE_PORT: '8090', VITE_EMULATOR_AUTH_PORT: '9109', VITE_EMULATOR_STORAGE_PORT: '9209' })
    ).toEqual({ firestore: 8090, auth: 9109, storage: 9209 });
  });

  it('falls back to the default for empty, non-numeric or out-of-range values', () => {
    expect(
      emulatorPorts({ VITE_EMULATOR_FIRESTORE_PORT: '', VITE_EMULATOR_AUTH_PORT: 'abc', VITE_EMULATOR_STORAGE_PORT: '70000' })
    ).toEqual({ firestore: 8080, auth: 9099, storage: 9199 });
    expect(emulatorPorts({ VITE_EMULATOR_AUTH_PORT: '0' }).auth).toBe(9099);
    expect(emulatorPorts({ VITE_EMULATOR_AUTH_PORT: '91.5' }).auth).toBe(9099);
  });
});
