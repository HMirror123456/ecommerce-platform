import cors from 'cors';
import express from 'express';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import ordersRoutes from './routes/orders.js';
import merchantRoutes from './routes/merchant.js';
import productsRoutes from './routes/products.js';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/products', productsRoutes);
app.use((_req, res) => res.status(404).json({ message: 'Not Found' }));

app.listen(PORT, () => {
  console.log(`API http://localhost:${PORT}/api`);
  console.log('Demo user: 13800138000/123456 | merchant1/123456 | operator/operator123');
});