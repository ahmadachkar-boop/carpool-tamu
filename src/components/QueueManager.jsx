import React from 'react';
import { X, RefreshCw, Trash2, Send, Clock } from 'lucide-react';
import { getMessageQueue, removeQueuedMessage } from '../offlineUtils';

const QueueManager = ({ isOpen, onClose, onSync, onRetryMessage, onDeleteMessage }) => {
  const queue = getMessageQueue();

  if (!isOpen) return null;

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#79F200] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Message Queue</h2>
            <p className="text-sm text-gray-700">
              {queue.length} {queue.length === 1 ? 'message' : 'messages'} pending
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
          >
            <X size={24} className="text-gray-900" />
          </button>
        </div>

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto p-6">
          {queue.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send size={32} className="text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                All Caught Up!
              </h3>
              <p className="text-gray-600">
                No messages in the queue. All messages have been sent.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Message Info */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                          Car {item.carNumber}
                        </span>
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                          {item.sender === 'couch' ? 'From Couch' : 'From Navigator'}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock size={12} />
                          {formatTimestamp(item.queuedAt)}
                        </span>
                      </div>

                      {/* Message Content */}
                      <p className="text-gray-900 text-sm font-medium mb-1 break-words">
                        {item.message}
                      </p>

                      {/* Sender Name */}
                      <p className="text-xs text-gray-500">
                        From: {item.senderName}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => onRetryMessage(item)}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center"
                        title="Retry sending"
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Delete this queued message?')) {
                            onDeleteMessage(item.id);
                          }
                        }}
                        className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition flex items-center justify-center"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {queue.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              <p className="font-semibold">Auto-sync enabled</p>
              <p>Messages will sync when connection is restored</p>
            </div>
            <button
              onClick={onSync}
              className="px-6 py-3 bg-[#79F200] text-gray-900 rounded-lg font-bold hover:bg-[#6dd900] transition flex items-center gap-2 whitespace-nowrap"
            >
              <RefreshCw size={18} />
              Sync Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueManager;
