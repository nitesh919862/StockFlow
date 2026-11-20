import { Router } from 'express';
import authRoutes from './authRoutes';
import dashboardRoutes from './dashboardRoutes';
import productRoutes from './productRoutes';
import categoryRoutes from './categoryRoutes';
import supplierRoutes from './supplierRoutes';
import inventoryRoutes from './inventoryRoutes';
import salesRoutes from './salesRoutes';
import purchaseRoutes from './purchaseRoutes';
import reportRoutes from './reportRoutes';
import userRoutes from './userRoutes';
import notificationRoutes from './notificationRoutes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, status: 'healthy', service: 'StockFlow API' });
});

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/sales', salesRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/reports', reportRoutes);
router.use('/users', userRoutes);
router.use('/notifications', notificationRoutes);

export default router;
