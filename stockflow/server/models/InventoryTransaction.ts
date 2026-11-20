import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type InventoryTransactionType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER' | 'SALE' | 'PURCHASE';

export interface IInventoryTransaction extends Document {
  product: Types.ObjectId;
  type: InventoryTransactionType;
  quantity: number;
  previousStock: number;
  newStock: number;
  fromLocation: string;
  toLocation: string;
  referenceType: 'Manual' | 'Sale' | 'Purchase';
  referenceId?: Types.ObjectId;
  referenceCode?: string;
  reason: string;
  performedBy: Types.ObjectId;
  transactionDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryTransactionSchema = new Schema<IInventoryTransaction>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER', 'SALE', 'PURCHASE'],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative'],
    },
    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },
    newStock: {
      type: Number,
      required: true,
      min: 0,
    },
    fromLocation: {
      type: String,
      trim: true,
      default: '',
    },
    toLocation: {
      type: String,
      trim: true,
      default: '',
    },
    referenceType: {
      type: String,
      enum: ['Manual', 'Sale', 'Purchase'],
      default: 'Manual',
    },
    referenceId: {
      type: Schema.Types.ObjectId,
    },
    referenceCode: {
      type: String,
      trim: true,
      default: '',
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    transactionDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const InventoryTransaction: Model<IInventoryTransaction> =
  mongoose.models.InventoryTransaction ||
  mongoose.model<IInventoryTransaction>('InventoryTransaction', inventoryTransactionSchema);
