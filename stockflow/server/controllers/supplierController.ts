import { Response } from 'express';
import { Supplier } from '../models/Supplier';
import { Purchase } from '../models/Purchase';
import { Product } from '../models/Product';
import { assertValidObjectId } from '../middleware/validate';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listSuppliers = asyncHandler(async (req, res: Response) => {
  const { search = '' } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = { isActive: true };
  if (search.trim()) {
    const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ companyName: regex }, { name: regex }, { email: regex }, { city: regex }];
  }

  const [suppliers, purchaseStats, productCounts] = await Promise.all([
    Supplier.find(filter).sort({ companyName: 1 }),
    Purchase.aggregate([
      { $match: { status: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: '$supplier',
          orderCount: { $sum: 1 },
          totalSpend: { $sum: '$totalAmount' },
          lastOrderDate: { $max: '$purchaseDate' },
        },
      },
    ]),
    Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$supplier', productCount: { $sum: 1 } } },
    ]),
  ]);

  const poMap = new Map(purchaseStats.map((p) => [String(p._id), p]));
  const prodMap = new Map(productCounts.map((p) => [String(p._id), p.productCount]));

  const enriched = suppliers.map((s) => {
    const po = poMap.get(String(s._id));
    return {
      ...s.toObject(),
      orderCount: po?.orderCount || 0,
      totalSpend: Math.round((po?.totalSpend || 0) * 100) / 100,
      lastOrderDate: po?.lastOrderDate || null,
      productCount: prodMap.get(String(s._id)) || 0,
    };
  });

  res.json({
    success: true,
    data: enriched,
  });
});

export const getSupplier = asyncHandler(async (req, res: Response) => {
  const { id } = req.params;
  assertValidObjectId(id, 'supplier');

  const supplier = await Supplier.findById(id);
  if (!supplier) {
    throw new ApiError(404, 'Supplier not found.');
  }

  const [purchases, products] = await Promise.all([
    Purchase.find({ supplier: id })
      .sort({ purchaseDate: -1 })
      .populate('items'),
    Product.find({ supplier: id, isActive: true }).select('name sku currentStock purchasePrice'),
  ]);

  res.json({
    success: true,
    data: {
      supplier,
      purchases,
      products,
    },
  });
});

export const createSupplier = asyncHandler(async (req, res: Response) => {
  const { name, companyName, email, phone, address, city = '', country = 'USA', notes = '' } = req.body;

  if (!name || !companyName || !email || !phone || !address) {
    throw new ApiError(400, 'Contact name, company name, email, phone, and address are required.');
  }

  const supplier = await Supplier.create({
    name: String(name).trim(),
    companyName: String(companyName).trim(),
    email: String(email).toLowerCase().trim(),
    phone: String(phone).trim(),
    address: String(address).trim(),
    city: String(city).trim(),
    country: String(country).trim(),
    notes: String(notes).trim(),
  });

  res.status(201).json({
    success: true,
    data: supplier,
  });
});

export const updateSupplier = asyncHandler(async (req, res: Response) => {
  const { id } = req.params;
  assertValidObjectId(id, 'supplier');

  const supplier = await Supplier.findById(id);
  if (!supplier) {
    throw new ApiError(404, 'Supplier not found.');
  }

  const fields = ['name', 'companyName', 'email', 'phone', 'address', 'city', 'country', 'notes'] as const;
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      supplier[field] = String(req.body[field]).trim();
    }
  }

  await supplier.save();
  res.json({
    success: true,
    data: supplier,
  });
});

export const deleteSupplier = asyncHandler(async (req, res: Response) => {
  const { id } = req.params;
  assertValidObjectId(id, 'supplier');

  const supplier = await Supplier.findById(id);
  if (!supplier) {
    throw new ApiError(404, 'Supplier not found.');
  }

  const [linkedProducts, linkedPurchases] = await Promise.all([
    Product.countDocuments({ supplier: id }),
    Purchase.countDocuments({ supplier: id }),
  ]);

  if (linkedProducts > 0 || linkedPurchases > 0) {
    throw new ApiError(
      400,
      `Cannot delete "${supplier.companyName}" because it is linked to ${linkedProducts} product(s) and ${linkedPurchases} purchase order(s).`
    );
  }

  await Supplier.findByIdAndDelete(id);
  res.json({
    success: true,
    message: `Supplier "${supplier.companyName}" deleted.`,
  });
});
