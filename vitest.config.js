import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // Unit and integration tests are separate npm scripts (see package.json) since
    // integration tests require the Firebase Emulator Suite running underneath them
    // and would otherwise fail with a confusing connection error if run bare.
    //
    // Integration test FILES all share one external, stateful Firebase Emulator —
    // Vitest's default file-level parallelism (separate worker threads per file)
    // lets one file's beforeEach(testEnv.clearFirestore()) wipe data out from under
    // another file's in-flight assertions in a different worker, at the same time,
    // against the same emulator. This surfaced as a real, reproducible failure:
    // a concurrency test in one file measuring duplicate Firestore transaction
    // results only when run alongside sibling integration test files, never in
    // isolation — the transaction logic itself was correct; the emulator's shared
    // state was being cleared mid-test by an unrelated file's own beforeEach.
    // Forcing test files to run sequentially removes that cross-file race for both
    // unit and integration runs (negligible cost here given the small suite size).
    fileParallelism: false,
  },
});
