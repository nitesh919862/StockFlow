import { Types } from 'mongoose';
import { Product, IProduct } from '../models/Product';
import { InventoryTransaction } from '../models/InventoryTransaction';
import { Notification } from '../models/Notification';
import { ApiError } from '../utils/ApiError';

async function checkAndNotifyLowStock(product: IProduct): Promise<void> {
  if (product.currentStock <= 0) {
    await Notification.create({
      title: 'Out of Stock Alert',
      message: `${product.name} [${product.sku}] has reached 0 units.`,
      type: 'OUT_OF_STOCK',
      severity: 'critical',
      product: product._id,
    });
  } else if (product.currentStock <= product.minStockLevel) {
    await Notification.create({
      title: 'Low Stock Warning',
      message: `${product.name} [${product.sku}] is at ${product.currentStock} units (minimum: ${product.minStockLevel}).`,
      type: 'LOW_STOCK',
      severity: 'warning',
      product: product._id,
    });
  }
}

function adjustLocationBucket(
  product: IProduct,
  location: string,
  delta: number
): void {
  const targetLoc = location.trim() || product.location || 'Main Warehouse';
  const idx = product.locationStocks.findIndex(
    (entry) => entry.location.toLowerCase() === targetLoc.toLowerCase()
  );

  if (idx >= 0) {
    const nextQty = product.locationStocks[idx].quantity + delta;
    if (nextQty < 0) {
      throw new ApiError(
        400,
        `Insufficient stock at location "${targetLoc}" for ${product.name}. Available: ${product.locationStocks[idx].quantity}.`
      );
    }
    product.locationStocks[idx].quantity = nextQty;
  } else {
    if (delta < 0) {
      throw new ApiError(
        400,
        `Location "${targetLoc}" currently has 0 units of ${product.name}.`
      );
    }
    product.locationStocks.push({ location: targetLoc, quantity: delta });
  }
}

export async function performInventoryOperation(params: {
  productId: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  reason?: string;
  userId: Types.ObjectId;
}): Promise<{ product: IProduct; transaction: unknown }> {
  const { productId, type, quantity, fromLocation, toLocation, reason, userId } = params;

  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new ApiError(400, 'Quantity must be a valid non-negative number.');
  }
  if (type !== 'ADJUSTMENT' && quantity <= 0) {
    throw new ApiError(400, 'Quantity must be greater than 0.');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  const previousStock = product.currentStock;
  let newStock = previousStock;
  let txQty = quantity;

  if (type === 'IN') {
    const loc = toLocation?.trim() || product.location || 'Main Warehouse';
    newStock = previousStock + quantity;
    adjustLocationBucket(product, loc, quantity);
    product.currentStock = newStock;
  } else if (type === 'OUT') {
    if (previousStock < quantity) {
      throw new ApiError(
        400,
        `Insufficient stock for ${product.name}. Available: ${previousStock}, requested: ${quantity}.`
      );
    }
    const loc = fromLocation?.trim() || product.location || 'Main Warehouse';
    // If specific location doesn't have enough, fall back to deducting across buckets or validate primary
    const bucket = product.locationStocks.find(
      (b) => b.location.toLowerCase() === loc.toLowerCase()
    );
    if (bucket && bucket.quantity >= quantity) {
      bucket.quantity -= quantity;
    } else {
      let remaining = quantity;
      for (const b of product.locationStocks) {
        if (remaining <= 0) break;
        const deduct = Math.min(b.quantity, remaining);
        b.quantity -= deduct;
        remaining -= deduct;
      }
    }
    newStock = previousStock - quantity;
    product.currentStock = newStock;
  } else if (type === 'ADJUSTMENT') {
    // Here quantity represents the new counted stock total
    newStock = quantity;
    txQty = Math.abs(newStock - previousStock);
    const delta = newStock - previousStock;
    const loc = toLocation?.trim() || product.location || 'Main Warehouse';
    if (delta !== 0) {
      if (delta > 0) {
        adjustLocationBucket(product, loc, delta);
      } else {
        let remaining = Math.abs(delta);
        for (const b of product.locationStocks) {
          if (remaining <= 0) break;
          const deduct = Math.min(b.quantity, remaining);
          b.quantity -= deduct;
          remaining -= deduct;
        }
      }
    }
    product.currentStock = newStock;
  } else if (type === 'TRANSFER') {
    const src = fromLocation?.trim();
    const dst = toLocation?.trim();
    if (!src || !dst) {
      throw new ApiError(400, 'Both source and destination locations are required for transfers.');
    }
    if (src.toLowerCase() === dst.toLowerCase()) {
      throw new ApiError(400, 'Source and destination locations must be different.');
    }
    adjustLocationBucket(product, src, -quantity);
    adjustLocationBucket(product, dst, quantity);
    newStock = previousStock;
    product.location = dst;
  }

  await product.save();

  const transaction = await InventoryTransaction.create({
    product: product._id,
    type,
    quantity: txQty,
    previousStock,
    newStock,
    fromLocation: fromLocation || '',
    toLocation: toLocation || product.location,
    referenceType: 'Manual',
    reason: reason?.trim() || `Manual ${type.toLowerCase()} operation`,
    performedBy: userId,
    transactionDate: new Date(),
  });

  if (type === 'OUT' || type === 'ADJUSTMENT') {
    await checkAndNotifyLowStock(product);
  }

  return { product, transaction };
}

export async function deductStockForSaleItems(params: {
  items: Array<{ productId: string; quantity: number }>;
  saleId: Types.ObjectId;
  invoiceNumber: string;
  userId: Types.ObjectId;
}): Promise<Array<{ product: IProduct; quantity: number }>> {
  const { items, saleId, invoiceNumber, userId } = params;
  const deducted: Array<{ product: IProduct; quantity: number; previousStock: number }> = [];

  try {
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new ApiError(400, 'Each sale item quantity must be a positive integer.');
      }

      // Atomic conditional stock decrement prevents race conditions and negative stock
      const updated = await Product.findOneAndUpdate(
        {
          _id: item.productId,
          currentStock: { $gte: item.quantity },
        },
        {
          $inc: { currentStock: -item.quantity },
        },
        { new: true }
      );

      if (!updated) {
        const existing = await Product.findById(item.productId);
        if (!existing) {
          throw new ApiError(404, `Product ${item.productId} not found.`);
        }
        throw new ApiError(
          400,
          `Insufficient stock for "${existing.name}" (Available: ${existing.currentStock}, Requested: ${item.quantity}).`
        );
      }

      // Sync location buckets safely
      let remaining = item.quantity;
      for (const bucket of updated.locationStocks) {
        if (remaining <= 0) break;
        const take = Math.min(bucket.quantity, remaining);
        bucket.quantity -= take;
        remaining -= take;
      }
      await updated.save();

      deducted.push({
        product: updated,
        quantity: item.quantity,
        previousStock: updated.currentStock + item.quantity,
      });
    }

    // Create inventory transaction ledger records & low-stock alerts
    for (const entry of deducted) {
      await InventoryTransaction.create({
        product: entry.product._id,
        type: 'SALE',
        quantity: entry.quantity,
        previousStock: entry.previousStock,
        newStock: entry.product.currentStock,
        fromLocation: entry.product.location,
        referenceType: 'Sale',
        referenceId: saleId,
        referenceCode: invoiceNumber,
        reason: `Sold via ${invoiceNumber}`,
        performedBy: userId,
        transactionDate: new Date(),
      });
      await checkAndNotifyLowStock(entry.product);
    }

    return deducted.map((d) => ({ product: d.product, quantity: d.quantity }));
  } catch (err) {
    // Compensating atomic rollback if any item failed mid-order
    for (const entry of deducted) {
      await Product.findByIdAndUpdate(entry.product._id, {
        $inc: { currentStock: entry.quantity },
      });
    }
    throw err;
  }
}

export async function receiveStockForPurchaseItems(params: {
  items: Array<{ productId: Types.ObjectId; quantity: number; unitCost: number }>;
  purchaseId: Types.ObjectId;
  poNumber: string;
  userId: Types.ObjectId;
}): Promise<void> {
  const { items, purchaseId, poNumber, userId } = params;

  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) continue;

    const previousStock = product.currentStock;
    const newStock = previousStock + item.quantity;
    product.currentStock = newStock;
    product.purchasePrice = item.unitCost;
    adjustLocationBucket(product, product.location || 'Main Warehouse', item.quantity);
    await product.save();

    await InventoryTransaction.create({
      product: product._id,
      type: 'PURCHASE',
      quantity: item.quantity,
      previousStock,
      newStock,
      toLocation: product.location || 'Main Warehouse',
      referenceType: 'Purchase',
      referenceId: purchaseId,
      referenceCode: poNumber,
      reason: `Received purchase order ${poNumber}`,
      performedBy: userId,
      transactionDate: new Date(),
    });
  }

  await Notification.create({
    title: 'Purchase Order Received',
    message: `${poNumber} has been received and warehouse stock updated.`,
    type: 'PURCHASE_RECEIVED',
    severity: 'info',
  });
}
