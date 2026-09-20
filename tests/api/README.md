# API handler tests

Run with `npm run test:api`. Handlers in `api/*.js` are called directly with the doubles from `tests/helpers/mockHttp.js` (`createMockReqRes`), which record every `status`/`json`/`setHeader`/`end` call.

No test may touch real Firebase, Gemini or SMTP. Every handler reaches Firebase through `api/_lib/firebaseAdmin.js`, so mock that module before importing the handler:

```js
import { vi, beforeEach } from 'vitest';

const verifyIdToken = vi.fn();
const getDoc = vi.fn();

vi.mock('../../api/_lib/firebaseAdmin.js', () => ({
  getAdminAuth: () => ({ verifyIdToken }),
  getAdminFirestore: () => ({
    collection: () => ({ doc: () => ({ get: getDoc }) }),
  }),
}));

const { default: handler } = await import('../../api/admin-user.js');
```

`vi.mock` is hoisted, so import the handler afterwards (dynamic import as above). Mock `@google/genai` and `nodemailer` the same way when testing `generate.js` and `send-email.js`. Requests rejected before the Firebase gate (405, missing bearer token) need no mock at all.
