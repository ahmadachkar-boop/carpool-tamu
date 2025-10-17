import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Car } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      if (error.code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (error.code === 'auth/user-not-found') {
        setError('No account found with this email');
      } else if (error.code === 'auth/wrong-password') {
        setError('Incorrect password');
      } else {
        setError('Failed to login: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-400 via-lime-500 to-lime-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-lime-400 to-lime-600 rounded-2xl shadow-lg mb-4">
            <Car className="text-white" size={32} strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-lime-500 to-lime-600 bg-clip-text text-transparent mb-2">
            CARPOOL
          </h1>
          <p className="text-gray-600 font-medium">Texas A&M</p>
        </div>

        <h2 className="text-2xl font-bold text-gray-800 mb-6">Sign In</h2>

        {error && (
          <div className="bg-red-50 border-2 border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-start gap-2">
            <span className="text-red-500 font-bold">⚠</span>
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 transition-all"
              placeholder="your.email@tamu.edu"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 transition-all"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-lime-500 to-lime-600 text-white rounded-lg hover:from-lime-600 hover:to-lime-700 transition-all font-bold text-lg shadow-lg shadow-lime-500/30 disabled:bg-gray-400 disabled:shadow-none disabled:cursor-not-allowed mt-6"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 space-y-2">
          <p className="text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-lime-600 hover:text-lime-700 font-bold">
              Register here
            </Link>
          </p>
          <p className="text-center text-sm text-gray-500">
            Or contact your director for assistance
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;