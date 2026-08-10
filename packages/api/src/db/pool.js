import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'ecommerce',
  password: process.env.DB_PASSWORD || 'ecommerce123',
  database: process.env.DB_NAME || 'ecommerce',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
});

export async function checkDbConnection() {
  const conn = await pool.getConnection();
  conn.release();
}

export default pool;

function toIso(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * MySQL DATETIME(3) 友好格式（严格模式不接受 ISO 的 T/Z）。
 * 使用 UTC 组件写入，与 pool.timezone='Z'、超时判断 UTC_TIMESTAMP(3) 一致。
 */
function toMysqlDateTime(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`;
}

export function mapAdminRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    role: row.role,
  };
}

export function mapMerchantRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    shopId: row.shop_id,
    shopName: row.shop_name,
  };
}

export function mapApplicationRow(row) {
  if (!row) return null;
  return {
    merchantId: row.id,
    shopName: row.shop_name,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    status: row.status,
    appliedAt: toIso(row.applied_at),
    auditedAt: toIso(row.audited_at),
    rejectReason: row.reject_reason || undefined,
    approvedMerchantId: row.approved_merchant_id || undefined,
    adminId: row.admin_id || undefined,
    merchantUsername: row.merchant_username || undefined,
  };
}

export function mapProductAuditRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    spuId: row.spu_id,
    adminId: row.admin_id,
    approved: !!row.approved,
    reason: row.reason || null,
    auditedAt: toIso(row.audited_at),
  };
}

export { toIso, toMysqlDateTime };
