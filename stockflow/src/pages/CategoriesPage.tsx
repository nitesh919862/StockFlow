import React, { useCallback, useEffect, useState } from 'react';
import { FolderTree, Plus, Edit2, Trash2, Package } from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { EmptyState, ErrorBanner, TableSkeleton } from '../components/ui/StateViews';

interface CategoryRow {
  _id: string;
  name: string;
  slug: string;
  description: string;
  productCount: number;
  totalUnits: number;
  totalValue: number;
}

interface CategoryProduct {
  _id: string;
  name: string;
  sku: string;
  currentStock: number;
  sellingPrice: number;
  supplier?: { companyName: string };
}

export function CategoriesPage() {
  const { isAdmin, isManagerOrAdmin } = useAuth();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [viewCat, setViewCat] = useState<CategoryRow | null>(null);
  const [catProducts, setCatProducts] = useState<CategoryProduct[]>([]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/categories');
      setCategories(res.data.data || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load categories.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setFormOpen(true);
  };

  const openEdit = (c: CategoryRow) => {
    setEditing(c);
    setName(c.name);
    setDescription(c.description);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/categories/${editing._id}`, { name, description });
        showToast('Category updated.', 'success');
      } else {
        await api.post('/categories', { name, description });
        showToast('Category created.', 'success');
      }
      setFormOpen(false);
      fetchCategories();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to save category.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: CategoryRow) => {
    try {
      await api.delete(`/categories/${c._id}`);
      showToast(`Deleted "${c.name}".`, 'success');
      fetchCategories();
    } catch (err) {
      showToast(getErrorMessage(err, 'Cannot delete category.'), 'error');
    }
  };

  const openProducts = async (c: CategoryRow) => {
    try {
      const res = await api.get(`/categories/${c._id}/products`);
      setViewCat(c);
      setCatProducts(res.data.data.products || []);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to load category products.'), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          Organize SKUs into operational product lines. Categories containing products cannot be deleted.
        </p>
        {isManagerOrAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchCategories} />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No categories yet"
          description="Create your first category to classify products and track valuation by line."
          actionLabel={isManagerOrAdmin ? 'Add Category' : undefined}
          onAction={isManagerOrAdmin ? openCreate : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div
              key={cat._id}
              className="rounded-xl bg-white border border-slate-200 p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-900 font-display">{cat.name}</h2>
                  <div className="flex items-center gap-1 shrink-0">
                    {isManagerOrAdmin && (
                      <button
                        type="button"
                        onClick={() => openEdit(cat)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                        title="Edit category"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete category"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                  {cat.description || 'No description provided.'}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                <div className="text-slate-600 font-mono-tabular">
                  <span className="font-semibold text-slate-900">{cat.productCount}</span> SKUs ·{' '}
                  <span className="font-semibold text-slate-900">{cat.totalUnits}</span> units · $
                  {cat.totalValue.toLocaleString()}
                </div>
                <button
                  type="button"
                  onClick={() => openProducts(cat)}
                  className="font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
                >
                  View SKUs
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Category' : 'Add Category'}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Category Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
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
              {saving ? 'Saving...' : editing ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Products by Category Modal */}
      <Modal
        open={Boolean(viewCat)}
        onClose={() => setViewCat(null)}
        title={viewCat ? `${viewCat.name} Products` : 'Products'}
        subtitle={viewCat?.description}
      >
        {catProducts.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products in this category"
            description="Assign products to this category from the Products page."
          />
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {catProducts.map((p) => (
              <div key={p._id} className="px-4 py-3 flex items-center justify-between gap-4 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500 font-mono-tabular">
                    {p.sku} · {p.supplier?.companyName || '—'}
                  </p>
                </div>
                <div className="text-right font-mono-tabular">
                  <p className="font-semibold text-slate-900">{p.currentStock} units</p>
                  <p className="text-xs text-slate-500">${p.sellingPrice.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
