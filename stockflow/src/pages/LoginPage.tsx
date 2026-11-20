import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, ArrowRight, KeyRound, Mail, User, Building2, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, getErrorMessage } from '../services/api';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export function LoginPage() {
  const { login, register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('admin@stockflow.io');
  const [password, setPassword] = useState('Admin123!');
  const [department, setDepartment] = useState('Warehouse Operations');
  const [resetToken, setResetToken] = useState('');
  const [generatedTokenHint, setGeneratedTokenHint] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email, password);
        showToast('Signed in to StockFlow.', 'success');
        navigate('/');
      } else if (mode === 'register') {
        await register({ name, email, password, department });
        showToast('Account created and signed in.', 'success');
        navigate('/');
      } else if (mode === 'forgot') {
        const res = await api.post('/auth/forgot-password', { email });
        const tokenFromDev = res.data.resetToken || '';
        setGeneratedTokenHint(tokenFromDev);
        if (tokenFromDev) {
          setResetToken(tokenFromDev);
        }
        showToast(res.data.message || 'Reset token generated.', 'info');
        setMode('reset');
      } else if (mode === 'reset') {
        const res = await api.post('/auth/reset-password', {
          token: resetToken,
          newPassword,
        });
        showToast(res.data.message || 'Password updated.', 'success');
        setPassword(newPassword);
        setMode('login');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const quickFillRole = (roleEmail: string, rolePass: string) => {
    setMode('login');
    setError('');
    setEmail(roleEmail);
    setPassword(rolePass);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Brand Panel */}
      <div className="lg:w-5/12 bg-slate-900 text-white p-8 sm:p-12 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <Boxes className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight font-display">StockFlow</span>
          </div>

          <h2 className="mt-12 text-3xl sm:text-4xl font-bold tracking-tight font-display text-white leading-tight [text-wrap:balance]">
            Real-time inventory control for modern warehouses.
          </h2>
          <p className="mt-4 text-slate-300 text-sm sm:text-base leading-relaxed max-w-md">
            Track SKU stock levels across locations, manage supplier purchase orders, generate
            invoices, and export valuation reports from a single unified system.
          </p>
        </div>

        <div className="mt-10 pt-8 border-t border-slate-800 space-y-3">
          <p className="text-xs font-semibold text-slate-400 tracking-wide">
            Development Demo Accounts
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => quickFillRole('admin@stockflow.io', 'Admin123!')}
              className="flex items-center justify-between rounded-lg bg-slate-800/80 hover:bg-slate-800 px-3.5 py-2.5 text-left text-xs transition-colors"
            >
              <div>
                <p className="font-semibold text-white">Admin · Full Access</p>
                <p className="text-slate-400 font-mono-tabular">admin@stockflow.io</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>
            <button
              type="button"
              onClick={() => quickFillRole('manager@stockflow.io', 'Manager123!')}
              className="flex items-center justify-between rounded-lg bg-slate-800/80 hover:bg-slate-800 px-3.5 py-2.5 text-left text-xs transition-colors"
            >
              <div>
                <p className="font-semibold text-white">Manager · Operations</p>
                <p className="text-slate-400 font-mono-tabular">manager@stockflow.io</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>
            <button
              type="button"
              onClick={() => quickFillRole('staff@stockflow.io', 'Staff123!')}
              className="flex items-center justify-between rounded-lg bg-slate-800/80 hover:bg-slate-800 px-3.5 py-2.5 text-left text-xs transition-colors"
            >
              <div>
                <p className="font-semibold text-white">Staff · Fulfillment</p>
                <p className="text-slate-400 font-mono-tabular">staff@stockflow.io</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 font-display">
              {mode === 'login' && 'Sign in to StockFlow'}
              {mode === 'register' && 'Create a Staff Account'}
              {mode === 'forgot' && 'Reset your password'}
              {mode === 'reset' && 'Set a new password'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {mode === 'login' && 'Enter your credentials to access your workspace.'}
              {mode === 'register' && 'New self-registered accounts start with Staff access.'}
              {mode === 'forgot' && 'Enter your email to generate a secure 15-minute reset token.'}
              {mode === 'reset' && 'Paste your reset token and choose a new password.'}
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {generatedTokenHint && mode === 'reset' && (
            <div className="mb-5 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800">
              <p className="font-semibold">Development Reset Token Issued:</p>
              <p className="font-mono-tabular break-all mt-1">{generatedTokenHint}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jordan Taylor"
                      className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Department
                  </label>
                  <div className="relative">
                    <Building2 className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Warehouse Operations"
                      className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>
                </div>
              </>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />
                </div>
              </div>
            )}

            {(mode === 'login' || mode === 'register') && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setMode('forgot');
                      }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />
                </div>
              </div>
            )}

            {mode === 'reset' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Reset Token
                  </label>
                  <div className="relative">
                    <KeyRound className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Paste reset token"
                      className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {submitting
                ? 'Please wait...'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                ? 'Create Account'
                : mode === 'forgot'
                ? 'Generate Reset Token'
                : 'Reset Password'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200 text-center text-sm text-slate-600">
            {mode === 'login' ? (
              <>
                Need an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setMode('register');
                  }}
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  Register as Staff
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode('login');
                }}
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                Back to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
