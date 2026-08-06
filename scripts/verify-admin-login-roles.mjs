import http from 'http';

const BASE = 'http://localhost:8080/api';

function request(method, path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 8080,
        path: BASE.replace('http://localhost:8080', '') + path,
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let data = null;
          try {
            data = raw ? JSON.parse(raw) : null;
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode, data });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

const cs = await request('POST', '/auth/admin/login', null);
// POST needs body - use simpler approach with existing pattern
function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 8080,
        path: '/api' + path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(raw) }));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 8080,
        path: '/api' + path,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, data: raw ? JSON.parse(raw) : null }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

const csLogin = await post('/auth/admin/login', { username: 'csagent', password: 'cs123' });
const opLogin = await post('/auth/admin/login', { username: 'operator', password: 'operator123' });
const csToken = csLogin.data.token;
const opToken = opLogin.data.token;

if (csLogin.data.role !== 'CS_AGENT') throw new Error('csagent login failed');
if (opLogin.data.role !== 'OPERATOR') throw new Error('operator login failed');

const csProducts = await get('/admin/products/pending', csToken);
if (csProducts.status !== 403) throw new Error(`CS_AGENT should get 403 on products pending, got ${csProducts.status}`);

const opAfterSales = await get('/admin/after-sales', opToken);
if (opAfterSales.status !== 403) throw new Error(`OPERATOR should get 403 on after-sales, got ${opAfterSales.status}`);

console.log('OK csagent login role CS_AGENT, blocked from product audit API (403)');
console.log('OK operator login role OPERATOR, blocked from after-sales API (403)');
