import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { EmptyState, ErrorBanner, TableSkeleton } from '../components/ui/StateViews';

type OperationType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
  currentStock: number;
  location: string;
  locationStocks: Array<{ location: string; quantity: number }>;
}

interface TransactionRow {
  _id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER' | 'SALE' | 'PURCHASE';
  quantity: number;
  previousStock: number;
  newStock: number;
  fromLocation: string;
  toLocation: string;
  referenceCode: string;
  reason: string;
  transactionDate: string;
  product?: { _id: string; name: string; sku: string };
  performedBy?: { name: string; role: string };
}

const DEFAULT_LOCATIONS = ['Main Warehouse', 'East Hub', 'West Dock', 'Retail Floor'];

export function InventoryPage() {
  const { showToast } = useToast();

  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [typeFilter, setTypeFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Operation modal state
  const [opModalOpen, setOpModalOpen] = useState(false);
  const [opType, setOpType] = useState<OperationType>('IN');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [fromLocation, setFromLocation] = useState('Main Warehouse');
  const [toLocation, setToLocation] = useState('East Hub');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get('/products', { params: { limit: 100 } });
      const list = res.data.data.items || [];
      setProducts(list);
      if (list.length > 0 && !productId) {
        setProductId(list[0]._id);
      }
    } catch {
      // handled in UI
    }
  }, [productId]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/inventory/transactions', {
        params: {
          type: typeFilter,
          productId: productFilter,
          page,
          limit: 15,
        },
      });
      setTransactions(res.data.data.items || []);
      setTotalPages(res.data.data.pagination?.totalPages || 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load inventory ledger.'));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, productFilter, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const openOperation = (type: OperationType) => {
    setOpType(type);
    const selected = products.find((p) => p._id === productId) || products[0];
    if (selected) {
      setProductId(selected._id);
      setFromLocation(selected.locationStocks?.[0]?.location || selected.location || 'Main Warehouse');
      setToLocation(
        type === 'TRANSFER' ? 'East Hub' : selected.location || 'Main Warehouse'
      );
      setQuantity(type === 'ADJUSTMENT' ? String(selected.currentStock) : '1');
    }
    setReason('');
    setOpModalOpen(true);
  };

  const selectedProduct = products.find((p) => p._id === productId);

  const handleSubmitOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Number(quantity);
    if (Number.isNaN(qtyNum) || qtyNum < 0) {
      showToast('Quantity cannot be negative.', 'error');
      return;
    }
    if (opType === 'OUT' && selectedProduct && qtyNum > selectedProduct.currentStock) {
      showToast(
        `Cannot remove ${qtyNum} units. Only ${selectedProduct.currentStock} available.`,
        'error'
      );
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/inventory/operations', {
        productId,
        type: opType,
        quantity: qtyNum,
        fromLocation,
        toLocation,
        reason,
      });
      showToast(`Inventory ${opType.toLowerCase()} recorded.`, 'success');
      setOpModalOpen(false);
      await Promise.all([fetchProducts(), fetchTransactions()]);
    } catch (err) {
      showToast(getErrorMessage(err, 'Inventory operation failed.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const opButtons: Array<{ type: OperationType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { type: 'IN', label: 'Stock In', icon: ArrowDownLeft },
    { type: 'OUT', label: 'Stock Out', icon: ArrowUpRight },
    { type: 'ADJUSTMENT', label: 'Adjust Stock', icon: SlidersHorizontal },
    { type: 'TRANSFER', label: 'Transfer Location', icon: ArrowLeftRight },
  ];

  return (
    <div className="space-y-5">
      {/* Operation Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          Every stock change creates an immutable audit transaction with user attribution.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {opButtons.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.type}
                type="button"
                onClick={() => openOperation(btn.type)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  btn.type === 'IN'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl bg-white border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <select
          value={typeFilter}
          onChange={(e) => {
            setPage(1);
            setTypeFilter(e.target.value);
          }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="all">All Transaction Types</option>
          <option value="IN">Stock In (IN)</option>
          <option value="OUT">Stock Out (OUT)</option>
          <option value="ADJUSTMENT">Adjustments</option>
          <option value="TRANSFER">Transfers</option>
          <option value="SALE">Sales Deductions</option>
          <option value="PURCHASE">Purchase Receipts</option>
        </select>

        <select
          value={productFilter}
          onChange={(e) => {
            setPage(1);
            setProductFilter(e.target.value);
          }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="all">All Products</option>
          {products.map((p) => (
            <option key={p._id} value={p._id}>
              {p.sku} · {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Ledger Table */}
      {loading ? (
        <TableSkeleton rows={7} cols={6} />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchTransactions} />
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No inventory transactions found"
          description="Log a stock in, stock out, adjustment, or transfer to begin tracking movements."
          actionLabel="Record Stock In"
          onAction={() => openOperation('IN')}
        />
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Product</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5 text-right">Qty</th>
                  <th className="px-4 py-3.5 text-right">Stock Change</th>
                  <th className="px-4 py-3.5">Location / Ref</th>
                  <th className="px-5 py-3.5">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3 text-xs text-slate-600 font-mono-tabular whitespace-nowrap">
                      {new Date(tx.transactionDate).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 truncate max-w-[220px]">
                        {tx.product?.name || 'Product'}
                      </p>
                      <p className="text-xs text-slate-500 font-mono-tabular">
                        {tx.product?.sku || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-800">{tx.type}</td>
                    <td className="px-4 py-3 text-right font-mono-tabular font-semibold text-slate-900">
                      {tx.quantity}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular text-xs text-slate-600">
                      {tx.previousStock} → <span className="font-semibold text-slate-900">{tx.newStock}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <p>
                        {tx.type === 'TRANSFER'
                          ? `${tx.fromLocation} → ${tx.toLocation}`
                          : tx.toLocation || tx.fromLocation || 'Main Warehouse'}
                      </p>
                      <p className="text-slate-400 truncate max-w-[200px]">
                        {tx.referenceCode ? `${tx.referenceCode} · ` : ''}
                        {tx.reason}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-700">
                      {tx.performedBy?.name || 'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-600">
            <span className="font-mono-tabular">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Operation Modal */}
      <Modal
        open={opModalOpen}
        onClose={() => setOpModalOpen(false)}
        title={
          opType === 'IN'
            ? 'Stock In (Receive Units)'
            : opType === 'OUT'
            ? 'Stock Out (Dispatch / Shrinkage)'
            : opType === 'ADJUSTMENT'
            ? 'Cycle Count Stock Adjustment'
            : 'Transfer Between Locations'
        }
        subtitle="Negative inventory is strictly blocked on both client and server."
      >
        <form onSubmit={handleSubmitOperation} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product *</label>
            <select
              required
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                const found = products.find((p) => p._id === e.target.value);
                if (found && opType === 'ADJUSTMENT') {
                  setQuantity(String(found.currentStock));
                }
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.sku} · {p.name} (Available: {p.currentStock})
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
              <span>
                Current Total Stock:{' '}
                <strong className="font-mono-tabular text-slate-900">
                  {selectedProduct.currentStock}
                </strong>
              </span>
              <span className="font-mono-tabular">
                {selectedProduct.locationStocks
                  ?.map((l) => `${l.location}: ${l.quantity}`)
                  .join(' · ')}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {opType === 'ADJUSTMENT' ? 'New Total Counted Stock *' : 'Quantity *'}
            </label>
            <input
              type="number"
              min={opType === 'ADJUSTMENT' ? '0' : '1'}
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {(opType === 'OUT' || opType === 'TRANSFER') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                From Location *
              </label>
              <select
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {Array.from(
                  new Set([
                    ...DEFAULT_LOCATIONS,
                    ...(selectedProduct?.locationStocks?.map((l) => l.location) || []),
                  ])
                ).map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(opType === 'IN' || opType === 'ADJUSTMENT' || opType === 'TRANSFER') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {opType === 'TRANSFER' ? 'Destination Location *' : 'Warehouse Location'}
              </label>
              <select
                value={toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {DEFAULT_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason / Notes
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Cycle count reconciliation, damaged carton, hub rebalance"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setOpModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? 'Processing...' : 'Confirm Operation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
