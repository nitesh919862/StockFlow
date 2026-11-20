import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type PurchaseStatus = 'Pending' | 'Received' | 'Cancelled';

export interface IPurchase extends Document {
  poNumber: string;
  supplier: Types.ObjectId;
  items: Types.ObjectId[];
  subtotal: number;
  shippingCost: number;
  totalAmount: number;
  status: PurchaseStatus;
  expectedDate?: Date;
  receivedDate?: Date;
  notes: string;
  createdBy: Types.ObjectId;
  receivedBy?: Types.ObjectId;
  purchaseDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseSchema = new Schema<IPurchase>(
  {
    poNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    items: [
      {
        type: Schema.Types.ObjectId,
        ref: 'PurchaseItem',
      },
    ],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Pending', 'Received', 'Cancelled'],
      default: 'Pending',
      index: true,
    },
    expectedDate: {
      type: Date,
    },
    receivedDate: {
      type: Date,
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
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Purchase: Model<IPurchase> =
  mongoose.models.Purchase || mongoose.model<IPurchase>('Purchase', purchaseSchema);
