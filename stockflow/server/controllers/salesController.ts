import { Response } from 'express';
import { Sale } from '../models/Sale';
import { SaleItem } from '../models/SaleItem';
import { Product } from '../models/Product';
import { Notification } from '../models/Notification';
import { AuthRequest } from '../middleware/auth';
import { assertValidObjectId } from '../middleware/validate';
import { deductStockForSaleItems } from '../services/stockService';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await Sale.countDocuments();
  return `INV-${year}-${String(401 + count).padStart(3, '0')}-${Math.floor(10 + Math.random() * 89)}`;
}

export const listSales = asyncHandler(async (req, res: Response) => {
  const { search = '', paymentStatus = 'all', page = '1', limit = '15' } = req.query as Record<string, string>;

  const filter: Record<string, unknown> = {};
  if (search.trim()) {
    const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ invoiceNumber: regex }, { customerName: regex }, { customerEmail: regex }];
  }
  if (paymentStatus && paymentStatus !== 'all') {
    filter.paymentStatus = paymentStatus;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Sale.find(filter)
      .sort({ saleDate: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('items')
      .populate('createdBy', 'name role'),
    Sale.countDocuments(filter),
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

export const getSale = asyncHandler(async (req, res: Response) => {
  const { id } = req.params;
  assertValidObjectId(id, 'sale');

  const sale = await Sale.findById(id)
    .populate('items')
    .populate('createdBy', 'name email role');

  if (!sale) {
    throw new ApiError(404, 'Sale order not found.');
  }

  res.json({
    success: true,
    data: sale,
  });
});

export const createSale = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required.');
  }

  const {
    customerName,
    customerEmail = '',
    customerPhone = '',
    items,
    discountType = 'fixed',
    discountValue = 0,
    taxRate = 0,
    paymentStatus = 'Paid',
    paymentMethod = 'Invoice',
    notes = '',
  } = req.body;

  if (!customerName || !String(customerName).trim()) {
    throw new ApiError(400, 'Customer name is required.');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'At least one product line item is required.');
  }

  // Merge duplicate product line items so stock checks are exact
  const mergedItems = new Map<string, { productId: string; quantity: number; customUnitPrice?: number }>();
  for (const row of items) {
    if (!row.productId) throw new ApiError(400, 'Each line item requires a productId.');
    assertValidObjectId(row.productId, 'productId');
    const qty = Number(row.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new ApiError(400, 'Line item quantity must be a positive integer.');
    }
    const existing = mergedItems.get(row.productId);
    if (existing) {
      existing.quantity += qty;
    } else {
      mergedItems.set(row.productId, {
        productId: row.productId,
        quantity: qty,
        customUnitPrice: row.unitPrice !== undefined ? Number(row.unitPrice) : undefined,
      });
    }
  }

  const normalizedItems = Array.from(mergedItems.values());
  const productDocs = await Product.find({
    _id: { $in: normalizedItems.map((i) => i.productId) },
  });
  const productMap = new Map(productDocs.map((p) => [String(p._id), p]));

  let subtotal = 0;
  for (const item of normalizedItems) {
    const prod = productMap.get(item.productId);
    if (!prod) {
      throw new ApiError(404, `Product ${item.productId} not found.`);
    }
    const unitPrice = item.customUnitPrice !== undefined && item.customUnitPrice >= 0
      ? item.customUnitPrice
      : prod.sellingPrice;
    subtotal += unitPrice * item.quantity;
  }

  const dVal = Math.max(0, Number(discountValue) || 0);
  const discountAmount =
    discountType === 'percent'
      ? Math.min(subtotal, Math.round(((subtotal * Math.min(100, dVal)) / 100) * 100) / 100)
      : Math.min(subtotal, dVal);

  const taxable = Math.max(0, subtotal - discountAmount);
  const rate = Math.max(0, Math.min(50, Number(taxRate) || 0));
  const taxAmount = Math.round(((taxable * rate) / 100) * 100) / 100;
  const totalAmount = Math.round((taxable + taxAmount) * 100) / 100;

  const invoiceNumber = await generateInvoiceNumber();

  // Create sale header first to get ID, then atomically deduct stock (with compensating rollback)
  const sale = await Sale.create({
    invoiceNumber,
    customerName: String(customerName).trim(),
    customerEmail: String(customerEmail).trim().toLowerCase(),
    customerPhone: String(customerPhone).trim(),
    subtotal: Math.round(subtotal * 100) / 100,
    discountType: discountType === 'percent' ? 'percent' : 'fixed',
    discountValue: dVal,
    discountAmount,
    taxAmount,
    totalAmount,
    paymentStatus,
    paymentMethod,
    notes: String(notes).trim(),
    createdBy: req.user._id,
    saleDate: new Date(),
  });

  try {
    await deductStockForSaleItems({
      items: normalizedItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      saleId: sale._id,
      invoiceNumber,
      userId: req.user._id,
    });
  } catch (err) {
    await Sale.findByIdAndDelete(sale._id);
    throw err;
  }

  const createdItems = await SaleItem.create(
    normalizedItems.map((item) => {
      const prod = productMap.get(item.productId)!;
      const unitPrice =
        item.customUnitPrice !== undefined && item.customUnitPrice >= 0
          ? item.customUnitPrice
          : prod.sellingPrice;
      return {
        sale: sale._id,
        product: prod._id,
        productName: prod.name,
        sku: prod.sku,
        quantity: item.quantity,
        unitPrice,
        purchasePriceAtSale: prod.purchasePrice,
        lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
      };
    })
  );

  sale.items = createdItems.map((ci) => ci._id);
  await sale.save();

  await Notification.create({
    title: 'New Sales Order Created',
    message: `${invoiceNumber} for ${sale.customerName} ($${sale.totalAmount.toFixed(2)}).`,
    type: 'SALE_CREATED',
    severity: 'info',
  });

  const populated = await Sale.findById(sale._id)
    .populate('items')
    .populate('createdBy', 'name role');

  res.status(201).json({
    success: true,
    data: populated,
  });
});

export const updateSalePaymentStatus = asyncHandler(async (req, res: Response) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;
  assertValidObjectId(id, 'sale');

  if (!['Paid', 'Pending', 'Partial'].includes(paymentStatus)) {
    throw new ApiError(400, 'Invalid payment status.');
  }

  const sale = await Sale.findByIdAndUpdate(
    id,
    { paymentStatus },
    { new: true }
  )
    .populate('items')
    .populate('createdBy', 'name role');

  if (!sale) {
    throw new ApiError(404, 'Sale order not found.');
  }

  res.json({
    success: true,
    data: sale,
  });
});
