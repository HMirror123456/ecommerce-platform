import cors from 'cors';
import express from 'express';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import addressesRoutes from './routes/addresses.js';
import cartRoutes from './routes/cart.js';
import categoriesRoutes from './routes/categories.js';
import ordersRoutes from './routes/orders.js';
import merchantRoutes from './routes/merchant.js';
import productsRoutes from './routes/products.js';
import usersRoutes from './routes/users.js';
import { checkDbConnection } from './db/pool.js';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/users/addresses', addressesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/products', productsRoutes);
app.use((_req, res) => res.status(404).json({ message: 'Not Found' }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: '服务器错误' });
});

async function start() {
  try {
    await checkDbConnection();
  } catch (err) {
    console.error('MySQL connection failed:', err.message);
    console.error('Start MySQL: docker compose up -d');
    console.error('Then: cd packages/api && npm run db:setup');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`API http://localhost:${PORT}/api`);
    console.log('Demo user: 13800138000/123456 | merchant1/123456 | operator/operator123');
    console.log('Batch-1 data persisted in MySQL (admins, merchants, applications, product_audits)');
  });
}

start();
