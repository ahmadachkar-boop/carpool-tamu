import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Log in the user
      const userCredential = await login(email, password);
      
      // Check if user needs to complete profile
      const userDoc = await getDoc(doc(db, 'members', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Check if they have a temporary password or incomplete profile
        if (userData.tempPassword || !userData.profileCompleted) {
          navigate('/complete-profile');
        } else {
          navigate('/');
        }
      } else {
        // No profile found - shouldn't happen but redirect to complete profile
        navigate('/complete-profile');
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        setError('Invalid email or password');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed login attempts. Please try again later.');
      } else {
        setError('An error occurred during login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#79F200] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-32 h-32 bg-white rounded-3xl shadow-2xl mb-6 transform hover:scale-110 transition-transform">
            <span className="text-7xl">🚗</span>
          </div>
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">
            TAMU Carpool
          </h1>
          <p className="text-white/90 text-xl font-semibold">
            Gig 'em together! 👍
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-3xl shadow-2xl p-10">
          <h2 className="text-3xl font-black text-gray-900 mb-8 text-center">
            Welcome Back
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-red-800 font-medium">{error}</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-3">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={22} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-14 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 focus:bg-white transition-all outline-none text-lg font-medium"
                  placeholder="you@tamu.edu"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-3">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={22} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-14 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 focus:bg-white transition-all outline-none text-lg font-medium"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#79F200] text-gray-900 font-bold py-5 rounded-2xl hover:shadow-2xl hover:shadow-[#79F200]/40 transform hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 text-lg"
            >
              {loading ? (
                <>
                  <div className="w-6 h-6 border-3 border-gray-900/30 border-t-gray-900 rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={24} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t-2 border-gray-100">
            <p className="text-center text-gray-600 text-base">
              Don't have an account?{' '}
              <Link 
                to="/register" 
                className="text-[#79F200] hover:text-[#5bc000] font-bold transition-colors"
              >
                Request registration
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-white/80 text-sm font-medium">
          <p>© 2025 TAMU Carpool. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;