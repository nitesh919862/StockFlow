import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ILocationStock {
  location: string;
  quantity: number;
}

export interface IProduct extends Document {
  name: string;
  sku: string;
  barcode: string;
  category: Types.ObjectId;
  supplier: Types.ObjectId;
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  minStockLevel: number;
  location: string;
  locationStocks: ILocationStock[];
  description: string;
  imageUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const locationStockSchema = new Schema<ILocationStock>(
  {
    location: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [140, 'Product name cannot exceed 140 characters'],
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    barcode: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      index: true,
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier is required'],
      index: true,
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: [0, 'Purchase price cannot be negative'],
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Selling price cannot be negative'],
    },
    currentStock: {
      type: Number,
      required: true,
      min: [0, 'Stock cannot be negative'],
      default: 0,
      index: true,
    },
    minStockLevel: {
      type: Number,
      required: true,
      min: [0, 'Minimum stock level cannot be negative'],
      default: 10,
    },
    location: {
      type: String,
      trim: true,
      default: 'Main Warehouse',
    },
    locationStocks: {
      type: [locationStockSchema],
      default: [{ location: 'Main Warehouse', quantity: 0 }],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1200, 'Description cannot exceed 1200 characters'],
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ name: 'text', sku: 'text', barcode: 'text', description: 'text' });

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>('Product', productSchema);
