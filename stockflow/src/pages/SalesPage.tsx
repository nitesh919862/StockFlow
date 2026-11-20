import React, { useCallback, useEffect, useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Printer,
  Trash2,
  FileText,
} from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { EmptyState, ErrorBanner, TableSkeleton } from '../components/ui/StateViews';

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  currentStock: number;
}

interface SaleLineItem {
  _id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface SaleOrder {
  _id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subtotal: number;
  discountType: 'fixed' | 'percent';
  discountValue: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentStatus: 'Paid' | 'Pending' | 'Partial';
  paymentMethod: string;
  notes: string;
  saleDate: string;
  items: SaleLineItem[];
  createdBy?: { name: string };
}

export function SalesPage() {
  const { isManagerOrAdmin } = useAuth();
  const { showToast } = useToast();

  const [sales, setSales] = useState<SaleOrder[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // New Sale Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Pending' | 'Partial'>('Paid');
  const [paymentMethod, setPaymentMethod] = useState('Invoice');
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [discountValue, setDiscountValue] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<Array<{ productId: string; quantity: number }>>([]);
  const [submitting, setSubmitting] = useState(false);

  // Invoice Modal
  const [invoiceSale, setInvoiceSale] = useState<SaleOrder | null>(null);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/sales', {
        params: { search, paymentStatus: statusFilter, limit: 30 },
      });
      setSales(res.data.data.items || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load sales orders.'));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get('/products', { params: { limit: 100 } });
      setProducts(res.data.data.items || []);
    } catch {
      // handled on open
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const t = setTimeout(fetchSales, 150);
    return () => clearTimeout(t);
  }, [fetchSales]);

  const openCreateModal = () => {
    const available = products.filter((p) => p.currentStock > 0);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setDiscountType('fixed');
    setDiscountValue('0');
    setTaxRate('0');
    setNotes('');
    setPaymentStatus('Paid');
    setPaymentMethod('Invoice');
    setLineItems(available.length > 0 ? [{ productId: available[0]._id, quantity: 1 }] : []);
    setCreateOpen(true);
  };

  const addLine = () => {
    const available = products.filter((p) => p.currentStock > 0);
    if (available.length === 0) return;
    setLineItems((prev) => [...prev, { productId: available[0]._id, quantity: 1 }]);
  };

  const removeLine = (idx: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const subtotal = lineItems.reduce((sum, item) => {
    const prod = products.find((p) => p._id === item.productId);
    return sum + (prod ? prod.sellingPrice * item.quantity : 0);
  }, 0);
  const dVal = Math.max(0, Number(discountValue) || 0);
  const discountAmount =
    discountType === 'percent' ? Math.min(subtotal, (subtotal * Math.min(100, dVal)) / 100) : Math.min(subtotal, dVal);
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxable * Math.max(0, Number(taxRate) || 0)) / 100;
  const grandTotal = taxable + taxAmount;

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineItems.length === 0) {
      showToast('Add at least one in-stock product.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/sales', {
        customerName,
        customerEmail,
        customerPhone,
        items: lineItems,
        discountType,
        discountValue: Number(discountValue) || 0,
        taxRate: Number(taxRate) || 0,
        paymentStatus,
        paymentMethod,
        notes,
      });
      showToast(`Sales order ${res.data.data.invoiceNumber} created.`, 'success');
      setCreateOpen(false);
      await Promise.all([fetchSales(), fetchProducts()]);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to create sales order.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentUpdate = async (saleId: string, nextStatus: 'Paid' | 'Pending' | 'Partial') => {
    try {
      await api.patch(`/sales/${saleId}/payment`, { paymentStatus: nextStatus });
      showToast('Payment status updated.', 'success');
      fetchSales();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to update payment status.'), 'error');
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
              placeholder="Search invoice # or customer..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Payment Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Partial">Partial</option>
          </select>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          New Sales Order
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchSales} />
      ) : sales.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No sales orders found"
          description="Create a sales order to automatically deduct inventory and generate a printable invoice."
          actionLabel="New Sales Order"
          onAction={openCreateModal}
        />
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">Invoice # · Date</th>
                  <th className="px-4 py-3.5">Customer</th>
                  <th className="px-4 py-3.5 text-right">Items</th>
                  <th className="px-4 py-3.5 text-right">Total</th>
                  <th className="px-4 py-3.5">Payment</th>
                  <th className="px-5 py-3.5 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-mono-tabular font-semibold text-slate-900">
                        {s.invoiceNumber}
                      </p>
                      <p className="text-xs text-slate-500 font-mono-tabular">
                        {new Date(s.saleDate).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-900">{s.customerName}</p>
                      <p className="text-xs text-slate-500">{s.customerEmail || s.paymentMethod}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-tabular text-slate-700">
                      {s.items?.reduce((a, b) => a + b.quantity, 0) || 0} units
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-tabular font-semibold text-slate-900">
                      ${s.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5">
                      {isManagerOrAdmin ? (
                        <select
                          value={s.paymentStatus}
                          onChange={(e) =>
                            handlePaymentUpdate(
                              s._id,
                              e.target.value as 'Paid' | 'Pending' | 'Partial'
                            )
                          }
                          className={`rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold bg-white ${
                            s.paymentStatus === 'Paid'
                              ? 'text-emerald-700'
                              : s.paymentStatus === 'Pending'
                              ? 'text-amber-700'
                              : 'text-blue-700'
                          }`}
                        >
                          <option value="Paid">Paid</option>
                          <option value="Pending">Pending</option>
                          <option value="Partial">Partial</option>
                        </select>
                      ) : (
                        <span
                          className={`text-xs font-semibold ${
                            s.paymentStatus === 'Paid' ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        >
                          {s.paymentStatus}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setInvoiceSale(s)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        View Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Sales Order Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Sales Order"
        subtitle="Stock is atomically checked and deducted when the order is confirmed."
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleCreateSale} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Acme Logistics LLC"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Email
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="orders@acme.com"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Phone
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+1 (555) 010-2000"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">Order Line Items *</label>
              <button
                type="button"
                onClick={addLine}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                + Add Product Line
              </button>
            </div>
            <div className="space-y-2">
              {lineItems.map((line, idx) => {
                const prod = products.find((p) => p._id === line.productId);
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center rounded-lg border border-slate-200 p-2.5"
                  >
                    <div className="col-span-12 sm:col-span-6">
                      <select
                        value={line.productId}
                        onChange={(e) => {
                          const next = [...lineItems];
                          next[idx].productId = e.target.value;
                          setLineItems(next);
                        }}
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs bg-white"
                      >
                        {products.map((p) => (
                          <option key={p._id} value={p._id} disabled={p.currentStock === 0}>
                            {p.sku} · {p.name} (${p.sellingPrice} | Avail: {p.currentStock})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-5 sm:col-span-2">
                      <input
                        type="number"
                        min="1"
                        max={prod?.currentStock || 9999}
                        value={line.quantity}
                        onChange={(e) => {
                          const next = [...lineItems];
                          next[idx].quantity = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setLineItems(next);
                        }}
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono-tabular"
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-3 text-right text-xs font-mono-tabular font-semibold text-slate-900">
                      ${((prod?.sellingPrice || 0) * line.quantity).toFixed(2)}
                    </div>
                    <div className="col-span-2 sm:col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="p-1 text-slate-400 hover:text-red-600"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Discount, Tax, Payment */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Discount Type
              </label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'fixed' | 'percent')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white"
              >
                <option value="fixed">Fixed ($)</option>
                <option value="percent">Percent (%)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Discount Value
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tax (%)</label>
              <input
                type="number"
                min="0"
                max="50"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as 'Paid' | 'Pending' | 'Partial')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white"
              >
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
              </select>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4 text-sm">
            <div className="space-y-1 text-xs text-slate-600 font-mono-tabular">
              <p>Subtotal: ${subtotal.toFixed(2)}</p>
              <p>Discount: -${discountAmount.toFixed(2)} · Tax: +${taxAmount.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500">Order Total</span>
              <p className="text-xl font-bold font-display font-mono-tabular text-slate-900">
                ${grandTotal.toFixed(2)}
              </p>
            </div>
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
              {submitting ? 'Creating Order...' : 'Confirm & Deduct Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Invoice Modal */}
      <Modal
        open={Boolean(invoiceSale)}
        onClose={() => setInvoiceSale(null)}
        title={`Invoice ${invoiceSale?.invoiceNumber || ''}`}
        maxWidthClass="max-w-2xl"
      >
        {invoiceSale && (
          <div className="space-y-6">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 font-display">StockFlow</h3>
                <p className="text-xs text-slate-500">Official Sales Invoice</p>
              </div>
              <div className="text-right text-xs font-mono-tabular">
                <p className="font-bold text-slate-900 text-sm">{invoiceSale.invoiceNumber}</p>
                <p className="text-slate-500">
                  Date: {new Date(invoiceSale.saleDate).toLocaleDateString()}
                </p>
                <p className="text-slate-700 font-semibold mt-1">
                  Status: {invoiceSale.paymentStatus}
                </p>
              </div>
            </div>

            <div className="text-sm">
              <p className="text-xs font-semibold text-slate-500">Billed To</p>
              <p className="font-semibold text-slate-900 mt-0.5">{invoiceSale.customerName}</p>
              {invoiceSale.customerEmail && (
                <p className="text-xs text-slate-600">{invoiceSale.customerEmail}</p>
              )}
              {invoiceSale.customerPhone && (
                <p className="text-xs text-slate-600">{invoiceSale.customerPhone}</p>
              )}
            </div>

            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 text-right">Unit Price</th>
                  <th className="px-4 py-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoiceSale.items.map((item) => (
                  <tr key={item._id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{item.productName}</p>
                      <p className="text-slate-400 font-mono-tabular">{item.sku}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-tabular">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right font-mono-tabular">
                      ${item.unitPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-tabular font-semibold text-slate-900">
                      ${item.lineTotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-xs font-mono-tabular">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>${invoiceSale.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Discount</span>
                  <span>-${invoiceSale.discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax</span>
                  <span>+${invoiceSale.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total</span>
                  <span>${invoiceSale.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="no-print flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Printer className="h-4 w-4" />
                Print Invoice
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
