import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, onSnapshot, where, Timestamp } from 'firebase/firestore';

const PhoneRoom = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    pickup: '',
    dropoff: '',
    riders: 1
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || !formData.pickup || !formData.dropoff) {
      setMessage('Please fill in all fields');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const blacklistRef = collection(db, 'blacklist');
      const blacklistQuery = query(blacklistRef, where('number', '==', formData.phone));
      const blacklistSnapshot = await new Promise((resolve) => {
        const unsubscribe = onSnapshot(blacklistQuery, (snapshot) => {
          unsubscribe();
          resolve(snapshot);
        });
      });

      if (!blacklistSnapshot.empty) {
        setMessage('This phone number is blocked');
        setLoading(false);
        return;
      }

        await addDoc(collection(db, 'rides'), {
        patronName: formData.name,
        phone: formData.phone,
        pickup: formData.pickup,
        dropoff: formData.dropoff,
        riders: formData.riders,
        status: 'pending',
        carNumber: null,
        assignedDriver: null,
        requestedAt: Timestamp.now(),  // Changed from serverTimestamp()
        completedAt: null,
        willingToCombine: false,
        carInfo: null,
        requestType: 'phone'
        });

      setMessage('Request submitted successfully!');
      setFormData({ name: '', phone: '', pickup: '', dropoff: '', riders: 1 });
    } catch (error) {
      console.error('Error submitting request:', error);
      setMessage('Error submitting request: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Phone Room</h2>
      
      <div className="bg-white p-6 rounded-lg shadow">
        {message && (
          <div className={`mb-4 p-3 rounded ${message.includes('Error') || message.includes('blocked') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patron Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="(123) 456-7890"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pickup Location
            </label>
            <input
              type="text"
              value={formData.pickup}
              onChange={(e) => setFormData({...formData, pickup: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="123 Main St, College Station"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dropoff Location
            </label>
            <input
              type="text"
              value={formData.dropoff}
              onChange={(e) => setFormData({...formData, dropoff: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="456 University Dr, College Station"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Riders
            </label>
            <input
              type="number"
              min="1"
              max="8"
              value={formData.riders}
              onChange={(e) => setFormData({...formData, riders: parseInt(e.target.value) || 1})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition font-medium disabled:bg-gray-400"
          >
            {loading ? 'Submitting...' : 'Submit Phone Request'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhoneRoom;