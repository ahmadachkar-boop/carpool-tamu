import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { updatePassword, signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { User, Lock, Phone, MapPin, AlertCircle, CheckCircle } from 'lucide-react';

const CompleteProfile = () => {
  const navigate = useNavigate();
  const { userProfile, currentUser } = useAuth();
  const [step, setStep] = useState(1); // 1 = change password, 2 = complete profile
  
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  
  const [profileData, setProfileData] = useState({
    gender: '',
    phone: '',
    pronouns: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    emergencyContact: '',
    emergencyPhone: '',
    dietaryRestrictions: ''
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  const handleProfileChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value
    });
  };

  const formatPhoneNumber = (value) => {
    const phone = value.replace(/\D/g, '');
    if (phone.length <= 3) return phone;
    if (phone.length <= 6) return `(${phone.slice(0, 3)}) ${phone.slice(3)}`;
    return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6, 10)}`;
  };

  const handlePhoneInput = (e, fieldName) => {
    const formatted = formatPhoneNumber(e.target.value);
    setProfileData({
      ...profileData,
      [fieldName]: formatted
    });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      setError('Please fill in both password fields');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Update Firebase Auth password
      await updatePassword(currentUser, passwordData.newPassword);
      console.log('✅ Password updated successfully');
      
      // Move to next step
      setStep(2);
      setError('');
    } catch (error) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/requires-recent-login') {
        setError('For security reasons, please log out and log back in, then try again.');
      } else {
        setError('Error changing password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation - gender and phone are required
    if (!profileData.gender) {
      setError('Gender is required');
      return;
    }

    if (!profileData.phone) {
      setError('Phone number is required');
      return;
    }

    setLoading(true);

    try {
      console.log('🔄 Updating profile in Firestore...');
      
      // Update user profile in Firestore
      const memberRef = doc(db, 'members', userProfile.id);
      await updateDoc(memberRef, {
        ...profileData,
        profileCompleted: true,
        tempPassword: false,
        updatedAt: new Date()
      });

      console.log('✅ Profile updated in Firestore');

      // Wait a moment for update to propagate
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Log out the user to force fresh login
      console.log('🔄 Logging out to refresh session...');
      await signOut(auth);

      // Show success message and redirect to login
      alert('✅ Profile setup complete! Please log in again with your new password.');
      navigate('/login');
      
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      setError('Error updating profile. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#79F200] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-2xl relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-3xl shadow-2xl mb-4">
            <span className="text-5xl">🚗</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-2">
            Welcome to TAMU Carpool!
          </h1>
          <p className="text-white/90 text-lg font-semibold">
            Let's complete your account setup
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="bg-white rounded-2xl p-4 mb-6 shadow-lg">
          <div className="flex items-center justify-center gap-4">
            <div className={`flex items-center gap-2 ${step === 1 ? 'text-[#79F200]' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                step === 1 ? 'bg-[#79F200] text-white' : 'bg-gray-200'
              }`}>
                1
              </div>
              <span className="font-bold hidden sm:inline">Change Password</span>
            </div>
            <div className="w-12 h-1 bg-gray-200 rounded"></div>
            <div className={`flex items-center gap-2 ${step === 2 ? 'text-[#79F200]' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                step === 2 ? 'bg-[#79F200] text-white' : 'bg-gray-200'
              }`}>
                2
              </div>
              <span className="font-bold hidden sm:inline">Complete Profile</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* Step 1: Change Password */}
          {step === 1 && (
            <div>
              <div className="mb-6">
                <h2 className="text-3xl font-black text-gray-900 mb-2">
                  Set Your Password
                </h2>
                <p className="text-gray-600">
                  For security, please change your temporary password
                </p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-5">
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
                    New Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                      placeholder="Min. 6 characters"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="password"
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                      placeholder="Confirm password"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-[#500000] to-[#79F200] text-white rounded-xl font-black text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {loading ? 'Updating Password...' : 'Continue to Profile Setup'}
                </button>
              </form>
            </div>
          )}

          {/* Step 2: Complete Profile */}
          {step === 2 && (
            <div>
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 bg-green-50 border-2 border-green-200 rounded-xl px-4 py-2 mb-4">
                  <CheckCircle className="text-green-600" size={20} />
                  <span className="text-sm text-green-800 font-bold">Password updated successfully!</span>
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-2">
                  Complete Your Profile
                </h2>
                <p className="text-gray-600">
                  Tell us a bit more about yourself
                </p>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                      <p className="text-sm text-red-800 font-medium">{error}</p>
                    </div>
                  </div>
                )}

                {/* Contact Information */}
                <div>
                  <h3 className="text-xl font-black text-gray-900 pb-2 border-b-4 border-[#79F200] mb-4">
                    Contact Information
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-3">
                        Gender *
                      </label>
                      <select
                        name="gender"
                        value={profileData.gender}
                        onChange={handleProfileChange}
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

                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-3">
                        Phone Number *
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                          type="tel"
                          name="phone"
                          value={profileData.phone}
                          onChange={(e) => handlePhoneInput(e, 'phone')}
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                          placeholder="(555) 123-4567"
                          maxLength="14"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-3">
                        Pronouns (Optional)
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                          type="text"
                          name="pronouns"
                          value={profileData.pronouns}
                          onChange={handleProfileChange}
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                          placeholder="e.g., he/him, she/her, they/them"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div>
                  <h3 className="text-xl font-black text-gray-900 pb-2 border-b-4 border-[#79F200] mb-4">
                    Address (Optional)
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-3">
                        Street Address
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                          type="text"
                          name="address"
                          value={profileData.address}
                          onChange={handleProfileChange}
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                          placeholder="123 Main St"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-3">City</label>
                        <input
                          type="text"
                          name="city"
                          value={profileData.city}
                          onChange={handleProfileChange}
                          className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                          placeholder="College Station"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-3">State</label>
                        <input
                          type="text"
                          name="state"
                          value={profileData.state}
                          onChange={handleProfileChange}
                          className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                          placeholder="TX"
                          maxLength="2"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-3">ZIP</label>
                        <input
                          type="text"
                          name="zip"
                          value={profileData.zip}
                          onChange={handleProfileChange}
                          className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                          placeholder="77843"
                          maxLength="5"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div>
                  <h3 className="text-xl font-black text-gray-900 pb-2 border-b-4 border-[#79F200] mb-4">
                    Emergency Contact (Optional)
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-3">
                        Contact Name
                      </label>
                      <input
                        type="text"
                        name="emergencyContact"
                        value={profileData.emergencyContact}
                        onChange={handleProfileChange}
                        className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-3">
                        Contact Phone
                      </label>
                      <input
                        type="tel"
                        name="emergencyPhone"
                        value={profileData.emergencyPhone}
                        onChange={(e) => handlePhoneInput(e, 'emergencyPhone')}
                        className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium"
                        placeholder="(555) 123-4567"
                        maxLength="14"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div>
                  <h3 className="text-xl font-black text-gray-900 pb-2 border-b-4 border-[#79F200] mb-4">
                    Additional Information
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-3">
                      Dietary Restrictions (Optional)
                    </label>
                    <textarea
                      name="dietaryRestrictions"
                      value={profileData.dietaryRestrictions}
                      onChange={handleProfileChange}
                      rows="2"
                      className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#79F200] focus:ring-4 focus:ring-[#79F200]/20 transition-all outline-none font-medium resize-none"
                      placeholder="e.g., Vegetarian, Gluten-free, Nut allergy"
                    />
                  </div>
                </div>

                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> After completing your profile, you'll be logged out and need to log in again with your new password.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-[#500000] to-[#79F200] text-white rounded-xl font-black text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {loading ? 'Completing Setup...' : 'Complete Setup'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompleteProfile;