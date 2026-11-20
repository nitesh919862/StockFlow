import { Router } from 'express';
import {
  createSale,
  getSale,
  listSales,
  updateSalePaymentStatus,
} from '../controllers/salesController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listSales);
router.get('/:id', getSale);
router.post('/', createSale);
router.patch('/:id/payment', authorize('Admin', 'Manager'), updateSalePaymentStatus);

export default router;
