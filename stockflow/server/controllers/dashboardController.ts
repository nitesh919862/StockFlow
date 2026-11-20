import { Response } from 'express';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Sale } from '../models/Sale';
import { Purchase } from '../models/Purchase';
import { InventoryTransaction } from '../models/InventoryTransaction';
import { asyncHandler } from '../utils/asyncHandler';

export const getDashboardSummary = asyncHandler(async (_req, res: Response) => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [
    totalProducts,
    totalCategories,
    productsList,
    salesTotals,
    purchaseTotals,
    monthlySalesAgg,
    monthlyPurchasesAgg,
    categoryDistAgg,
    recentTransactions,
    recentSales,
    recentPurchases,
  ] = await Promise.all([
    Product.countDocuments({ isActive: true }),
    Category.countDocuments({ isActive: true }),
    Product.find({ isActive: true })
      .populate('category', 'name')
      .select('name sku currentStock minStockLevel purchasePrice sellingPrice location category'),
    Sale.aggregate([
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        },
      },
    ]),
    Purchase.aggregate([
      { $match: { status: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          spend: { $sum: '$totalAmount' },
        },
      },
    ]),
    Sale.aggregate([
      { $match: { saleDate: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$saleDate' },
            month: { $month: '$saleDate' },
          },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Purchase.aggregate([
      {
        $match: {
          purchaseDate: { $gte: sixMonthsAgo },
          status: { $ne: 'Cancelled' },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$purchaseDate' },
            month: { $month: '$purchaseDate' },
          },
          spend: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          units: { $sum: '$currentStock' },
          stockValue: { $sum: { $multiply: ['$currentStock', '$purchasePrice'] } },
          skuCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'cat',
        },
      },
      { $unwind: '$cat' },
      {
        $project: {
          name: '$cat.name',
          units: 1,
          stockValue: { $round: ['$stockValue', 2] },
          skuCount: 1,
        },
      },
      { $sort: { stockValue: -1 } },
    ]),
    InventoryTransaction.find()
      .sort({ transactionDate: -1 })
      .limit(8)
      .populate('product', 'name sku')
      .populate('performedBy', 'name role'),
    Sale.find()
      .sort({ saleDate: -1 })
      .limit(5)
      .select('invoiceNumber customerName totalAmount paymentStatus saleDate'),
    Purchase.find()
      .sort({ purchaseDate: -1 })
      .limit(5)
      .populate('supplier', 'companyName')
      .select('poNumber supplier totalAmount status purchaseDate'),
  ]);

  let totalStockValue = 0;
  let totalRetailValue = 0;
  let totalUnits = 0;
  const lowStockAlerts: Array<{
    _id: unknown;
    name: string;
    sku: string;
    currentStock: number;
    minStockLevel: number;
    location: string;
    categoryName: string;
  }> = [];

  for (const p of productsList) {
    totalStockValue += p.currentStock * p.purchasePrice;
    totalRetailValue += p.currentStock * p.sellingPrice;
    totalUnits += p.currentStock;
    if (p.currentStock <= p.minStockLevel) {
      const cat = p.category as unknown as { name?: string } | null;
      lowStockAlerts.push({
        _id: p._id,
        name: p.name,
        sku: p.sku,
        currentStock: p.currentStock,
        minStockLevel: p.minStockLevel,
        location: p.location,
        categoryName: cat?.name || 'Uncategorized',
      });
    }
  }

  lowStockAlerts.sort((a, b) => a.currentStock - b.currentStock);

  // Build uniform 6-month series for charts
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyTrends: Array<{
    month: string;
    salesRevenue: number;
    salesOrders: number;
    purchaseSpend: number;
    purchaseOrders: number;
  }> = [];

  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const sMatch = monthlySalesAgg.find((x) => x._id.year === y && x._id.month === m);
    const pMatch = monthlyPurchasesAgg.find((x) => x._id.year === y && x._id.month === m);
    monthlyTrends.push({
      month: `${monthNames[m - 1]} ${String(y).slice(-2)}`,
      salesRevenue: Math.round((sMatch?.revenue || 0) * 100) / 100,
      salesOrders: sMatch?.orders || 0,
      purchaseSpend: Math.round((pMatch?.spend || 0) * 100) / 100,
      purchaseOrders: pMatch?.orders || 0,
    });
  }

  const activityFeed = [
    ...recentTransactions.slice(0, 6).map((tx) => {
      const prod = tx.product as unknown as { name?: string; sku?: string } | null;
      const actor = tx.performedBy as unknown as { name?: string } | null;
      return {
        id: String(tx._id),
        kind: 'inventory' as const,
        title: `${tx.type} · ${prod?.sku || 'SKU'}`,
        description: `${prod?.name || 'Product'} (${tx.previousStock} → ${tx.newStock} units)`,
        actor: actor?.name || 'System',
        timestamp: tx.transactionDate,
      };
    }),
    ...recentSales.slice(0, 3).map((s) => ({
      id: `sale-${s._id}`,
      kind: 'sale' as const,
      title: `Sale ${s.invoiceNumber}`,
      description: `${s.customerName} · $${s.totalAmount.toFixed(2)} (${s.paymentStatus})`,
      actor: 'Sales Desk',
      timestamp: s.saleDate,
    })),
    ...recentPurchases.slice(0, 3).map((p) => {
      const sup = p.supplier as unknown as { companyName?: string } | null;
      return {
        id: `po-${p._id}`,
        kind: 'purchase' as const,
        title: `Purchase ${p.poNumber}`,
        description: `${sup?.companyName || 'Supplier'} · $${p.totalAmount.toFixed(2)} (${p.status})`,
        actor: 'Procurement',
        timestamp: p.purchaseDate,
      };
    }),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  res.json({
    success: true,
    data: {
      stats: {
        totalProducts,
        totalUnits,
        totalStockValue: Math.round(totalStockValue * 100) / 100,
        totalRetailValue: Math.round(totalRetailValue * 100) / 100,
        lowStockCount: lowStockAlerts.length,
        totalSalesCount: salesTotals[0]?.count || 0,
        totalSalesRevenue: Math.round((salesTotals[0]?.revenue || 0) * 100) / 100,
        totalPurchasesCount: purchaseTotals[0]?.count || 0,
        totalPurchasesSpend: Math.round((purchaseTotals[0]?.spend || 0) * 100) / 100,
        totalCategories,
      },
      monthlyTrends,
      inventoryDistribution: categoryDistAgg,
      lowStockAlerts: lowStockAlerts.slice(0, 8),
      recentTransactions,
      activityFeed,
    },
  });
});
