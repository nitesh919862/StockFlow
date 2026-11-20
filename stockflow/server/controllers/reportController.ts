import { Response } from 'express';
import { Sale } from '../models/Sale';
import { SaleItem } from '../models/SaleItem';
import { Purchase } from '../models/Purchase';
import { Product } from '../models/Product';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { toCsv } from '../utils/csv';

async function buildDailySalesData() {
  return Sale.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
        orders: { $sum: 1 },
        subtotal: { $sum: '$subtotal' },
        discount: { $sum: '$discountAmount' },
        revenue: { $sum: '$totalAmount' },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: 30 },
    {
      $project: {
        _id: 0,
        date: '$_id',
        orders: 1,
        subtotal: { $round: ['$subtotal', 2] },
        discount: { $round: ['$discount', 2] },
        revenue: { $round: ['$revenue', 2] },
      },
    },
  ]);
}

async function buildMonthlySalesData() {
  return Sale.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$saleDate' } },
        orders: { $sum: 1 },
        subtotal: { $sum: '$subtotal' },
        discount: { $sum: '$discountAmount' },
        revenue: { $sum: '$totalAmount' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        month: '$_id',
        orders: 1,
        subtotal: { $round: ['$subtotal', 2] },
        discount: { $round: ['$discount', 2] },
        revenue: { $round: ['$revenue', 2] },
      },
    },
  ]);
}

async function buildProductPerformanceData() {
  return SaleItem.aggregate([
    {
      $group: {
        _id: '$product',
        productName: { $first: '$productName' },
        sku: { $first: '$sku' },
        unitsSold: { $sum: '$quantity' },
        revenue: { $sum: '$lineTotal' },
        costOfGoods: { $sum: { $multiply: ['$quantity', '$purchasePriceAtSale'] } },
      },
    },
    {
      $project: {
        _id: 0,
        productId: '$_id',
        productName: 1,
        sku: 1,
        unitsSold: 1,
        revenue: { $round: ['$revenue', 2] },
        costOfGoods: { $round: ['$costOfGoods', 2] },
        grossProfit: { $round: [{ $subtract: ['$revenue', '$costOfGoods'] }, 2] },
      },
    },
    { $sort: { revenue: -1 } },
  ]);
}

async function buildInventoryValuationData() {
  const products = await Product.find({ isActive: true })
    .populate('category', 'name')
    .sort({ name: 1 });

  return products.map((p) => {
    const cat = p.category as unknown as { name?: string } | null;
    const costValue = Math.round(p.currentStock * p.purchasePrice * 100) / 100;
    const retailValue = Math.round(p.currentStock * p.sellingPrice * 100) / 100;
    return {
      sku: p.sku,
      name: p.name,
      category: cat?.name || 'Uncategorized',
      location: p.location,
      currentStock: p.currentStock,
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      costValue,
      retailValue,
      potentialMargin: Math.round((retailValue - costValue) * 100) / 100,
    };
  });
}

async function buildLowStockData() {
  const products = await Product.find({
    isActive: true,
    $expr: { $lte: ['$currentStock', '$minStockLevel'] },
  })
    .populate('category', 'name')
    .populate('supplier', 'companyName email phone')
    .sort({ currentStock: 1 });

  return products.map((p) => {
    const cat = p.category as unknown as { name?: string } | null;
    const sup = p.supplier as unknown as { companyName?: string; email?: string } | null;
    const deficit = Math.max(0, p.minStockLevel - p.currentStock);
    return {
      sku: p.sku,
      name: p.name,
      category: cat?.name || 'Uncategorized',
      supplier: sup?.companyName || 'Unknown',
      supplierEmail: sup?.email || '',
      currentStock: p.currentStock,
      minStockLevel: p.minStockLevel,
      reorderSuggested: deficit + 10,
      estimatedReorderCost: Math.round((deficit + 10) * p.purchasePrice * 100) / 100,
      status: p.currentStock === 0 ? 'Out of Stock' : 'Low Stock',
    };
  });
}

async function buildPurchaseReportData() {
  const purchases = await Purchase.find()
    .populate('supplier', 'companyName')
    .sort({ purchaseDate: -1 });

  return purchases.map((po) => {
    const sup = po.supplier as unknown as { companyName?: string } | null;
    return {
      poNumber: po.poNumber,
      supplier: sup?.companyName || 'Unknown',
      status: po.status,
      subtotal: po.subtotal,
      shippingCost: po.shippingCost,
      totalAmount: po.totalAmount,
      purchaseDate: po.purchaseDate.toISOString().slice(0, 10),
      receivedDate: po.receivedDate ? po.receivedDate.toISOString().slice(0, 10) : '',
    };
  });
}

export const getReportsOverview = asyncHandler(async (_req, res: Response) => {
  const [
    dailySales,
    monthlySales,
    productPerformance,
    inventoryValuation,
    lowStock,
    purchases,
  ] = await Promise.all([
    buildDailySalesData(),
    buildMonthlySalesData(),
    buildProductPerformanceData(),
    buildInventoryValuationData(),
    buildLowStockData(),
    buildPurchaseReportData(),
  ]);

  res.json({
    success: true,
    data: {
      dailySales,
      monthlySales,
      productPerformance,
      inventoryValuation,
      lowStock,
      purchases,
    },
  });
});

export const exportReportCsv = asyncHandler(async (req, res: Response) => {
  const { type } = req.params;
  let csvContent = '';
  let filename = `stockflow-${type}-report.csv`;

  if (type === 'daily-sales') {
    const rows = await buildDailySalesData();
    csvContent = toCsv(
      ['Date', 'Orders', 'Subtotal', 'Discount', 'Revenue'],
      rows.map((r) => [r.date, r.orders, r.subtotal, r.discount, r.revenue])
    );
  } else if (type === 'monthly-sales') {
    const rows = await buildMonthlySalesData();
    csvContent = toCsv(
      ['Month', 'Orders', 'Subtotal', 'Discount', 'Revenue'],
      rows.map((r) => [r.month, r.orders, r.subtotal, r.discount, r.revenue])
    );
  } else if (type === 'product-performance') {
    const rows = await buildProductPerformanceData();
    csvContent = toCsv(
      ['SKU', 'Product Name', 'Units Sold', 'Revenue', 'COGS', 'Gross Profit'],
      rows.map((r) => [r.sku, r.productName, r.unitsSold, r.revenue, r.costOfGoods, r.grossProfit])
    );
  } else if (type === 'inventory-valuation') {
    const rows = await buildInventoryValuationData();
    csvContent = toCsv(
      ['SKU', 'Product Name', 'Category', 'Location', 'Stock', 'Unit Cost', 'Selling Price', 'Cost Value', 'Retail Value', 'Potential Margin'],
      rows.map((r) => [
        r.sku,
        r.name,
        r.category,
        r.location,
        r.currentStock,
        r.purchasePrice,
        r.sellingPrice,
        r.costValue,
        r.retailValue,
        r.potentialMargin,
      ])
    );
  } else if (type === 'low-stock') {
    const rows = await buildLowStockData();
    csvContent = toCsv(
      ['SKU', 'Product Name', 'Category', 'Supplier', 'Current Stock', 'Min Stock', 'Status', 'Suggested Reorder Qty', 'Est. Reorder Cost'],
      rows.map((r) => [
        r.sku,
        r.name,
        r.category,
        r.supplier,
        r.currentStock,
        r.minStockLevel,
        r.status,
        r.reorderSuggested,
        r.estimatedReorderCost,
      ])
    );
  } else if (type === 'purchases') {
    const rows = await buildPurchaseReportData();
    csvContent = toCsv(
      ['PO Number', 'Supplier', 'Status', 'Subtotal', 'Shipping', 'Total Amount', 'Purchase Date', 'Received Date'],
      rows.map((r) => [
        r.poNumber,
        r.supplier,
        r.status,
        r.subtotal,
        r.shippingCost,
        r.totalAmount,
        r.purchaseDate,
        r.receivedDate,
      ])
    );
  } else {
    throw new ApiError(400, 'Unknown report type requested.');
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
});
