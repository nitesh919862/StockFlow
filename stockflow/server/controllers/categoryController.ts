import { Response } from 'express';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { assertValidObjectId } from '../middleware/validate';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const listCategories = asyncHandler(async (_req, res: Response) => {
  const [categories, statsAgg] = await Promise.all([
    Category.find({ isActive: true }).sort({ name: 1 }),
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          productCount: { $sum: 1 },
          totalUnits: { $sum: '$currentStock' },
          totalValue: { $sum: { $multiply: ['$currentStock', '$purchasePrice'] } },
        },
      },
    ]),
  ]);

  const statsMap = new Map(
    statsAgg.map((s) => [
      String(s._id),
      {
        productCount: s.productCount,
        totalUnits: s.totalUnits,
        totalValue: Math.round(s.totalValue * 100) / 100,
      },
    ])
  );

  const enriched = categories.map((c) => ({
    ...c.toObject(),
    ...(statsMap.get(String(c._id)) || {
      productCount: 0,
      totalUnits: 0,
      totalValue: 0,
    }),
  }));

  res.json({
    success: true,
    data: enriched,
  });
});

export const getCategoryProducts = asyncHandler(async (req, res: Response) => {
  const { id } = req.params;
  assertValidObjectId(id, 'category');

  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError(404, 'Category not found.');
  }

  const products = await Product.find({ category: id, isActive: true })
    .populate('supplier', 'companyName')
    .sort({ name: 1 });

  res.json({
    success: true,
    data: {
      category,
      products,
    },
  });
});

export const createCategory = asyncHandler(async (req, res: Response) => {
  const { name, description = '' } = req.body;
  if (!name || !String(name).trim()) {
    throw new ApiError(400, 'Category name is required.');
  }

  const cleanName = String(name).trim();
  const slug = toSlug(cleanName);

  const category = await Category.create({
    name: cleanName,
    slug,
    description: String(description).trim(),
  });

  res.status(201).json({
    success: true,
    data: category,
  });
});

export const updateCategory = asyncHandler(async (req, res: Response) => {
  const { id } = req.params;
  assertValidObjectId(id, 'category');

  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError(404, 'Category not found.');
  }

  const { name, description } = req.body;
  if (name !== undefined) {
    const cleanName = String(name).trim();
    if (!cleanName) throw new ApiError(400, 'Category name cannot be empty.');
    category.name = cleanName;
    category.slug = toSlug(cleanName);
  }
  if (description !== undefined) {
    category.description = String(description).trim();
  }

  await category.save();
  res.json({
    success: true,
    data: category,
  });
});

export const deleteCategory = asyncHandler(async (req, res: Response) => {
  const { id } = req.params;
  assertValidObjectId(id, 'category');

  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError(404, 'Category not found.');
  }

  const linkedProducts = await Product.countDocuments({ category: id });
  if (linkedProducts > 0) {
    throw new ApiError(
      400,
      `Cannot delete "${category.name}" because ${linkedProducts} product(s) are assigned to it. Reassign those products first.`
    );
  }

  await Category.findByIdAndDelete(id);
  res.json({
    success: true,
    message: `Category "${category.name}" deleted.`,
  });
});
