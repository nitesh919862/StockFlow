import { Response } from 'express';
import { InventoryTransaction } from '../models/InventoryTransaction';
import { AuthRequest } from '../middleware/auth';
import { assertValidObjectId } from '../middleware/validate';
import { performInventoryOperation } from '../services/stockService';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listInventoryTransactions = asyncHandler(async (req, res: Response) => {
  const {
    type = 'all',
    productId = '',
    page = '1',
    limit = '20',
  } = req.query as Record<string, string>;

  const filter: Record<string, unknown> = {};
  if (type && type !== 'all') {
    filter.type = type;
  }
  if (productId && productId !== 'all') {
    assertValidObjectId(productId, 'productId');
    filter.product = productId;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    InventoryTransaction.find(filter)
      .sort({ transactionDate: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('product', 'name sku currentStock minStockLevel location')
      .populate('performedBy', 'name role email'),
    InventoryTransaction.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
      },
    },
  });
});

export const createInventoryOperation = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required.');
  }

  const { productId, type, quantity, fromLocation, toLocation, reason } = req.body;
  if (!productId || !type || quantity === undefined) {
    throw new ApiError(400, 'Product, operation type, and quantity are required.');
  }
  assertValidObjectId(productId, 'productId');

  if (!['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER'].includes(type)) {
    throw new ApiError(400, 'Operation type must be IN, OUT, ADJUSTMENT, or TRANSFER.');
  }

  const result = await performInventoryOperation({
    productId,
    type,
    quantity: Number(quantity),
    fromLocation,
    toLocation,
    reason,
    userId: req.user._id,
  });

  res.status(201).json({
    success: true,
    data: result,
  });
});
