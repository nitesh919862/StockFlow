import React, { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Trash2, Shield } from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import { useAuth, UserRole } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { EmptyState, ErrorBanner, TableSkeleton } from '../components/ui/StateViews';

interface TeamUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  phone: string;
  isActive: boolean;
  lastLoginAt?: string;
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Staff');
  const [department, setDepartment] = useState('Warehouse Operations');
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/users');
      setUsers(res.data.data || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load team directory.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users', { name, email, password, role, department });
      showToast('Team member created.', 'success');
      setCreateOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      fetchUsers();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to create user.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (id: string, nextRole: UserRole) => {
    try {
      await api.put(`/users/${id}`, { role: nextRole });
      showToast('User role updated.', 'success');
      fetchUsers();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to update role.'), 'error');
    }
  };

  const handleToggleActive = async (u: TeamUser) => {
    try {
      await api.put(`/users/${u._id}`, { isActive: !u.isActive });
      showToast(u.isActive ? 'User deactivated.' : 'User activated.', 'success');
      fetchUsers();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to update status.'), 'error');
    }
  };

  const handleDelete = async (u: TeamUser) => {
    try {
      await api.delete(`/users/${u._id}`);
      showToast(`Removed ${u.name}.`, 'success');
      fetchUsers();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete user.'), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          Manage user accounts and enforce role-based access control on backend endpoints.
        </p>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Add Team User
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchUsers} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users found"
          description="Create accounts for warehouse managers and fulfillment staff."
        />
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">Member</th>
                  <th className="px-4 py-3.5">Department</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelf = u._id === currentUser?.id;
                  return (
                    <tr key={u._id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900">
                          {u.name} {isSelf && <span className="text-xs text-blue-600">(You)</span>}
                        </p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">{u.department}</td>
                      <td className="px-4 py-3.5">
                        <select
                          disabled={isSelf}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u._id, e.target.value as UserRole)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium disabled:opacity-60"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Manager">Manager</option>
                          <option value="Staff">Staff</option>
                        </select>
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => handleToggleActive(u)}
                          className={`text-xs font-semibold disabled:opacity-60 ${
                            u.isActive ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Team Member"
        subtitle="Assign Admin, Manager, or Staff permissions."
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Temporary Password *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              >
                <option value="Staff">Staff</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 flex items-start gap-2">
            <Shield className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              Admin: full access · Manager: products, inventory, suppliers, sales &amp; POs · Staff:
              operational stock &amp; sales entries.
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
