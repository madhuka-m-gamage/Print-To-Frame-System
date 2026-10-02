const DEFAULT_PORTS = { firestore: 8080, auth: 9099, storage: 9199 };

const toPort = (value, fallback) => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : fallback;
};

export function emulatorPorts(env = {}) {
  const source = env || {};
  return {
    firestore: toPort(source.VITE_EMULATOR_FIRESTORE_PORT, DEFAULT_PORTS.firestore),
    auth: toPort(source.VITE_EMULATOR_AUTH_PORT, DEFAULT_PORTS.auth),
    storage: toPort(source.VITE_EMULATOR_STORAGE_PORT, DEFAULT_PORTS.storage),
  };
}
