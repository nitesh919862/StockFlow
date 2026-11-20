import React, { useCallback, useEffect, useState } from 'react';
import { Truck, Plus, Search, Edit2, Trash2, History } from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { EmptyState, ErrorBanner, TableSkeleton } from '../components/ui/StateViews';

interface SupplierRow {
  _id: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  notes: string;
  orderCount: number;
  totalSpend: number;
  productCount: number;
}

interface SupplierHistory {
  supplier: SupplierRow;
  purchases: Array<{
    _id: string;
    poNumber: string;
    status: string;
    totalAmount: number;
    purchaseDate: string;
  }>;
  products: Array<{
    _id: string;
    name: string;
    sku: string;
    currentStock: number;
    purchasePrice: number;
  }>;
}

const emptyForm = {
  name: '',
  companyName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  country: 'USA',
  notes: '',
};

export function SuppliersPage() {
  const { isAdmin, isManagerOrAdmin } = useAuth();
  const { showToast } = useToast();

  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [historyData, setHistoryData] = useState<SupplierHistory | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/suppliers', { params: { search } });
      setSuppliers(res.data.data || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load suppliers.'));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchSuppliers, 150);
    return () => clearTimeout(t);
  }, [fetchSuppliers]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (s: SupplierRow) => {
    setEditingId(s._id);
    setForm({
      name: s.name,
      companyName: s.companyName,
      email: s.email,
      phone: s.phone,
      address: s.address,
      city: s.city || '',
      country: s.country || 'USA',
      notes: s.notes || '',
    });
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/suppliers/${editingId}`, form);
        showToast('Supplier updated.', 'success');
      } else {
        await api.post('/suppliers', form);
        showToast('Supplier added.', 'success');
      }
      setFormOpen(false);
      fetchSuppliers();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to save supplier.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: SupplierRow) => {
    try {
      await api.delete(`/suppliers/${s._id}`);
      showToast(`Deleted "${s.companyName}".`, 'success');
      fetchSuppliers();
    } catch (err) {
      showToast(getErrorMessage(err, 'Cannot delete supplier.'), 'error');
    }
  };

  const openHistory = async (id: string) => {
    try {
      const res = await api.get(`/suppliers/${id}`);
      setHistoryData(res.data.data);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to load supplier history.'), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search supplier company or contact..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        {isManagerOrAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Add Supplier
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchSuppliers} />
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No suppliers found"
          description="Add your vendors and wholesale partners to track purchase orders and lead times."
          actionLabel={isManagerOrAdmin ? 'Add Supplier' : undefined}
          onAction={isManagerOrAdmin ? openCreate : undefined}
        />
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">Company · Contact</th>
                  <th className="px-4 py-3.5">Email · Phone</th>
                  <th className="px-4 py-3.5">Location</th>
                  <th className="px-4 py-3.5 text-right">SKUs / Orders</th>
                  <th className="px-4 py-3.5 text-right">Total Spend</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">{s.companyName}</p>
                      <p className="text-xs text-slate-500">{s.name}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      <p>{s.email}</p>
                      <p className="font-mono-tabular text-slate-500">{s.phone}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      <p>{s.address}</p>
                      <p className="text-slate-500">
                        {[s.city, s.country].filter(Boolean).join(', ')}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-tabular text-xs text-slate-700">
                      {s.productCount} SKUs · {s.orderCount} POs
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-tabular font-semibold text-slate-900">
                      ${s.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openHistory(s._id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title="View purchase history"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        {isManagerOrAdmin && (
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                            title="Edit supplier"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDelete(s)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                            title="Delete supplier"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Supplier Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Edit Supplier' : 'Add Supplier'}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone *</label>
              <input
                type="text"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Address *</label>
              <input
                type="text"
                required
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City / State</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Supplier History Modal */}
      <Modal
        open={Boolean(historyData)}
        onClose={() => setHistoryData(null)}
        title={historyData?.supplier.companyName || 'Supplier History'}
        subtitle={
          historyData
            ? `${historyData.supplier.name} · ${historyData.supplier.email} · ${historyData.supplier.phone}`
            : ''
        }
        maxWidthClass="max-w-2xl"
      >
        {historyData && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 mb-2">
                Purchase Order History ({historyData.purchases.length})
              </h3>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {historyData.purchases.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-slate-500">No purchase orders yet.</p>
                ) : (
                  historyData.purchases.map((po) => (
                    <div key={po._id} className="px-4 py-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono-tabular font-semibold text-slate-900">
                          {po.poNumber}
                        </span>
                        <span className="text-slate-400 mx-2">·</span>
                        <span className="text-slate-600">
                          {new Date(po.purchaseDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={`font-medium ${
                            po.status === 'Received'
                              ? 'text-emerald-600'
                              : po.status === 'Cancelled'
                              ? 'text-red-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {po.status}
                        </span>
                        <span className="font-mono-tabular font-semibold text-slate-900">
                          ${po.totalAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-500 mb-2">
                Supplied Products ({historyData.products.length})
              </h3>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {historyData.products.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-slate-500">No linked products.</p>
                ) : (
                  historyData.products.map((prod) => (
                    <div key={prod._id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium text-slate-900">{prod.name}</span>
                        <span className="text-slate-400 ml-2 font-mono-tabular">{prod.sku}</span>
                      </div>
                      <span className="font-mono-tabular text-slate-700">
                        {prod.currentStock} in stock · ${prod.purchasePrice.toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
