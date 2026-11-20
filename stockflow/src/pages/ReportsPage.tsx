import { useCallback, useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Download } from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { ErrorBanner, TableSkeleton } from '../components/ui/StateViews';

type ReportTab =
  | 'daily-sales'
  | 'monthly-sales'
  | 'product-performance'
  | 'inventory-valuation'
  | 'low-stock'
  | 'purchases';

interface ReportsOverview {
  dailySales: Array<{ date: string; orders: number; subtotal: number; discount: number; revenue: number }>;
  monthlySales: Array<{ month: string; orders: number; subtotal: number; discount: number; revenue: number }>;
  productPerformance: Array<{
    sku: string;
    productName: string;
    unitsSold: number;
    revenue: number;
    costOfGoods: number;
    grossProfit: number;
  }>;
  inventoryValuation: Array<{
    sku: string;
    name: string;
    category: string;
    location: string;
    currentStock: number;
    purchasePrice: number;
    sellingPrice: number;
    costValue: number;
    retailValue: number;
    potentialMargin: number;
  }>;
  lowStock: Array<{
    sku: string;
    name: string;
    category: string;
    supplier: string;
    currentStock: number;
    minStockLevel: number;
    reorderSuggested: number;
    estimatedReorderCost: number;
    status: string;
  }>;
  purchases: Array<{
    poNumber: string;
    supplier: string;
    status: string;
    subtotal: number;
    shippingCost: number;
    totalAmount: number;
    purchaseDate: string;
    receivedDate: string;
  }>;
}

const TABS: Array<{ id: ReportTab; label: string }> = [
  { id: 'daily-sales', label: 'Daily Sales' },
  { id: 'monthly-sales', label: 'Monthly Sales' },
  { id: 'product-performance', label: 'Product Performance' },
  { id: 'inventory-valuation', label: 'Inventory Valuation' },
  { id: 'low-stock', label: 'Low Stock' },
  { id: 'purchases', label: 'Purchases' },
];

export function ReportsPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportTab>('monthly-sales');
  const [data, setData] = useState<ReportsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/reports/overview');
      setData(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate reports.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/reports/export/${activeTab}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `stockflow-${activeTab}-report.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast(`Exported ${activeTab} CSV report.`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'CSV export failed.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <TableSkeleton rows={7} cols={5} />;
  if (error || !data) return <ErrorBanner message={error || 'Unable to load reports.'} onRetry={loadReports} />;

  return (
    <div className="space-y-5">
      {/* Tabs & Export CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Contextual Chart for Sales & Product Performance */}
      {activeTab === 'monthly-sales' && data.monthlySales.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-900 font-display mb-4">
            Monthly Revenue Trajectory
          </h2>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => `$${Number(v ?? 0).toFixed(2)}`} />
                <Bar dataKey="revenue" name="Revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'product-performance' && data.productPerformance.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-900 font-display mb-4">
            Revenue vs Gross Profit by SKU
          </h2>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.productPerformance.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="sku" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => `$${Number(v ?? 0).toFixed(2)}`} />
                <Bar dataKey="revenue" name="Revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="grossProfit" name="Gross Profit" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Report Data Table */}
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'daily-sales' && (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-4 py-3.5 text-right">Orders</th>
                  <th className="px-4 py-3.5 text-right">Subtotal</th>
                  <th className="px-4 py-3.5 text-right">Discounts</th>
                  <th className="px-5 py-3.5 text-right">Net Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono-tabular text-xs">
                {data.dailySales.map((r) => (
                  <tr key={r.date} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-medium text-slate-900">{r.date}</td>
                    <td className="px-4 py-3 text-right">{r.orders}</td>
                    <td className="px-4 py-3 text-right">${r.subtotal.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">-${r.discount.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900">
                      ${r.revenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'monthly-sales' && (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">Month</th>
                  <th className="px-4 py-3.5 text-right">Orders</th>
                  <th className="px-4 py-3.5 text-right">Subtotal</th>
                  <th className="px-4 py-3.5 text-right">Discounts</th>
                  <th className="px-5 py-3.5 text-right">Net Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono-tabular text-xs">
                {data.monthlySales.map((r) => (
                  <tr key={r.month} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-medium text-slate-900">{r.month}</td>
                    <td className="px-4 py-3 text-right">{r.orders}</td>
                    <td className="px-4 py-3 text-right">${r.subtotal.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">-${r.discount.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900">
                      ${r.revenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'product-performance' && (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">SKU · Product</th>
                  <th className="px-4 py-3.5 text-right">Units Sold</th>
                  <th className="px-4 py-3.5 text-right">Revenue</th>
                  <th className="px-4 py-3.5 text-right">COGS</th>
                  <th className="px-5 py-3.5 text-right">Gross Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.productPerformance.map((r) => (
                  <tr key={r.sku} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{r.productName}</p>
                      <p className="font-mono-tabular text-slate-500">{r.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular">{r.unitsSold}</td>
                    <td className="px-4 py-3 text-right font-mono-tabular">
                      ${r.revenue.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular text-slate-500">
                      ${r.costOfGoods.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono-tabular font-semibold text-emerald-600">
                      ${r.grossProfit.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'inventory-valuation' && (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">SKU · Product</th>
                  <th className="px-4 py-3.5">Category · Location</th>
                  <th className="px-4 py-3.5 text-right">Stock</th>
                  <th className="px-4 py-3.5 text-right">Cost Value</th>
                  <th className="px-4 py-3.5 text-right">Retail Value</th>
                  <th className="px-5 py-3.5 text-right">Potential Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.inventoryValuation.map((r) => (
                  <tr key={r.sku} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{r.name}</p>
                      <p className="font-mono-tabular text-slate-500">{r.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.category} · {r.location}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular">{r.currentStock}</td>
                    <td className="px-4 py-3 text-right font-mono-tabular">
                      ${r.costValue.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular">
                      ${r.retailValue.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono-tabular font-semibold text-emerald-600">
                      ${r.potentialMargin.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'low-stock' && (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">SKU · Product</th>
                  <th className="px-4 py-3.5">Supplier</th>
                  <th className="px-4 py-3.5 text-right">Stock / Min</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Suggested Reorder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.lowStock.map((r) => (
                  <tr key={r.sku} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{r.name}</p>
                      <p className="font-mono-tabular text-slate-500">{r.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.supplier}</td>
                    <td className="px-4 py-3 text-right font-mono-tabular font-semibold">
                      {r.currentStock} / {r.minStockLevel}
                    </td>
                    <td
                      className={`px-4 py-3 font-semibold ${
                        r.currentStock === 0 ? 'text-red-600' : 'text-amber-600'
                      }`}
                    >
                      {r.status}
                    </td>
                    <td className="px-5 py-3 text-right font-mono-tabular">
                      {r.reorderSuggested} units (${r.estimatedReorderCost.toFixed(2)})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'purchases' && (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">PO Number</th>
                  <th className="px-4 py-3.5">Supplier</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Purchase Date</th>
                  <th className="px-5 py-3.5 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.purchases.map((r) => (
                  <tr key={r.poNumber} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono-tabular font-semibold text-slate-900">
                      {r.poNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.supplier}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{r.status}</td>
                    <td className="px-4 py-3 font-mono-tabular text-slate-600">{r.purchaseDate}</td>
                    <td className="px-5 py-3 text-right font-mono-tabular font-semibold text-slate-900">
                      ${r.totalAmount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
