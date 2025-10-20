import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, Timestamp, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { User, Mail, Lock, Phone, AlertCircle, ArrowLeft, Clock } from 'lucide-react';

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
  const [pendingApproval, setPendingApproval] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const checkEmailApproval = async (email) => {
    try {
      const approvalsRef = collection(db, 'emailApprovals');
      const q = query(approvalsRef, where('email', '==', email.toLowerCase()));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return { approved: false, exists: false };
      }
      
      const approval = snapshot.docs[0].data();
      return { 
        approved: approval.status === 'approved', 
        exists: true,
        status: approval.status 
      };
    } catch (error) {
      console.error('Error checking email approval:', error);
      throw error;
    }
  };

  const requestApproval = async (email, name) => {
    try {
      await addDoc(collection(db, 'emailApprovals'), {
        email: email.toLowerCase(),
        name: name,
        status: 'pending',
        createdAt: Timestamp.now(),
        requestedAt: Timestamp.now(),  // ADD THIS LINE
        approved: false
      });
    } catch (error) {
      console.error('Error requesting approval:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPendingApproval(false);

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
      // Check if email is approved
      const emailCheck = await checkEmailApproval(formData.email);
      
      if (!emailCheck.approved) {
        if (emailCheck.exists && emailCheck.status === 'pending') {
          setError('Your email is pending admin approval. Please wait for approval before creating an account.');
          setPendingApproval(true);
          setLoading(false);
          return;
        } else if (emailCheck.exists && emailCheck.status === 'rejected') {
          setError('Your email has been rejected. Please contact an administrator.');
          setLoading(false);
          return;
        } else {
          // Email not in system - create pending request
          await requestApproval(formData.email, formData.name);
          setError('Your email needs approval. We\'ve submitted a request to the administrators. You\'ll be notified when approved.');
          setPendingApproval(true);
          setLoading(false);
          return;
        }
      }

      // Email is approved - proceed with registration
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

      alert('Registration successful! You can now log in.');
      navigate('/login');
    } catch (error) {
      console.error('Error creating account:', error);
      setError('Error creating account: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#500000] via-[#79F200] to-[#500000] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Back to Login Button */}
        <Link 
          to="/login" 
          className="inline-flex items-center gap-2 text-white hover:text-gray-200 mb-6 font-semibold transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Login
        </Link>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#500000] to-[#79F200] p-8 text-center">
            <h2 className="text-4xl font-black text-white mb-2">Join TAMU Carpool</h2>
            <p className="text-white/90 text-lg font-medium">Create your account to start carpooling</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* Error/Pending Message */}
            {error && (
              <div className={`p-4 rounded-xl flex items-start gap-3 ${
                pendingApproval 
                  ? 'bg-yellow-50 border-2 border-yellow-200' 
                  : 'bg-red-50 border-2 border-red-200'
              }`}>
                {pendingApproval ? (
                  <Clock className="flex-shrink-0 text-yellow-600 mt-0.5" size={20} />
                ) : (
                  <AlertCircle className="flex-shrink-0 text-red-600 mt-0.5" size={20} />
                )}
                <div className="flex-1">
                  <p className={`font-semibold ${
                    pendingApproval ? 'text-yellow-800' : 'text-red-800'
                  }`}>
                    {error}
                  </p>
                  {pendingApproval && (
                    <p className="text-yellow-700 text-sm mt-2">
                      Check back later or contact an administrator for faster approval.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-5">
              <h3 className="text-xl font-black text-gray-900 pb-2 border-b-4 border-[#79F200]">
                Basic Information
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
                      placeholder="Confirm password"
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

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">Gender</label>
                  <input
                    type="text"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                    placeholder="e.g., Male, Female, Non-binary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">Pronouns</label>
                  <input
                    type="text"
                    name="pronouns"
                    value={formData.pronouns}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                    placeholder="e.g., he/him, she/her, they/them"
                  />
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="space-y-5">
              <h3 className="text-xl font-black text-gray-900 pb-2 border-b-4 border-[#79F200]">
                Address Information
              </h3>

              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">Street Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                    placeholder="123 Main St"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-3">City</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                      placeholder="College Station"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-3">State</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                      placeholder="TX"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-3">ZIP Code</label>
                    <input
                      type="text"
                      name="zip"
                      value={formData.zip}
                      onChange={handleChange}
                      className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                      placeholder="77840"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-5">
              <h3 className="text-xl font-black text-gray-900 pb-2 border-b-4 border-[#79F200]">
                Emergency Contact
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">Emergency Contact Name</label>
                  <input
                    type="text"
                    name="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                    placeholder="Jane Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    name="emergencyPhone"
                    value={formData.emergencyPhone}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                    placeholder="(555) 987-6543"
                  />
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-5">
              <h3 className="text-xl font-black text-gray-900 pb-2 border-b-4 border-[#79F200]">
                Additional Information
              </h3>

              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">Car Information</label>
                  <textarea
                    name="carInfo"
                    value={formData.carInfo}
                    onChange={handleChange}
                    rows="2"
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium resize-none"
                    placeholder="e.g., 2020 Honda Civic, Blue, 5 seats"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">Dietary Restrictions</label>
                  <textarea
                    name="dietaryRestrictions"
                    value={formData.dietaryRestrictions}
                    onChange={handleChange}
                    rows="2"
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium resize-none"
                    placeholder="e.g., Vegetarian, Gluten-free, Nut allergy"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#500000] to-[#79F200] text-white rounded-xl font-black text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
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
      </div>
    </div>
  );
};

export default Register;