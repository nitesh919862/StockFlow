import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type NotificationType =
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'PURCHASE_RECEIVED'
  | 'SALE_CREATED'
  | 'SYSTEM';

export interface INotification extends Document {
  title: string;
  message: string;
  type: NotificationType;
  severity: 'info' | 'warning' | 'critical';
  product?: Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['LOW_STOCK', 'OUT_OF_STOCK', 'PURCHASE_RECEIVED', 'SALE_CREATED', 'SYSTEM'],
      default: 'SYSTEM',
      index: true,
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', notificationSchema);
