import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Navbar = () => {
  const { user, signOut, isLibrarian } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async (e) => {
    e.preventDefault();
    await signOut();
    navigate('/');
  };

  const handleFeaturesClick = (e) => {
    if (location.pathname === '/') {
      e.preventDefault();
      document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const workspacePath = isLibrarian ? '/library-map' : '/student-map';

  return (
    <nav>
      <Link to="/" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: 'var(--primary)' }}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="9" y1="21" x2="9" y2="9"></line>
        </svg>
        DeskGuard
      </Link>

      {!user ? (
        // STATE 1: LOGGED OUT NAVBAR
        <div className="nav-links" id="nav-logged-out">
          <a href="/#architecture" onClick={handleFeaturesClick} className="nav-link-text">
            Features
          </a>
          <Link to="/signin" className="btn-primary">
            Sign In
            <div className="btn-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </div>
          </Link>
        </div>
      ) : (
        // STATE 2: LOGGED IN NAVBAR
        <div className="nav-links" id="nav-logged-in">
          <span onClick={handleSignOut} className="nav-link-text">
            Sign Out
          </span>
          <Link to={workspacePath} className="btn-primary">
            Open Workspace
            <div className="btn-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </div>
          </Link>
        </div>
      )}
    </nav>
  );
};
export default Navbar;
