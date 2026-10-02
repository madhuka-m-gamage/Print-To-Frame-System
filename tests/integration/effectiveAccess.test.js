import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { PROJECT_ID, PERMISSIONS_FIXTURE, firestoreEmulator } from '../helpers/emulator';
import {
  DEPLOYED_RULES_REF,
  PROBES,
  OPERATIONS,
  probeAccess,
  expectedAccess,
  diffAccess,
  formatAccessTable,
  loadLiveMatrix,
  readDeployedRules,
} from '../helpers/effectiveAccess';

/**
 * SEC-9: effective access. For every role, probed collection and operation, runs the real
 * read/create/update/delete against the rules deployed from `main` and against the rules in
 * this working tree, prints both, and checks:
 *   - the working-tree rules grant exactly what the matrix says (expectedAccess), so no
 *     second rule silently wins;
 *   - the only differences from the deployed rules are the ones listed in
 *     EXPECTED_RULE_CHANGES. A rules change adds its intended cells there.
 * Set LIVE_PERMISSIONS_JSON to a copy of the live settings/permissions document, kept
 * outside the repository, to run the same check against the live matrix.
 */

// Cells a pending rules change is meant to flip: { role, probe, op, deployed, next }.
const EXPECTED_RULE_CHANGES = [
  // SEC-7: a Partner reads and edits only its own partners record.
  { role: 'Partner', probe: 'partners', op: 'read', deployed: true, next: false },
  { role: 'Partner', probe: 'partners', op: 'create', deployed: true, next: false },
  { role: 'Partner', probe: 'partners', op: 'update', deployed: true, next: false },
  // SEC-8 flips no cell here: the probe leads and invoices name no partner, so a Partner's
  // scoped read is covered in partnerScopedReads.test.js.
  // FEA-15 flips no cell here: the probe customers row carries no userId, so a client's
  // userId-linked read and update are covered in customerUserId.test.js.
];

const ROLES = Object.keys(PERMISSIONS_FIXTURE);

async function accessUnder(rules, matrix, roles) {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules, ...firestoreEmulator() },
  });
  try {
    return await probeAccess(testEnv, matrix, roles);
  } finally {
    await testEnv.cleanup();
  }
}

function mismatches(results, matrix, roles) {
  const out = [];
  for (const role of [...roles, null]) {
    for (const p of PROBES) {
      for (const op of OPERATIONS) {
        const want = expectedAccess(matrix, role, p, op, role !== null);
        const got = results[`${role ?? 'signed out'}|${p.name}|${op}`];
        if (got !== want) out.push(`${role ?? 'signed out'} ${p.name} ${op}: rules ${got}, matrix ${want}`);
      }
    }
  }
  return out;
}

describe('effective access: deployed rules vs working-tree rules', () => {
  it('follows the matrix and differs from the deployed rules only where intended', async () => {
    const deployed = await accessUnder(readDeployedRules(), PERMISSIONS_FIXTURE, ROLES);
    const next = await accessUnder(readFileSync('firestore.rules', 'utf8'), PERMISSIONS_FIXTURE, ROLES);

    console.log(`Effective access with PERMISSIONS_FIXTURE (deployed = ${DEPLOYED_RULES_REF}, new = working tree)\n`
      + formatAccessTable([...ROLES, 'signed out'], PROBES, deployed, next));

    expect(mismatches(next, PERMISSIONS_FIXTURE, ROLES)).toEqual([]);
    expect(diffAccess(deployed, next)).toEqual(EXPECTED_RULE_CHANGES);
  }, 180000);

  const live = loadLiveMatrix(process.env.LIVE_PERMISSIONS_JSON, process.cwd());

  it.skipIf(!live)('follows the live matrix (LIVE_PERMISSIONS_JSON)', async () => {
    const roles = [...new Set([...ROLES, ...Object.keys(live)])];
    const deployed = await accessUnder(readDeployedRules(), live, roles);
    const next = await accessUnder(readFileSync('firestore.rules', 'utf8'), live, roles);

    console.log(`Effective access with the live matrix (deployed = ${DEPLOYED_RULES_REF}, new = working tree)\n`
      + formatAccessTable([...roles, 'signed out'], PROBES, deployed, next));

    expect(mismatches(next, live, roles)).toEqual([]);
  }, 180000);
});
