import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { toast } from '../components/Toast';
import { getErrorMessage } from '../lib/api';

export default function Login() {
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter email and password');
      return;
    }
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-modal p-8 border">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gold flex items-center justify-center mb-4">
              <Sparkles size={30} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-charcoal">Jewellery Management</h1>
            <p className="text-sm text-gray-400 mt-1">Private Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  className="input-field !pl-10"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field !pl-10 !pr-10"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full !h-11" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t text-center">
            <div className="text-xs text-gray-400 mb-2">Demo credentials</div>
            <div className="text-xs text-gray-500 space-y-1">
              <div>Owner: <code className="bg-gray-100 px-1.5 py-0.5 rounded">admin@jewellery.com / admin123</code></div>
              <div>Manager: <code className="bg-gray-100 px-1.5 py-0.5 rounded">manager@jewellery.com / manager123</code></div>
              <div>Staff: <code className="bg-gray-100 px-1.5 py-0.5 rounded">staff@jewellery.com / staff123</code></div>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">© {new Date().getFullYear()} Royal Jewellers · Private Application</p>
      </div>
    </div>
  );
}