import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { User, Mail, AlertCircle, Clock, CheckCircle } from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    gender: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const checkEmailExists = async (email) => {
    try {
      const approvalsRef = collection(db, 'emailApprovals');
      const q = query(approvalsRef, where('email', '==', email.toLowerCase()));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return { exists: false };
      }
      
      const approval = snapshot.docs[0].data();
      return { 
        exists: true,
        status: approval.status 
      };
    } catch (error) {
      console.error('Error checking email:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validation
    if (!formData.name || !formData.email || !formData.gender) {
      setError('Please fill in all required fields');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      // Check if email already exists
      const emailCheck = await checkEmailExists(formData.email);
      
      if (emailCheck.exists) {
        if (emailCheck.status === 'pending') {
          setError('Your registration request is already pending approval. Please wait for administrator review.');
        } else if (emailCheck.status === 'approved') {
          setError('This email has already been approved. Please check your email for your temporary password.');
        } else if (emailCheck.status === 'rejected') {
          setError('Your registration request was rejected. Please contact an administrator for more information.');
        }
        setLoading(false);
        return;
      }

      // Create new pending approval request
      await addDoc(collection(db, 'emailApprovals'), {
        email: formData.email.toLowerCase(),
        name: formData.name,
        gender: formData.gender,
        status: 'pending',
        createdAt: Timestamp.now(),
        requestedAt: Timestamp.now(),
        approved: false
      });

      setSuccess(true);
      setFormData({ name: '', email: '', gender: '' });
      
    } catch (error) {
      console.error('Error submitting request:', error);
      setError('An error occurred while submitting your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#79F200] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="bg-white rounded-3xl shadow-2xl p-10">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                <CheckCircle className="text-green-600" size={40} />
              </div>
              
              <h2 className="text-3xl font-black text-gray-900 mb-4">
                Request Submitted!
              </h2>
              
              <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 mb-6">
                <p className="text-gray-700 leading-relaxed">
                  Your registration request has been submitted successfully. 
                  You'll receive a confirmation email shortly at <strong>{formData.email || 'your email'}</strong>.
                </p>
                <p className="text-gray-700 mt-4 leading-relaxed">
                  Once an administrator approves your request, you'll receive another email 
                  with a temporary password to access your account.
                </p>
              </div>

              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Clock className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
                  <p className="text-sm text-gray-700 text-left">
                    <strong>What's next?</strong> Your request will be reviewed by an administrator. 
                    This typically takes 24-48 hours. Please check your email regularly.
                  </p>
                </div>
              </div>

              <Link
                to="/login"
                className="inline-block w-full py-4 bg-[#79F200] text-gray-900 rounded-xl font-black text-lg hover:opacity-90 transition-opacity"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#79F200] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-32 h-32 bg-white rounded-3xl shadow-2xl mb-6">
            <span className="text-6xl">🚗</span>
          </div>
          <h1 className="text-5xl font-black text-white mb-3">
            TAMU Carpool
          </h1>
          <p className="text-white/90 text-lg font-semibold">
            Request Registration
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-2xl font-black text-gray-900 mb-2">
            Join Our Community
          </h2>
          <p className="text-gray-600 mb-6">
            Submit a registration request to get started
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-red-800 font-medium">{error}</p>
                </div>
              </div>
            )}

            {/* Full Name */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-3">
                Full Name *
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-3">
                Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                  placeholder="you@tamu.edu"
                  required
                />
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-3">
                Gender *
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                required
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> After approval, you'll receive an email with a temporary password. 
                You'll be required to change it and complete your profile on first login.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#500000] to-[#79F200] text-white rounded-xl font-black text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? 'Submitting Request...' : 'Submit Registration Request'}
            </button>

            {/* Login Link */}
            <p className="text-center text-gray-600 font-medium">
              Already have an account?{' '}
              <Link to="/login" className="text-[#500000] hover:text-[#79F200] font-bold transition-colors">
                Log in here
              </Link>
            </p>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-white/80 text-sm font-medium">
          <p>© 2025 TAMU Carpool. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Register;