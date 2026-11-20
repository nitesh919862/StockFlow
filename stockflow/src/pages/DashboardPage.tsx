import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Package,
  DollarSign,
  AlertTriangle,
  ShoppingCart,
  ClipboardList,
  FolderTree,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import { ErrorBanner, TableSkeleton } from '../components/ui/StateViews';

interface DashboardData {
  stats: {
    totalProducts: number;
    totalUnits: number;
    totalStockValue: number;
    totalRetailValue: number;
    lowStockCount: number;
    totalSalesCount: number;
    totalSalesRevenue: number;
    totalPurchasesCount: number;
    totalPurchasesSpend: number;
    totalCategories: number;
  };
  monthlyTrends: Array<{
    month: string;
    salesRevenue: number;
    salesOrders: number;
    purchaseSpend: number;
    purchaseOrders: number;
  }>;
  inventoryDistribution: Array<{
    name: string;
    units: number;
    stockValue: number;
    skuCount: number;
  }>;
  lowStockAlerts: Array<{
    _id: string;
    name: string;
    sku: string;
    currentStock: number;
    minStockLevel: number;
    location: string;
    categoryName: string;
  }>;
  recentTransactions: Array<{
    _id: string;
    type: string;
    quantity: number;
    previousStock: number;
    newStock: number;
    transactionDate: string;
    product?: { name: string; sku: string };
    performedBy?: { name: string };
  }>;
  activityFeed: Array<{
    id: string;
    kind: 'inventory' | 'sale' | 'purchase';
    title: string;
    description: string;
    actor: string;
    timestamp: string;
  }>;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/dashboard/summary');
      setData(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load dashboard summary.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
        <TableSkeleton rows={5} cols={5} />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorBanner message={error || 'Unable to display dashboard.'} onRetry={loadDashboard} />;
  }

  const { stats } = data;

  const statCards = [
    {
      label: 'Total Products',
      value: stats.totalProducts.toLocaleString(),
      subtext: `${stats.totalUnits.toLocaleString()} units in stock`,
      icon: Package,
      tone: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Total Stock Value',
      value: formatCurrency(stats.totalStockValue),
      subtext: `Retail value ${formatCurrency(stats.totalRetailValue)}`,
      icon: DollarSign,
      tone: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Low Stock Products',
      value: stats.lowStockCount.toLocaleString(),
      subtext: stats.lowStockCount > 0 ? 'Requires replenishment' : 'All SKUs above minimum',
      icon: AlertTriangle,
      tone: stats.lowStockCount > 0 ? 'text-amber-600 bg-amber-50' : 'text-slate-600 bg-slate-100',
    },
    {
      label: 'Total Sales',
      value: formatCurrency(stats.totalSalesRevenue),
      subtext: `${stats.totalSalesCount} sales orders`,
      icon: ShoppingCart,
      tone: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Total Purchases',
      value: formatCurrency(stats.totalPurchasesSpend),
      subtext: `${stats.totalPurchasesCount} purchase orders`,
      icon: ClipboardList,
      tone: 'text-slate-700 bg-slate-100',
    },
    {
      label: 'Total Categories',
      value: stats.totalCategories.toLocaleString(),
      subtext: 'Active catalog lines',
      icon: FolderTree,
      tone: 'text-slate-700 bg-slate-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            Live warehouse valuation, order throughput, and replenishment alerts from MongoDB.
          </p>
        </div>
        <button
          type="button"
          onClick={loadDashboard}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh Data
        </button>
      </div>

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl bg-white border border-slate-200 p-5 flex items-start justify-between gap-4 hover:border-slate-300 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 font-display tabular-nums tracking-tight">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-slate-500 tabular-nums">{card.subtext}</p>
              </div>
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${card.tone}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Monthly Sales & Purchase Analytics */}
        <div className="xl:col-span-2 rounded-xl bg-white border border-slate-200 p-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900 font-display">
                Monthly Sales &amp; Purchase Analytics
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                6-month revenue vs procurement expenditure
              </p>
            </div>
            <Link
              to="/reports"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              Full Reports
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyTrends} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                  contentStyle={{
                    borderRadius: '0.5rem',
                    borderColor: '#e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="salesRevenue"
                  name="Sales Revenue"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill="#dbeafe"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="purchaseSpend"
                  name="Purchase Spend"
                  stroke="#0f172a"
                  strokeWidth={2}
                  fill="#e2e8f0"
                  fillOpacity={0.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inventory Distribution Chart */}
        <div className="rounded-xl bg-white border border-slate-200 p-6">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-slate-900 font-display">
              Inventory Distribution
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Stock cost valuation by category</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.inventoryDistribution}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={110}
                  tick={{ fontSize: 11, fill: '#334155' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                  contentStyle={{
                    borderRadius: '0.5rem',
                    borderColor: '#e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="stockValue" name="Stock Value" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Operational Grids */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="xl:col-span-2 rounded-xl bg-white border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-semibold text-slate-900 font-display">
                Recent Inventory Transactions
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Latest stock movements across warehouses
              </p>
            </div>
            <Link
              to="/inventory"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              View Ledger
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Stock Level</th>
                  <th className="px-6 py-3">User · Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
                      No transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  data.recentTransactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-3">
                        <p className="font-medium text-slate-900 truncate max-w-[210px]">
                          {tx.product?.name || 'Product'}
                        </p>
                        <p className="text-xs text-slate-500 font-mono-tabular">
                          {tx.product?.sku || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">{tx.type}</td>
                      <td className="px-4 py-3 text-right font-mono-tabular text-slate-900">
                        {tx.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-tabular text-slate-600">
                        {tx.previousStock} → {tx.newStock}
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-500">
                        <span>{tx.performedBy?.name || 'System'}</span>
                        <span className="mx-1.5">·</span>
                        <span className="font-mono-tabular">
                          {new Date(tx.transactionDate).toLocaleDateString()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low-Stock Alerts & Activity Feed */}
        <div className="space-y-6">
          <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900 font-display">
                Low-Stock Alerts
              </h2>
              <Link
                to="/purchases"
                className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
              >
                Create PO
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {data.lowStockAlerts.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500 text-center">
                  All products are stocked above minimum levels.
                </p>
              ) : (
                data.lowStockAlerts.slice(0, 5).map((item) => (
                  <div key={item._id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 font-mono-tabular">
                        {item.sku} · {item.location}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-semibold font-mono-tabular ${
                          item.currentStock === 0 ? 'text-red-600' : 'text-amber-600'
                        }`}
                      >
                        {item.currentStock} / {item.minStockLevel}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {item.currentStock === 0 ? 'Out of Stock' : 'Low Stock'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900 font-display">
                Recent Activity Feed
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {data.activityFeed.slice(0, 5).map((act) => (
                <div key={act.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">{act.title}</span>
                    <span className="text-[11px] text-slate-400 font-mono-tabular">
                      {new Date(act.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{act.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
