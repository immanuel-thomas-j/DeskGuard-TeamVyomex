import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext({
  showToast: () => {}
});

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState({
    show: false,
    content: null, // can be a string or a React node/object
    type: 'normal',
    duration: 3500
  });

  const [timeoutId, setTimeoutId] = useState(null);

  const showToast = useCallback((content, duration = 3500, type = 'normal') => {
    setToast(prev => {
      if (timeoutId) clearTimeout(timeoutId);
      
      const newTimeoutId = setTimeout(() => {
        setToast(current => ({ ...current, show: false }));
      }, duration);
      
      setTimeoutId(newTimeoutId);
      
      return {
        show: true,
        content,
        type,
        duration
      };
    });
  }, [timeoutId]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toast={toast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toast }) => {
  const { show, content, type } = toast;

  if (!show) return null;

  return (
    <div
      id="toast"
      className={`show ${type === 'alert' ? 'alert' : ''}`}
      style={{
        pointerEvents: 'none'
      }}
    >
      {typeof content === 'string' ? (
        <span>{content}</span>
      ) : React.isValidElement(content) ? (
        content
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {content.icon && <div style={{ flexShrink: 0, marginTop: '2px' }}>{content.icon}</div>}
          <div>
            {content.title && <b style={{ fontSize: '1.05rem', display: 'block', marginBottom: '2px' }}>{content.title}</b>}
            {content.message && <span>{content.message}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export const useToast = () => useContext(ToastContext);
