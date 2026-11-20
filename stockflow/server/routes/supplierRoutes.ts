import { Router } from 'express';
import {
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from '../controllers/supplierController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listSuppliers);
router.get('/:id', getSupplier);
router.post('/', authorize('Admin', 'Manager'), createSupplier);
router.put('/:id', authorize('Admin', 'Manager'), updateSupplier);
router.delete('/:id', authorize('Admin'), deleteSupplier);

export default router;
