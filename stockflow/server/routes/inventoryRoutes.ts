import { Router } from 'express';
import {
  createInventoryOperation,
  listInventoryTransactions,
} from '../controllers/inventoryController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/transactions', listInventoryTransactions);
router.post('/operations', createInventoryOperation);

export default router;
