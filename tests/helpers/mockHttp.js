// Minimal Vercel-style req/res doubles for api/*.js handlers. res supports exactly the
// methods the handlers call (status, json, setHeader, end) and records every call.
export function createMockReqRes({ method = 'POST', headers = {}, body, origin } = {}) {
  const reqHeaders = { ...headers };
  if (origin) reqHeaders.origin = origin;

  const req = { method, headers: reqHeaders, body };

  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    calls: [],
    status(code) {
      res.calls.push(['status', code]);
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.calls.push(['json', payload]);
      res.body = payload;
      res.ended = true;
      return res;
    },
    setHeader(name, value) {
      res.calls.push(['setHeader', name, value]);
      res.headers[name] = value;
      return res;
    },
    end() {
      res.calls.push(['end']);
      res.ended = true;
      return res;
    },
  };

  return { req, res };
}
