import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const SignIn = () => {
  const { user, isLibrarian, loading, signInWithGoogle, signInWithEmailAndPassword } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [connecting, setConnecting] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [signingInAdmin, setSigningInAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('student');

  useEffect(() => {
    if (!loading && user) {
      if (isLibrarian) {
        navigate('/library-map', { replace: true });
      } else {
        navigate('/student-map', { replace: true });
      }
    }
  }, [user, isLibrarian, loading, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setConnecting(true);
      localStorage.setItem('deskguard_auth_token', 'true');
      const redirectUrl = window.location.origin + '/signin';
      await signInWithGoogle(redirectUrl);
    } catch (err) {
      localStorage.removeItem('deskguard_auth_token');
      console.error(err);
      showToast({
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="var(--occ)" strokeWidth="2" fill="none">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        ),
        title: 'Authentication Failed',
        message: err.message || 'Could not establish connection to Supabase.'
      }, 5000);
      setConnecting(false);
    }
  };

  const handleAdminSignIn = async (e) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword.trim()) {
      showToast({
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="#f59e0b" strokeWidth="2" fill="none">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        ),
        title: 'Validation Error',
        message: 'Please enter both email and password.'
      }, 4000);
      return;
    }

    try {
      setSigningInAdmin(true);
      await signInWithEmailAndPassword(adminEmail.trim(), adminPassword.trim());
    } catch (err) {
      console.error(err);
      showToast({
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="var(--occ)" strokeWidth="2" fill="none">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        ),
        title: 'Sign In Failed',
        message: err.message || 'Invalid administrator credentials.'
      }, 5000);
      setSigningInAdmin(false);
    }
  };

  const handleFillDemo = () => {
    setAdminEmail('admin@deskguard.com');
    setAdminPassword('admin123');
    showToast({
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="#10b981" strokeWidth="2.5" fill="none">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      ),
      title: 'Demo Credentials Loaded',
      message: 'Email and password auto-filled. Click submit to sign in.'
    }, 3000);
  };

  if (loading && localStorage.getItem('deskguard_auth_token') === 'true') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', position: 'relative', zIndex: 10, padding: '20px', textAlign: 'center' }}>
        <div className="scene" aria-hidden="true">
          <div className="grid-bg"></div>
          <div className="orb one" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(59, 130, 246, 0.12)', width: '320px', height: '320px' }}></div>
        </div>
        <div className="noise" aria-hidden="true"></div>
        <div className="brand" style={{ fontSize: '2.4rem', animation: 'pulse 1.5s infinite', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 'bold', letterSpacing: '-1px' }}>
          Desk<span style={{ color: 'var(--primary)' }}>Guard</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="scene" aria-hidden="true">
        <div className="grid-bg"></div>
        <div className="orb one"></div>
        <div className="orb two"></div>
      </div>
      <div className="noise" aria-hidden="true"></div>

      <main className="shell">
        <section className="hero signin-hero">
          <Link className="brand" to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"></rect>
              <path d="M3 9h18M9 21V9"></path>
            </svg>
            DeskGuard
          </Link>
          <h1>Sign in to your workspace</h1>
          <p>Authenticate with your credentials to enter the DeskGuard dashboard and manage spatial seat ledgers.</p>
        </section>

        <aside className="auth-panel">
          <div className="auth-card">
            {/* Tab Switcher Control */}
            <div className="tab-switcher">
              <div 
                className="tab-indicator" 
                style={{ transform: activeTab === 'librarian' ? 'translateX(100%)' : 'translateX(0)' }}
              ></div>
              <button 
                type="button" 
                className={`tab-btn ${activeTab === 'student' ? 'active' : ''}`}
                onClick={() => setActiveTab('student')}
              >
                Student Portal
              </button>
              <button 
                type="button" 
                className={`tab-btn ${activeTab === 'librarian' ? 'active' : ''}`}
                onClick={() => setActiveTab('librarian')}
              >
                Librarian Portal
              </button>
            </div>

            {activeTab === 'student' ? (
              <div className="tab-content" key="student">
                <div className="card-head">
                  <h2>Student Portal</h2>
                  <p>Sign in with your university Google account to reserve a desk and access the student spatial map.</p>
                </div>

                <button
                  type="button"
                  className="btn-google"
                  onClick={handleGoogleSignIn}
                  disabled={connecting || loading}
                  style={{ marginTop: '0.5rem' }}
                >
                  {connecting ? (
                    <>
                      <span className="spinner"></span>
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google Logo" />
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="tab-content" key="librarian">
                <div className="card-head">
                  <h2>Librarian Portal</h2>
                  <p>Sign in with your administrator credentials to monitor seat occupancy, dispatch sweeps, and view analytics.</p>
                </div>

                <form onSubmit={handleAdminSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    type="email"
                    placeholder="admin@deskguard.com"
                    className="auth-input"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                    disabled={signingInAdmin || loading}
                  />
                  <input
                    type="password"
                    placeholder="admin123"
                    className="auth-input"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    disabled={signingInAdmin || loading}
                  />
                  
                  <div className="demo-creds-box" onClick={handleFillDemo}>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--primary)" strokeWidth="2.5" fill="none" style={{ marginTop: '2px', flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <div>
                      <strong style={{ display: 'block', color: 'white', marginBottom: '2px' }}>Demo Account</strong>
                      <span style={{ color: 'var(--text-muted)' }}>Click here to autofill librarian credentials.</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="auth-btn-submit"
                    disabled={signingInAdmin || loading}
                  >
                    {signingInAdmin ? (
                      <>
                        <span className="spinner"></span>
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Sign In as Librarian</span>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>

          <p className="footnote" style={{ paddingLeft: '8px', marginTop: '8px' }}>
            Access is reserved for authorized students and staff. Verification is required to access the spatial ledger.
          </p>
        </aside>
      </main>
    </>
  );
};
export default SignIn;
