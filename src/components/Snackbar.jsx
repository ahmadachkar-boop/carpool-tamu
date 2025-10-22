import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X, RotateCcw } from 'lucide-react';

/**
 * Snackbar notification component
 * Shows temporary notifications with optional undo action
 */
const Snackbar = ({ isOpen, message, type = 'info', onClose, onUndo, autoHideDuration = 5000 }) => {
  useEffect(() => {
    if (isOpen && !onUndo) {
      const timer = setTimeout(() => {
        onClose();
      }, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoHideDuration, onClose, onUndo]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} className="text-green-600" />;
      case 'error':
        return <XCircle size={20} className="text-red-600" />;
      case 'warning':
        return <AlertCircle size={20} className="text-yellow-600" />;
      default:
        return <Info size={20} className="text-blue-600" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-slide-up">
      <div className={`${getBgColor()} border-2 rounded-lg shadow-lg p-4 flex items-center gap-3`}>
        {getIcon()}
        <p className="flex-1 text-sm font-medium text-gray-800">{message}</p>
        {onUndo && (
          <button
            onClick={onUndo}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold flex items-center gap-1 min-h-touch touch-manipulation"
          >
            <RotateCcw size={14} />
            Undo
          </button>
        )}
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded touch-manipulation"
        >
          <X size={18} className="text-gray-600" />
        </button>
      </div>
    </div>
  );
};

export default Snackbar;
