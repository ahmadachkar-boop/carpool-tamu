import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { User, Mail, Lock, Phone, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    gender: '',
    pronouns: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    emergencyContact: '',
    emergencyPhone: '',
    carInfo: '',
    dietaryRestrictions: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name || !formData.email || !formData.password || !formData.phone) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      // Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Create member document in Firestore
      await setDoc(doc(db, 'members', userCredential.user.uid), {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: 'member',
        gender: formData.gender,
        pronouns: formData.pronouns,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        emergencyContact: formData.emergencyContact,
        emergencyPhone: formData.emergencyPhone,
        carInfo: formData.carInfo,
        dietaryRestrictions: formData.dietaryRestrictions,
        points: 0,
        nightsWorked: 0,
        createdAt: Timestamp.now()
      });

      alert('Registration successful! Redirecting to dashboard...');
      navigate('/');
    } catch (error) {
      console.error('Registration error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('This email is already registered');
      } else {
        setError('Error creating account: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#79F200] py-8 px-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="max-w-4xl mx-auto relative z-10">
        {/* Back Button */}
        <Link 
          to="/login"
          className="inline-flex items-center gap-2 text-white hover:text-white/80 mb-6 transition font-semibold text-lg"
        >
          <ArrowLeft size={24} />
          <span>Back to Login</span>
        </Link>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-32 h-32 bg-white rounded-3xl shadow-2xl mb-6 p-4">
            <img 
              src={`${process.env.PUBLIC_URL}/logo.png`}
              alt="TAMU Carpool Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                console.error('Logo failed to load');
                e.target.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-white mb-3 drop-shadow-lg">
            Join TAMU Carpool
          </h1>
          <p className="text-white/90 text-lg font-medium">Create your account to get started</p>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10">
          {error && (
            <div className="mb-8 p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={22} />
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Required Information */}
            <div>
              <h3 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3 pb-4 border-b-4 border-[#79F200]">
                <div className="w-10 h-10 bg-[#79F200] rounded-xl flex items-center justify-center">
                  <CheckCircle className="text-white" size={24} />
                </div>
                Required Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">Full Name *</label>
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

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">Email *</label>
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

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                      placeholder="Min. 6 characters"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">Confirm Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                      placeholder="Re-enter password"
                      required
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-900 mb-3">Phone Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                      placeholder="(555) 123-4567"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Optional Information */}
            <div>
              <h3 className="text-2xl font-black text-gray-900 mb-6 pb-4 border-b-4 border-gray-200">Optional Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <input
                  type="text"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                  placeholder="Gender"
                />

                <input
                  type="text"
                  name="pronouns"
                  value={formData.pronouns}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                  placeholder="Pronouns"
                />

                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                  placeholder="Street Address"
                />

                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                  placeholder="City"
                />

                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                  placeholder="State"
                />

                <input
                  type="text"
                  name="zip"
                  value={formData.zip}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                  placeholder="ZIP Code"
                />

                <input
                  type="text"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                  placeholder="Emergency Contact Name"
                />

                <input
                  type="tel"
                  name="emergencyPhone"
                  value={formData.emergencyPhone}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                  placeholder="Emergency Contact Phone"
                />

                <input
                  type="text"
                  name="carInfo"
                  value={formData.carInfo}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                  placeholder="Car Info (Make, Model, Year)"
                />

                <input
                  type="text"
                  name="dietaryRestrictions"
                  value={formData.dietaryRestrictions}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                  placeholder="Dietary Restrictions"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#79F200] text-gray-900 font-black py-5 rounded-2xl hover:shadow-2xl hover:shadow-[#79F200]/40 transform hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 text-lg"
            >
              {loading ? (
                <>
                  <div className="w-6 h-6 border-3 border-gray-900/30 border-t-gray-900 rounded-full animate-spin"></div>
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={24} />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t-2 border-gray-100">
            <p className="text-center text-gray-600 text-base">
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="text-[#79F200] hover:text-[#5bc000] font-bold transition-colors"
              >
                Sign in here
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

export default Register;