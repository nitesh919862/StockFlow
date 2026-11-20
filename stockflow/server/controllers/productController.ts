import { Response } from 'express';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Supplier } from '../models/Supplier';
import { InventoryTransaction } from '../models/InventoryTransaction';
import { AuthRequest } from '../middleware/auth';
import { assertValidObjectId } from '../middleware/validate';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listProducts = asyncHandler(async (req, res: Response) => {
  const {
    search = '',
    category = '',
    supplier = '',
    stockStatus = '',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = '1',
    limit = '10',
  } = req.query as Record<string, string>;

  const filter: Record<string, unknown> = { isActive: true };

  if (search.trim()) {
    const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: regex }, { sku: regex }, { barcode: regex }];
  }

  if (category && category !== 'all') {
    assertValidObjectId(category, 'category');
    filter.category = category;
  }

  if (supplier && supplier !== 'all') {
    assertValidObjectId(supplier, 'supplier');
    filter.supplier = supplier;
  }

  if (stockStatus === 'out') {
    filter.currentStock = 0;
  } else if (stockStatus === 'low') {
    filter.$expr = {
      $and: [
        { $gt: ['$currentStock', 0] },
        { $lte: ['$currentStock', '$minStockLevel'] },
      ],
    };
  } else if (stockStatus === 'in') {
    filter.$expr = { $gt: ['$currentStock', '$minStockLevel'] };
  }

  const allowedSortFields = new Set([
    'name',
    'sku',
    'purchasePrice',
    'sellingPrice',
    'currentStock',
    'createdAt',
  ]);
  const sortField = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';
  const sortDir = sortOrder === 'asc' ? 1 : -1;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .populate('supplier', 'companyName name email')
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(limitNum),
    Product.countDocuments(filter),
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

export const getProduct = asyncHandler(async (req, res: Response) => {
  const { id } = req.params;
  assertValidObjectId(id, 'product');

  const product = await Product.findById(id)
    .populate('category', 'name slug description')
    .populate('supplier', 'companyName name email phone');

  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  const recentTransactions = await InventoryTransaction.find({ product: product._id })
    .sort({ transactionDate: -1 })
    .limit(12)
    .populate('performedBy', 'name role');

  res.json({
    success: true,
    data: {
      product,
      recentTransactions,
    },
  });
});

export const createProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    name,
    sku,
    barcode,
    category,
    supplier,
    purchasePrice,
    sellingPrice,
    currentStock = 0,
    minStockLevel = 10,
    location = 'Main Warehouse',
    description = '',
    imageUrl = '',
  } = req.body;

  if (!name || !sku || !category || !supplier) {
    throw new ApiError(400, 'Product name, SKU, category, and supplier are required.');
  }

  assertValidObjectId(category, 'category');
  assertValidObjectId(supplier, 'supplier');

  const [catExists, supExists] = await Promise.all([
    Category.findById(category),
    Supplier.findById(supplier),
  ]);
  if (!catExists) throw new ApiError(404, 'Selected category does not exist.');
  if (!supExists) throw new ApiError(404, 'Selected supplier does not exist.');

  const pPrice = Number(purchasePrice);
  const sPrice = Number(sellingPrice);
  const initStock = Number(currentStock);
  const minLevel = Number(minStockLevel);

  if (Number.isNaN(pPrice) || pPrice < 0) throw new ApiError(400, 'Purchase price must be >= 0.');
  if (Number.isNaN(sPrice) || sPrice < 0) throw new ApiError(400, 'Selling price must be >= 0.');
  if (Number.isNaN(initStock) || initStock < 0) throw new ApiError(400, 'Initial stock must be >= 0.');
  if (Number.isNaN(minLevel) || minLevel < 0) throw new ApiError(400, 'Minimum stock level must be >= 0.');

  const primaryLocation = String(location).trim() || 'Main Warehouse';

  const product = await Product.create({
    name: String(name).trim(),
    sku: String(sku).trim().toUpperCase(),
    barcode: barcode ? String(barcode).trim() : '',
    category,
    supplier,
    purchasePrice: pPrice,
    sellingPrice: sPrice,
    currentStock: initStock,
    minStockLevel: minLevel,
    location: primaryLocation,
    locationStocks: [{ location: primaryLocation, quantity: initStock }],
    description: String(description).trim(),
    imageUrl: String(imageUrl).trim(),
  });

  if (initStock > 0 && req.user) {
    await InventoryTransaction.create({
      product: product._id,
      type: 'IN',
      quantity: initStock,
      previousStock: 0,
      newStock: initStock,
      toLocation: primaryLocation,
      referenceType: 'Manual',
      reason: 'Initial catalog stock',
      performedBy: req.user._id,
      transactionDate: new Date(),
    });
  }

  const populated = await Product.findById(product._id)
    .populate('category', 'name slug')
    .populate('supplier', 'companyName name email');

  res.status(201).json({
    success: true,
    data: populated,
  });
});

export const updateProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  assertValidObjectId(id, 'product');

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  const {
    name,
    sku,
    barcode,
    category,
    supplier,
    purchasePrice,
    sellingPrice,
    minStockLevel,
    location,
    description,
    imageUrl,
  } = req.body;

  if (category) {
    assertValidObjectId(category, 'category');
    const cat = await Category.findById(category);
    if (!cat) throw new ApiError(404, 'Category not found.');
    product.category = cat._id;
  }

  if (supplier) {
    assertValidObjectId(supplier, 'supplier');
    const sup = await Supplier.findById(supplier);
    if (!sup) throw new ApiError(404, 'Supplier not found.');
    product.supplier = sup._id;
  }

  if (name !== undefined) product.name = String(name).trim();
  if (sku !== undefined) product.sku = String(sku).trim().toUpperCase();
  if (barcode !== undefined) product.barcode = String(barcode).trim();
  if (purchasePrice !== undefined) {
    const val = Number(purchasePrice);
    if (Number.isNaN(val) || val < 0) throw new ApiError(400, 'Purchase price must be >= 0.');
    product.purchasePrice = val;
  }
  if (sellingPrice !== undefined) {
    const val = Number(sellingPrice);
    if (Number.isNaN(val) || val < 0) throw new ApiError(400, 'Selling price must be >= 0.');
    product.sellingPrice = val;
  }
  if (minStockLevel !== undefined) {
    const val = Number(minStockLevel);
    if (Number.isNaN(val) || val < 0) throw new ApiError(400, 'Minimum stock level must be >= 0.');
    product.minStockLevel = val;
  }
  if (location !== undefined) product.location = String(location).trim() || 'Main Warehouse';
  if (description !== undefined) product.description = String(description).trim();
  if (imageUrl !== undefined) product.imageUrl = String(imageUrl).trim();

  await product.save();

  const updated = await Product.findById(product._id)
    .populate('category', 'name slug')
    .populate('supplier', 'companyName name email');

  res.json({
    success: true,
    data: updated,
  });
});

export const deleteProduct = asyncHandler(async (req, res: Response) => {
  const { id } = req.params;
  assertValidObjectId(id, 'product');

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  await Product.findByIdAndDelete(id);
  res.json({
    success: true,
    message: `Product "${product.name}" deleted.`,
  });
});

export const uploadImage = asyncHandler(async (req, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, 'No image file provided.');
  }
  res.status(201).json({
    success: true,
    data: {
      imageUrl: `/uploads/${req.file.filename}`,
    },
  });
});
