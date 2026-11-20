import React, { useCallback, useEffect, useState } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Trash2,
} from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { EmptyState, ErrorBanner, TableSkeleton } from '../components/ui/StateViews';

interface SupplierOption {
  _id: string;
  companyName: string;
}

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
  purchasePrice: number;
  currentStock: number;
}

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  supplier?: { _id: string; companyName: string };
  subtotal: number;
  shippingCost: number;
  totalAmount: number;
  status: 'Pending' | 'Received' | 'Cancelled';
  purchaseDate: string;
  receivedDate?: string;
  notes: string;
  items: Array<{
    _id: string;
    productName: string;
    sku: string;
    quantity: number;
    unitCost: number;
    lineTotal: number;
  }>;
}

export function PurchasesPage() {
  const { isManagerOrAdmin } = useAuth();
  const { showToast } = useToast();

  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [shippingCost, setShippingCost] = useState('0');
  const [initialStatus, setInitialStatus] = useState<'Pending' | 'Received'>('Pending');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{ productId: string; quantity: number; unitCost: number }>>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchMeta = useCallback(async () => {
    try {
      const [supRes, prodRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/products', { params: { limit: 100 } }),
      ]);
      setSuppliers(supRes.data.data || []);
      setProducts(prodRes.data.data.items || []);
    } catch {
      // handled on submit
    }
  }, []);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/purchases', {
        params: { search, status: statusFilter, limit: 30 },
      });
      setPurchases(res.data.data.items || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load purchase orders.'));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    const t = setTimeout(fetchPurchases, 150);
    return () => clearTimeout(t);
  }, [fetchPurchases]);

  const openCreateModal = () => {
    setSupplierId(suppliers[0]?._id || '');
    setShippingCost('0');
    setInitialStatus('Pending');
    setNotes('');
    setItems(
      products.length > 0
        ? [
            {
              productId: products[0]._id,
              quantity: 10,
              unitCost: products[0].purchasePrice,
            },
          ]
        : []
    );
    setCreateOpen(true);
  };

  const addLine = () => {
    if (products.length === 0) return;
    setItems((prev) => [
      ...prev,
      { productId: products[0]._id, quantity: 10, unitCost: products[0].purchasePrice },
    ]);
  };

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
  const grandTotal = subtotal + (Number(shippingCost) || 0);

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || items.length === 0) {
      showToast('Select a supplier and at least one product.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/purchases', {
        supplierId,
        items,
        shippingCost: Number(shippingCost) || 0,
        status: initialStatus,
        notes,
      });
      showToast(`Purchase order ${res.data.data.poNumber} created.`, 'success');
      setCreateOpen(false);
      await Promise.all([fetchPurchases(), fetchMeta()]);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to create purchase order.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: 'Received' | 'Cancelled') => {
    try {
      await api.patch(`/purchases/${id}/status`, { status });
      showToast(
        status === 'Received'
          ? 'Purchase order marked Received. Warehouse stock updated.'
          : 'Purchase order cancelled.',
        'success'
      );
      await Promise.all([fetchPurchases(), fetchMeta()]);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to update purchase status.'), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PO number or notes..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All PO Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Received">Received</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {isManagerOrAdmin && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            New Purchase Order
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchPurchases} />
      ) : purchases.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No purchase orders found"
          description="Create purchase orders to replenish inventory from your suppliers."
          actionLabel={isManagerOrAdmin ? 'New Purchase Order' : undefined}
          onAction={isManagerOrAdmin ? openCreateModal : undefined}
        />
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">PO Number · Date</th>
                  <th className="px-4 py-3.5">Supplier</th>
                  <th className="px-4 py-3.5">Items</th>
                  <th className="px-4 py-3.5 text-right">Total Cost</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((po) => (
                  <tr key={po._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-mono-tabular font-semibold text-slate-900">{po.poNumber}</p>
                      <p className="text-xs text-slate-500 font-mono-tabular">
                        {new Date(po.purchaseDate).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-900">
                      {po.supplier?.companyName || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {po.items
                        ?.map((i) => `${i.sku} (${i.quantity})`)
                        .join(', ')}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-tabular font-semibold text-slate-900">
                      ${po.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-xs font-semibold ${
                          po.status === 'Received'
                            ? 'text-emerald-600'
                            : po.status === 'Cancelled'
                            ? 'text-red-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {po.status === 'Pending' && isManagerOrAdmin ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(po._id, 'Received')}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Receive Stock
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(po._id, 'Cancelled')}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-600"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {po.receivedDate
                            ? `Received ${new Date(po.receivedDate).toLocaleDateString()}`
                            : 'Closed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Purchase Order Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Purchase Order"
        subtitle="Marking a PO as Received automatically increments product stock and records a ledger entry."
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleCreatePo} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier *</label>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              >
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Initial Status
              </label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value as 'Pending' | 'Received')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              >
                <option value="Pending">Pending (On Order)</option>
                <option value="Received">Received Immediately</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">Order Items *</label>
              <button
                type="button"
                onClick={addLine}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                + Add Product
              </button>
            </div>
            <div className="space-y-2">
              {items.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center rounded-lg border border-slate-200 p-2.5"
                >
                  <div className="col-span-12 sm:col-span-5">
                    <select
                      value={row.productId}
                      onChange={(e) => {
                        const prod = products.find((p) => p._id === e.target.value);
                        const next = [...items];
                        next[idx].productId = e.target.value;
                        if (prod) next[idx].unitCost = prod.purchasePrice;
                        setItems(next);
                      }}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs bg-white"
                    >
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.sku} · {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx].quantity = Math.max(1, parseInt(e.target.value, 10) || 1);
                        setItems(next);
                      }}
                      placeholder="Qty"
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono-tabular"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.unitCost}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx].unitCost = Math.max(0, Number(e.target.value) || 0);
                        setItems(next);
                      }}
                      placeholder="Cost $"
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono-tabular"
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2 text-right text-xs font-mono-tabular font-semibold text-slate-900">
                    ${(row.quantity * row.unitCost).toFixed(2)}
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shipping / Freight ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Expected dock or freight carrier"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 flex items-center justify-between">
            <span className="text-xs text-slate-600 font-mono-tabular">
              Subtotal: ${subtotal.toFixed(2)} · Freight: ${(Number(shippingCost) || 0).toFixed(2)}
            </span>
            <span className="text-lg font-bold font-display font-mono-tabular text-slate-900">
              Total: ${grandTotal.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Create Purchase Order'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
