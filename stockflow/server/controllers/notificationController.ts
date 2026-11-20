import { Response } from 'express';
import { Notification } from '../models/Notification';
import { assertValidObjectId } from '../middleware/validate';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listNotifications = asyncHandler(async (_req, res: Response) => {
  const [items, unreadCount] = await Promise.all([
    Notification.find()
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('product', 'name sku currentStock minStockLevel'),
    Notification.countDocuments({ isRead: false }),
  ]);

  res.json({
    success: true,
    data: {
      items,
      unreadCount,
    },
  });
});

export const markNotificationRead = asyncHandler(async (req, res: Response) => {
  const { id } = req.params;
  assertValidObjectId(id, 'notification');

  const notif = await Notification.findByIdAndUpdate(id, { isRead: true }, { new: true });
  if (!notif) {
    throw new ApiError(404, 'Notification not found.');
  }

  res.json({
    success: true,
    data: notif,
  });
});

export const markAllNotificationsRead = asyncHandler(async (_req, res: Response) => {
  await Notification.updateMany({ isRead: false }, { isRead: true });
  res.json({
    success: true,
    message: 'All notifications marked as read.',
  });
});
