import { Router } from 'express';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
  uploadImage,
} from '../controllers/productController';
import { authenticate, authorize } from '../middleware/auth';
import { uploadProductImage } from '../middleware/upload';

const router = Router();

router.use(authenticate);

router.get('/', listProducts);
router.post('/upload', authorize('Admin', 'Manager'), uploadProductImage.single('image'), uploadImage);
router.get('/:id', getProduct);
router.post('/', authorize('Admin', 'Manager'), createProduct);
router.put('/:id', authorize('Admin', 'Manager'), updateProduct);
router.delete('/:id', authorize('Admin'), deleteProduct);

export default router;
