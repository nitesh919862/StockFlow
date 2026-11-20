import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  Upload,
  Package,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { ProductImage } from '../components/ui/ProductImage';
import { EmptyState, ErrorBanner, TableSkeleton } from '../components/ui/StateViews';

interface CategoryRef {
  _id: string;
  name: string;
}

interface SupplierRef {
  _id: string;
  companyName: string;
  name?: string;
  email?: string;
}

interface ProductItem {
  _id: string;
  name: string;
  sku: string;
  barcode: string;
  category: CategoryRef;
  supplier: SupplierRef;
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  minStockLevel: number;
  location: string;
  locationStocks: Array<{ location: string; quantity: number }>;
  description: string;
  imageUrl: string;
  createdAt: string;
}

interface ProductFormState {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  supplier: string;
  purchasePrice: string;
  sellingPrice: string;
  currentStock: string;
  minStockLevel: string;
  location: string;
  description: string;
  imageUrl: string;
}

const initialForm: ProductFormState = {
  name: '',
  sku: '',
  barcode: '',
  category: '',
  supplier: '',
  purchasePrice: '',
  sellingPrice: '',
  currentStock: '0',
  minStockLevel: '10',
  location: 'Main Warehouse',
  description: '',
  imageUrl: '',
};

export function ProductsPage() {
  const { isAdmin, isManagerOrAdmin } = useAuth();
  const { showToast } = useToast();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryRef[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Query state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [stockStatus, setStockStatus] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<{
    product: ProductItem;
    recentTransactions: Array<{
      _id: string;
      type: string;
      quantity: number;
      previousStock: number;
      newStock: number;
      reason: string;
      transactionDate: string;
      performedBy?: { name: string };
    }>;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ProductItem | null>(null);

  const fetchMeta = useCallback(async () => {
    try {
      const [catRes, supRes] = await Promise.all([
        api.get('/categories'),
        api.get('/suppliers'),
      ]);
      setCategories(catRes.data.data || []);
      setSuppliers(supRes.data.data || []);
    } catch {
      // handled on submit if missing
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/products', {
        params: {
          search,
          category: categoryFilter,
          supplier: supplierFilter,
          stockStatus,
          sortBy,
          sortOrder,
          page,
          limit: 8,
        },
      });
      setProducts(res.data.data.items || []);
      setTotalPages(res.data.data.pagination?.totalPages || 1);
      setTotalCount(res.data.data.pagination?.total || 0);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load products.'));
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, supplierFilter, stockStatus, sortBy, sortOrder, page]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchProducts();
    }, 150);
    return () => clearTimeout(t);
  }, [fetchProducts]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      ...initialForm,
      category: categories[0]?._id || '',
      supplier: suppliers[0]?._id || '',
    });
    setFormOpen(true);
  };

  const openEditModal = (p: ProductItem) => {
    setEditingId(p._id);
    setForm({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || '',
      category: p.category?._id || '',
      supplier: p.supplier?._id || '',
      purchasePrice: String(p.purchasePrice),
      sellingPrice: String(p.sellingPrice),
      currentStock: String(p.currentStock),
      minStockLevel: String(p.minStockLevel),
      location: p.location || 'Main Warehouse',
      description: p.description || '',
      imageUrl: p.imageUrl || '',
    });
    setFormOpen(true);
  };

  const openDetails = async (id: string) => {
    try {
      const res = await api.get(`/products/${id}`);
      setDetailData(res.data.data);
      setDetailOpen(true);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to load product details.'), 'error');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const body = new FormData();
      body.append('image', file);
      const res = await api.post('/products/upload', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((prev) => ({ ...prev, imageUrl: res.data.data.imageUrl }));
      showToast('Product image uploaded.', 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Image upload failed.'), 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(form.purchasePrice) < 0 || Number(form.sellingPrice) < 0) {
      showToast('Prices cannot be negative.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        purchasePrice: Number(form.purchasePrice),
        sellingPrice: Number(form.sellingPrice),
        currentStock: Number(form.currentStock),
        minStockLevel: Number(form.minStockLevel),
      };

      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
        showToast('Product updated successfully.', 'success');
      } else {
        await api.post('/products', payload);
        showToast('Product added to catalog.', 'success');
      }
      setFormOpen(false);
      fetchProducts();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to save product.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/products/${deleteTarget._id}`);
      showToast(`Deleted "${deleteTarget.name}".`, 'success');
      setDeleteTarget(null);
      fetchProducts();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete product.'), 'error');
    }
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-5">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          <span className="font-mono-tabular font-semibold text-slate-800">{totalCount}</span>{' '}
          catalog products tracked across warehouse bins.
        </p>
        {isManagerOrAdmin && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div className="rounded-xl bg-white border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search by name, SKU, or barcode..."
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setPage(1);
            setCategoryFilter(e.target.value);
          }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={supplierFilter}
          onChange={(e) => {
            setPage(1);
            setSupplierFilter(e.target.value);
          }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="all">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s._id} value={s._id}>
              {s.companyName}
            </option>
          ))}
        </select>
        <select
          value={stockStatus}
          onChange={(e) => {
            setPage(1);
            setStockStatus(e.target.value);
          }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="all">All Stock States</option>
          <option value="in">Healthy Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchProducts} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No matching products"
          description="Adjust your search filters or add a new SKU to the StockFlow product catalog."
          actionLabel={isManagerOrAdmin ? 'Add Product' : undefined}
          onAction={isManagerOrAdmin ? openCreateModal : undefined}
        />
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => toggleSort('name')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Product <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => toggleSort('sku')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      SKU / Barcode <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3.5">Category · Supplier</th>
                  <th className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('purchasePrice')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Cost / Sell <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('currentStock')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Stock <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const isOut = p.currentStock === 0;
                  const isLow = !isOut && p.currentStock <= p.minStockLevel;
                  return (
                    <tr key={p._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <ProductImage src={p.imageUrl} alt={p.name} className="h-11 w-11" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate max-w-[230px]">
                              {p.name}
                            </p>
                            <p className="text-xs text-slate-500">{p.location}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono-tabular text-xs">
                        <p className="font-semibold text-slate-800">{p.sku}</p>
                        <p className="text-slate-400">{p.barcode || 'No barcode'}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <p className="font-medium text-slate-800">{p.category?.name || '—'}</p>
                        <p className="text-slate-500">{p.supplier?.companyName || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono-tabular text-xs">
                        <p className="font-semibold text-slate-900">
                          ${p.sellingPrice.toFixed(2)}
                        </p>
                        <p className="text-slate-500">Cost ${p.purchasePrice.toFixed(2)}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p
                          className={`font-mono-tabular font-semibold text-sm ${
                            isOut
                              ? 'text-red-600'
                              : isLow
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {p.currentStock}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono-tabular">
                          {isOut ? 'Out of stock' : isLow ? `Low (min ${p.minStockLevel})` : `Min ${p.minStockLevel}`}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openDetails(p._id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {isManagerOrAdmin && (
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                              title="Edit product"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(p)}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                              title="Delete product"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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

      {/* Add/Edit Product Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Edit Product' : 'Add New Product'}
        subtitle="All prices, SKUs, and stock thresholds are validated on the server."
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Name *
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">SKU *</label>
              <input
                type="text"
                required
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                placeholder="SF-SCN-900"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Barcode</label>
              <input
                type="text"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                placeholder="8901425009999"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
              <select
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier *</label>
              <select
                required
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Purchase Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.purchasePrice}
                onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selling Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {!editingId && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Stock
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.currentStock}
                  onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Minimum Stock Alert Level *
              </label>
              <input
                type="number"
                min="0"
                required
                value={form.minStockLevel}
                onChange={(e) => setForm({ ...form, minStockLevel: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Warehouse Location
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Image
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <ProductImage src={form.imageUrl} alt="Preview" className="h-14 w-14" />
                <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer">
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingImage ? 'Uploading...' : 'Upload Image File'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="Or paste image path"
                  className="flex-1 min-w-[180px] rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
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
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Product Details Modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detailData?.product.name || 'Product Details'}
        subtitle={detailData ? `SKU ${detailData.product.sku} · ${detailData.product.category?.name || ''}` : ''}
        maxWidthClass="max-w-2xl"
      >
        {detailData && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-5">
              <ProductImage
                src={detailData.product.imageUrl}
                alt={detailData.product.name}
                className="h-36 w-full sm:w-44"
              />
              <div className="flex-1 space-y-2 text-sm">
                <p className="text-slate-600 leading-relaxed">
                  {detailData.product.description || 'No product description provided.'}
                </p>
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div>
                    <span className="text-slate-500">Purchase Cost</span>
                    <p className="font-mono-tabular font-semibold text-slate-900 text-sm">
                      ${detailData.product.purchasePrice.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Selling Price</span>
                    <p className="font-mono-tabular font-semibold text-slate-900 text-sm">
                      ${detailData.product.sellingPrice.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Total Stock</span>
                    <p className="font-mono-tabular font-semibold text-slate-900 text-sm">
                      {detailData.product.currentStock} units
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Supplier</span>
                    <p className="font-medium text-slate-900 text-sm">
                      {detailData.product.supplier?.companyName || '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {detailData.product.locationStocks?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-2">
                  Stock by Warehouse Location
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {detailData.product.locationStocks.map((loc) => (
                    <div
                      key={loc.location}
                      className="rounded-lg border border-slate-200 px-3 py-2 flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-700 font-medium">{loc.location}</span>
                      <span className="font-mono-tabular font-semibold text-slate-900">
                        {loc.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xs font-semibold text-slate-500 mb-2">
                Recent Ledger Activity
              </h3>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {detailData.recentTransactions.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-slate-500">No ledger entries yet.</p>
                ) : (
                  detailData.recentTransactions.map((tx) => (
                    <div key={tx._id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-800">{tx.type}</span>
                        <span className="text-slate-500 ml-2">{tx.reason}</span>
                      </div>
                      <div className="font-mono-tabular text-slate-700">
                        {tx.previousStock} → {tx.newStock}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Product"
        maxWidthClass="max-w-md"
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to permanently remove{' '}
          <span className="font-semibold text-slate-900">{deleteTarget?.name}</span> (
          <span className="font-mono-tabular">{deleteTarget?.sku}</span>)?
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete Product
          </button>
        </div>
      </Modal>
    </div>
  );
}
