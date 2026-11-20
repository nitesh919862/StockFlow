import { Router } from 'express';
import { exportReportCsv, getReportsOverview } from '../controllers/reportController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/overview', getReportsOverview);
router.get('/export/:type', exportReportCsv);

export default router;
