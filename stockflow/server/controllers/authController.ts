import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Response } from 'express';
import { User } from '../models/User';
import { AuthRequest, signAuthToken } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

function sanitizeUser(user: {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  department: string;
  phone: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    phone: user.phone,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export const register = asyncHandler(async (req, res: Response) => {
  const { name, email, password, department, phone } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email, and password are required.');
  }
  if (String(password).length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters.');
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new ApiError(409, 'An account with that email already exists.');
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  // Public self-registration is strictly restricted to Staff role for security
  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
    role: 'Staff',
    department: department ? String(department).trim() : 'Warehouse Operations',
    phone: phone ? String(phone).trim() : '',
    lastLoginAt: new Date(),
  });

  const token = signAuthToken(user);
  res.status(201).json({
    success: true,
    data: {
      token,
      user: sanitizeUser(user),
    },
  });
});

export const login = asyncHandler(async (req, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required.');
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (!user || !(await user.comparePassword(String(password)))) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Your account has been deactivated. Contact an administrator.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signAuthToken(user);
  res.json({
    success: true,
    data: {
      token,
      user: sanitizeUser(user),
    },
  });
});

export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Not authenticated.');
  }
  res.json({
    success: true,
    data: sanitizeUser(req.user),
  });
});

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Not authenticated.');
  }
  const { name, department, phone } = req.body;

  if (name) req.user.name = String(name).trim();
  if (department !== undefined) req.user.department = String(department).trim();
  if (phone !== undefined) req.user.phone = String(phone).trim();

  await req.user.save();
  res.json({
    success: true,
    data: sanitizeUser(req.user),
  });
});

export const changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Not authenticated.');
  }
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current password and new password are required.');
  }
  if (String(newPassword).length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters.');
  }

  const userWithHash = await User.findById(req.user._id).select('+passwordHash');
  if (!userWithHash || !(await userWithHash.comparePassword(String(currentPassword)))) {
    throw new ApiError(400, 'Current password is incorrect.');
  }

  userWithHash.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await userWithHash.save();

  res.json({
    success: true,
    message: 'Password updated successfully.',
  });
});

export const forgotPassword = asyncHandler(async (req, res: Response) => {
  const { email } = req.body;
  if (!email) {
    throw new ApiError(400, 'Please enter your account email address.');
  }

  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) {
    // Return uniform response without leaking whether email exists
    res.json({
      success: true,
      message: 'If an account matches that email, a password reset token has been generated.',
    });
    return;
  }

  const rawToken = crypto.randomBytes(20).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  res.json({
    success: true,
    message: 'Password reset token generated. It expires in 15 minutes.',
    // Returned in development/preview so reset workflow can be completed without SMTP
    ...(process.env.NODE_ENV !== 'production' ? { resetToken: rawToken } : {}),
  });
});

export const resetPassword = asyncHandler(async (req, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    throw new ApiError(400, 'Reset token and new password are required.');
  }
  if (String(newPassword).length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters.');
  }

  const hashedToken = crypto.createHash('sha256').update(String(token).trim()).digest('hex');
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
  }).select('+passwordHash +resetPasswordToken +resetPasswordExpires');

  if (!user) {
    throw new ApiError(400, 'Password reset token is invalid or has expired.');
  }

  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({
    success: true,
    message: 'Your password has been reset. You can now sign in.',
  });
});
