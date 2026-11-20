import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ISaleItem extends Document {
  sale: Types.ObjectId;
  product: Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  purchasePriceAtSale: number;
  lineTotal: number;
  createdAt: Date;
  updatedAt: Date;
}

const saleItemSchema = new Schema<ISaleItem>(
  {
    sale: {
      type: Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
      index: true,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price cannot be negative'],
    },
    purchasePriceAtSale: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: [0, 'Line total cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

export const SaleItem: Model<ISaleItem> =
  mongoose.models.SaleItem || mongoose.model<ISaleItem>('SaleItem', saleItemSchema);
