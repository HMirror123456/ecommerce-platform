import http from 'http';

const BASE = 'http://localhost:8080/api';

function request(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = raw;
          }
          resolve({ status: res.statusCode, data: json });
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const opLogin = await request('POST', '/auth/admin/login', {
  body: { username: 'operator', password: 'operator123' },
});
const csLogin = await request('POST', '/auth/admin/login', {
  body: { username: 'csagent', password: 'cs123' },
});
if (opLogin.status !== 200 || csLogin.status !== 200) {
  throw new Error(`login failed: op=${opLogin.status} cs=${csLogin.status}`);
}
const opToken = opLogin.data.token;
const csToken = csLogin.data.token;

const listBefore = await request('GET', '/admin/after-sales?page=1&pageSize=50', { token: csToken });
if (listBefore.status !== 200 || !Array.isArray(listBefore.data?.list) || listBefore.data.total < 1) {
  throw new Error(`need ESCALATED after-sales (run npm run db:seed): ${JSON.stringify(listBefore)}`);
}
console.log('OK escalated list total', listBefore.data.total);

const [first, second] = listBefore.data.list;

const forbidden = await request('POST', `/admin/after-sales/${first.afterSaleId}/arbitrate`, {
  token: opToken,
  body: { approved: true },
});
if (forbidden.status !== 403) {
  throw new Error(`OPERATOR should get 403, got ${forbidden.status}: ${JSON.stringify(forbidden.data)}`);
}
console.log('OK OPERATOR forbidden');

// seed id=2 is APPROVED — not arbitrable
const conflict = await request('POST', '/admin/after-sales/2/arbitrate', {
  token: csToken,
  body: { approved: true },
});
if (conflict.status !== 409) {
  throw new Error(`non-ESCALATED should 409, got ${conflict.status}: ${JSON.stringify(conflict.data)}`);
}
console.log('OK non-ESCALATED rejected with 409');

const approved = await request('POST', `/admin/after-sales/${first.afterSaleId}/arbitrate`, {
  token: csToken,
  body: { approved: true, reason: '平台核实同意退款' },
});
if (approved.status !== 200 || approved.data?.status !== 'REFUNDED') {
  throw new Error(`approve failed: ${JSON.stringify(approved)}`);
}
console.log('OK approve → REFUNDED', approved.data.afterSaleId);

if (second) {
  const missingReason = await request('POST', `/admin/after-sales/${second.afterSaleId}/arbitrate`, {
    token: csToken,
    body: { approved: false },
  });
  if (missingReason.status !== 400) {
    throw new Error(`reject without reason should 400, got ${missingReason.status}`);
  }
  console.log('OK reject requires reason');

  const rejected = await request('POST', `/admin/after-sales/${second.afterSaleId}/arbitrate`, {
    token: csToken,
    body: { approved: false, reason: '证据不足，维持原判' },
  });
  if (rejected.status !== 200 || rejected.data?.status !== 'REJECTED') {
    throw new Error(`reject failed: ${JSON.stringify(rejected)}`);
  }
  console.log('OK reject → REJECTED', rejected.data.afterSaleId);
} else {
  console.log('SKIP reject (only one ESCALATED row; re-seed for full coverage)');
}

console.log('\n=== After-sale arbitrate verification passed ===');
