import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(apiRoot, '../..');

dotenv.config({ path: path.join(apiRoot, '.env') });
dotenv.config({ path: path.join(projectRoot, '.env') });

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: node scripts/run-sql.mjs <path-to.sql>');
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'ecommerce',
  password: process.env.DB_PASSWORD || 'ecommerce123',
  database: process.env.DB_NAME || 'ecommerce',
  multipleStatements: true,
});

const sqlPath = path.isAbsolute(sqlFile) ? sqlFile : path.resolve(process.cwd(), sqlFile);
const sql = fs.readFileSync(sqlPath, 'utf8');

try {
  await pool.query(sql);
  console.log('OK:', sqlPath);
} catch (err) {
  console.error('SQL failed:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
