import { Router } from 'express';
import {
  createPurchase,
  getPurchase,
  listPurchases,
  updatePurchaseStatus,
} from '../controllers/purchaseController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listPurchases);
router.get('/:id', getPurchase);
router.post('/', authorize('Admin', 'Manager'), createPurchase);
router.patch('/:id/status', authorize('Admin', 'Manager'), updatePurchaseStatus);

export default router;
