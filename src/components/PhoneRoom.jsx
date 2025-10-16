import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { useActiveNDR } from '../ActiveNDRContext';
import { AlertCircle } from 'lucide-react';

const PhoneRoom = () => {
  const { activeNDR, loading } = useActiveNDR();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    pickup: '',
    dropoff: '',
    riders: 1
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Phone Room</h2>
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Show gate if no active NDR
  if (!activeNDR) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Phone Room</h2>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-8 text-center">
          <AlertCircle className="mx-auto mb-4 text-yellow-600" size={64} />
          <h3 className="text-xl font-bold text-gray-800 mb-2">No Active NDR</h3>
          <p className="text-gray-600 mb-4">
            Phone Room is currently unavailable. A director must activate an NDR from the NDR Reports page before you can add phone requests.
          </p>
          <p className="text-sm text-gray-500">
            Directors: Go to NDR Reports and activate an Operating Night event to enable Phone Room.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || !formData.pickup || !formData.dropoff) {
      setMessage('Please fill in all fields');
      return;
    }

    setSubmitLoading(true);
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
        setSubmitLoading(false);
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
        requestedAt: Timestamp.now(),
        completedAt: null,
        willingToCombine: false,
        carInfo: null,
        requestType: 'phone',
        ndrId: activeNDR.id, // Link to active NDR
        eventId: activeNDR.eventId // Link to event
      });

      setMessage('Request submitted successfully!');
      setFormData({ name: '', phone: '', pickup: '', dropoff: '', riders: 1 });
    } catch (error) {
      console.error('Error submitting request:', error);
      setMessage('Error submitting request: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Phone Room</h2>
        <div className="bg-green-100 px-4 py-2 rounded-lg">
          <p className="text-sm font-semibold text-green-800">Active NDR: {activeNDR.eventName}</p>
        </div>
      </div>
      
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
            disabled={submitLoading}
            className="w-full py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition font-medium disabled:bg-gray-400"
          >
            {submitLoading ? 'Submitting...' : 'Submit Phone Request'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhoneRoom;