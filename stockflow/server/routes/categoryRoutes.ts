import { Router } from 'express';
import {
  createCategory,
  deleteCategory,
  getCategoryProducts,
  listCategories,
  updateCategory,
} from '../controllers/categoryController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listCategories);
router.get('/:id/products', getCategoryProducts);
router.post('/', authorize('Admin', 'Manager'), createCategory);
router.put('/:id', authorize('Admin', 'Manager'), updateCategory);
router.delete('/:id', authorize('Admin'), deleteCategory);

export default router;
