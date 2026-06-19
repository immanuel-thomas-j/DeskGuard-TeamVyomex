import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

// Pages
import Home from './pages/Home';
import SignIn from './pages/SignIn';
import StudentMapPage from './pages/StudentMapPage';
import LibrarianDashboardPage from './pages/LibrarianDashboardPage';

// Route guards
const ProtectedRoute = ({ children, requireAdmin }) => {
  const { user, isLibrarian, loading } = useAuth();

  if (loading) {
    return (
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh', 
          background: '#020617', 
          color: '#94a3b8',
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '1rem',
          letterSpacing: '1px'
        }}
      >
        LOADING SESSION...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (requireAdmin && !isLibrarian) {
    return <Navigate to="/student-map" replace />;
  }

  if (!requireAdmin && isLibrarian) {
    return <Navigate to="/library-map" replace />;
  }

  return children;
};

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/signin" element={<SignIn />} />
            <Route
              path="/student-map"
              element={
                <ProtectedRoute requireAdmin={false}>
                  <StudentMapPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/library-map"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <LibrarianDashboardPage />
                </ProtectedRoute>
              }
            />
            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
