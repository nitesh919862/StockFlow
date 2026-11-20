import { Response } from 'express';
import { Purchase } from '../models/Purchase';
import { PurchaseItem } from '../models/PurchaseItem';
import { Supplier } from '../models/Supplier';
import { Product } from '../models/Product';
import { AuthRequest } from '../middleware/auth';
import { assertValidObjectId } from '../middleware/validate';
import { receiveStockForPurchaseItems } from '../services/stockService';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

async function generatePoNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await Purchase.countDocuments();
  return `PO-${year}-${String(1001 + count).padStart(4, '0')}-${Math.floor(10 + Math.random() * 89)}`;
}

export const listPurchases = asyncHandler(async (req, res: Response) => {
  const { search = '', status = 'all', page = '1', limit = '15' } = req.query as Record<string, string>;

  const filter: Record<string, unknown> = {};
  if (search.trim()) {
    const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ poNumber: regex }, { notes: regex }];
  }
  if (status && status !== 'all') {
    filter.status = status;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Purchase.find(filter)
      .sort({ purchaseDate: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('supplier', 'companyName name email phone')
      .populate('items')
      .populate('createdBy', 'name role')
      .populate('receivedBy', 'name role'),
    Purchase.countDocuments(filter),
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

export const getPurchase = asyncHandler(async (req, res: Response) => {
  const { id } = req.params;
  assertValidObjectId(id, 'purchase');

  const purchase = await Purchase.findById(id)
    .populate('supplier')
    .populate('items')
    .populate('createdBy', 'name role')
    .populate('receivedBy', 'name role');

  if (!purchase) {
    throw new ApiError(404, 'Purchase order not found.');
  }

  res.json({
    success: true,
    data: purchase,
  });
});

export const createPurchase = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required.');
  }

  const {
    supplierId,
    items,
    shippingCost = 0,
    status = 'Pending',
    expectedDate,
    notes = '',
  } = req.body;

  if (!supplierId) throw new ApiError(400, 'Supplier is required.');
  assertValidObjectId(supplierId, 'supplierId');

  const supplier = await Supplier.findById(supplierId);
  if (!supplier) throw new ApiError(404, 'Supplier not found.');

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'At least one purchase item is required.');
  }

  if (!['Pending', 'Received'].includes(status)) {
    throw new ApiError(400, 'Initial purchase status must be Pending or Received.');
  }

  const productIds = items.map((i: { productId: string }) => {
    assertValidObjectId(i.productId, 'productId');
    return i.productId;
  });
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  let subtotal = 0;
  const prepared: Array<{ product: typeof products[0]; quantity: number; unitCost: number }> = [];

  for (const row of items) {
    const prod = productMap.get(row.productId);
    if (!prod) throw new ApiError(404, `Product ${row.productId} not found.`);
    const qty = Number(row.quantity);
    const cost = row.unitCost !== undefined ? Number(row.unitCost) : prod.purchasePrice;
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new ApiError(400, 'Quantity must be a positive integer.');
    }
    if (Number.isNaN(cost) || cost < 0) {
      throw new ApiError(400, 'Unit cost must be >= 0.');
    }
    subtotal += qty * cost;
    prepared.push({ product: prod, quantity: qty, unitCost: cost });
  }

  const ship = Math.max(0, Number(shippingCost) || 0);
  const totalAmount = Math.round((subtotal + ship) * 100) / 100;
  const poNumber = await generatePoNumber();

  const purchase = await Purchase.create({
    poNumber,
    supplier: supplier._id,
    subtotal: Math.round(subtotal * 100) / 100,
    shippingCost: ship,
    totalAmount,
    status,
    expectedDate: expectedDate ? new Date(expectedDate) : undefined,
    receivedDate: status === 'Received' ? new Date() : undefined,
    notes: String(notes).trim(),
    createdBy: req.user._id,
    receivedBy: status === 'Received' ? req.user._id : undefined,
    purchaseDate: new Date(),
  });

  const poItems = await PurchaseItem.create(
    prepared.map((p) => ({
      purchase: purchase._id,
      product: p.product._id,
      productName: p.product.name,
      sku: p.product.sku,
      quantity: p.quantity,
      unitCost: p.unitCost,
      lineTotal: Math.round(p.quantity * p.unitCost * 100) / 100,
    }))
  );

  purchase.items = poItems.map((i) => i._id);
  await purchase.save();

  if (status === 'Received') {
    await receiveStockForPurchaseItems({
      items: prepared.map((p) => ({
        productId: p.product._id,
        quantity: p.quantity,
        unitCost: p.unitCost,
      })),
      purchaseId: purchase._id,
      poNumber,
      userId: req.user._id,
    });
  }

  const populated = await Purchase.findById(purchase._id)
    .populate('supplier', 'companyName name email')
    .populate('items')
    .populate('createdBy', 'name role')
    .populate('receivedBy', 'name role');

  res.status(201).json({
    success: true,
    data: populated,
  });
});

export const updatePurchaseStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required.');
  }

  const { id } = req.params;
  const { status } = req.body;
  assertValidObjectId(id, 'purchase');

  if (!['Pending', 'Received', 'Cancelled'].includes(status)) {
    throw new ApiError(400, 'Invalid purchase status.');
  }

  const purchase = await Purchase.findById(id).populate('items');
  if (!purchase) {
    throw new ApiError(404, 'Purchase order not found.');
  }

  if (purchase.status === 'Received') {
    throw new ApiError(400, 'Received purchase orders cannot be modified.');
  }
  if (purchase.status === 'Cancelled') {
    throw new ApiError(400, 'Cancelled purchase orders cannot be reopened.');
  }

  purchase.status = status;
  if (status === 'Received') {
    purchase.receivedDate = new Date();
    purchase.receivedBy = req.user._id;
    const poItems = await PurchaseItem.find({ purchase: purchase._id });
    await receiveStockForPurchaseItems({
      items: poItems.map((i) => ({
        productId: i.product,
        quantity: i.quantity,
        unitCost: i.unitCost,
      })),
      purchaseId: purchase._id,
      poNumber: purchase.poNumber,
      userId: req.user._id,
    });
  }

  await purchase.save();

  const updated = await Purchase.findById(purchase._id)
    .populate('supplier', 'companyName name email')
    .populate('items')
    .populate('createdBy', 'name role')
    .populate('receivedBy', 'name role');

  res.json({
    success: true,
    data: updated,
  });
});
