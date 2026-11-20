import bcrypt from 'bcryptjs';
import { Response } from 'express';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { assertValidObjectId } from '../middleware/validate';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listUsers = asyncHandler(async (_req, res: Response) => {
  const users = await User.find()
    .select('-passwordHash -resetPasswordToken -resetPasswordExpires')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: users,
  });
});

export const createUser = asyncHandler(async (req, res: Response) => {
  const { name, email, password, role = 'Staff', department = 'Warehouse Operations', phone = '' } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email, and password are required.');
  }
  if (!['Admin', 'Manager', 'Staff'].includes(role)) {
    throw new ApiError(400, 'Role must be Admin, Manager, or Staff.');
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new ApiError(409, 'A user with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
    role,
    department: String(department).trim(),
    phone: String(phone).trim(),
  });

  res.status(201).json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      phone: user.phone,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
  });
});

export const updateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  assertValidObjectId(id, 'user');

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  const { name, role, department, phone, isActive } = req.body;

  if (req.user && String(req.user._id) === id && isActive === false) {
    throw new ApiError(400, 'You cannot deactivate your own account.');
  }

  if (name !== undefined) user.name = String(name).trim();
  if (role !== undefined) {
    if (!['Admin', 'Manager', 'Staff'].includes(role)) {
      throw new ApiError(400, 'Role must be Admin, Manager, or Staff.');
    }
    user.role = role;
  }
  if (department !== undefined) user.department = String(department).trim();
  if (phone !== undefined) user.phone = String(phone).trim();
  if (isActive !== undefined) user.isActive = Boolean(isActive);

  await user.save();

  res.json({
    success: true,
    data: user,
  });
});

export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  assertValidObjectId(id, 'user');

  if (req.user && String(req.user._id) === id) {
    throw new ApiError(400, 'You cannot delete your own account.');
  }

  const user = await User.findByIdAndDelete(id);
  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  res.json({
    success: true,
    message: `User "${user.name}" removed.`,
  });
});
