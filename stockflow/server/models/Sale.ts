import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type PaymentStatus = 'Paid' | 'Pending' | 'Partial';
export type PaymentMethod = 'Card' | 'Cash' | 'Bank Transfer' | 'Invoice';

export interface ISale extends Document {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: Types.ObjectId[];
  subtotal: number;
  discountType: 'fixed' | 'percent';
  discountValue: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes: string;
  createdBy: Types.ObjectId;
  saleDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const saleSchema = new Schema<ISale>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    customerPhone: {
      type: String,
      trim: true,
      default: '',
    },
    items: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SaleItem',
      },
    ],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discountType: {
      type: String,
      enum: ['fixed', 'percent'],
      default: 'fixed',
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Pending', 'Partial'],
      default: 'Paid',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['Card', 'Cash', 'Bank Transfer', 'Invoice'],
      default: 'Invoice',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    saleDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Sale: Model<ISale> = mongoose.models.Sale || mongoose.model<ISale>('Sale', saleSchema);
