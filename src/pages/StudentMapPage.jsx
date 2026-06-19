import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../utils/supabase';
import { Library3DMap } from '../components/Library3DMap';

const TOTAL_DESKS = 24;

// Inline SVG QR code generator component matching original RNG
const QRGenerator = ({ deskId }) => {
  const size = 21;
  const cell = 100 / size;
  const seed = deskId * 1234567;
  
  const rng = (i) => {
    return ((seed * (i + 1) * 2654435761) >>> 0) % 2;
  };

  const getFinderRects = (ox, oy) => {
    const rects = [];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBlack = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        if (isBlack) {
          rects.push(
            <rect
              key={`finder-${ox}-${oy}-${r}-${c}`}
              x={(ox + c) * cell}
              y={(oy + r) * cell}
              width={cell + 0.1}
              height={cell + 0.1}
              fill="#000"
            />
          );
        }
      }
    }
    return rects;
  };

  const dataRects = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Skip finder pattern areas
      if ((r < 8 && c < 8) || (r < 8 && c > 12) || (r > 12 && c < 8)) continue;
      if (rng(r * size + c)) {
        dataRects.push(
          <rect
            key={`data-${r}-${c}`}
            x={c * cell}
            y={r * cell}
            width={cell + 0.1}
            height={cell + 0.1}
            fill="#000"
          />
        );
      }
    }
  }

  return (
    <svg className="qr-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#fff" />
      {dataRects}
      {getFinderRects(0, 0)}
      {getFinderRects(14, 0)}
      {getFinderRects(0, 14)}
    </svg>
  );
};

export const StudentMapPage = () => {
  const { user, profile, refreshProfile, signOut, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    navigate('/', { replace: true });
    setTimeout(async () => {
      await signOut();
    }, 100);
  };

  const [appLoading, setAppLoading] = useState(true);
  const [desks, setDesks] = useState([]);
  const [myDesk, setMyDesk] = useState(null);

  // Modals States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [qrModal, setQrModal] = useState({ show: false, deskId: null, phase: 'choice' });
  const [stillHereModal, setStillHereModal] = useState({ show: false, deskId: null, remaining: 60 });
  const [alertModal, setAlertModal] = useState({ show: false, message: '' });

  // Profile Form States
  const [profileForm, setProfileForm] = useState({
    name: '',
    reg: '',
    dept: '',
    year: ''
  });

  const qrScannerRef = useRef(null);
  const stillHereIntervalRef = useRef(null);

  // 1. Auth Routing Protection
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/signin');
      return;
    }

    // Check if librarian, routing back to librarian layout
    const checkRole = async () => {
      if (user.email === 'admin@deskguard.com') {
        navigate('/library-map');
        return;
      }

      const { data: librarianData } = await supabase
        .from('librarians')
        .select('email')
        .eq('email', user.email)
        .maybeSingle();

      if (librarianData) {
        navigate('/library-map');
        return;
      }

      // If student profile is missing, open modal
      if (!profile) {
        setShowProfileModal(true);
        setAppLoading(false);
        return;
      }

      setProfileForm({
        name: profile.full_name || '',
        reg: profile.reg_no || '',
        dept: profile.department || '',
        year: profile.academic_year || ''
      });

      // Show onboarding if never seen
      const onboardingSeenKey = `deskguard_onboarding_seen_${user.email}`;
      if (localStorage.getItem(onboardingSeenKey) !== 'true') {
        setShowOnboarding(true);
      }

      fetchDesks();
    };

    checkRole();
  }, [user, profile, authLoading, navigate]);

  // 2. Database Sync
  const fetchDesks = async () => {
    try {
      const { data, error } = await supabase
        .from('seats')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setDesks(data);
        syncLocalState(data);
      }
      setAppLoading(false);
    } catch (err) {
      console.error("Error fetching desks:", err);
      setAppLoading(false);
    }
  };

  const syncLocalState = useCallback((desksList) => {
    const myActiveDesk = desksList.find(
      (d) => d.user_id === user?.id && (d.state === 'occupied' || d.state === 'away' || d.state === 'prompted')
    );
    setMyDesk(myActiveDesk ? myActiveDesk.id : null);
  }, [user]);

  // Realtime subscription setup
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('public:seats')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'seats' }, (payload) => {
        const updatedDesk = payload.new;
        
        setDesks((prevDesks) => {
          const newDesks = prevDesks.map(d => d.id === updatedDesk.id ? updatedDesk : d);
          syncLocalState(newDesks);
          return newDesks;
        });

        // Trigger user interaction notifications
        if (myDeskRef.current === updatedDesk.id) {
          if (updatedDesk.state === 'prompted') {
            openStillHere(updatedDesk.id);
          } else if (updatedDesk.state === 'abandoned' || updatedDesk.state === 'free') {
            if (updatedDesk.state === 'abandoned') {
              showToast({
                icon: (
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="#f59e0b" strokeWidth="2" fill="none">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                ),
                title: 'Session Expired',
                message: 'Desk was automatically released.'
              });
            }
            closeStillHere();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, syncLocalState]);

  // Keep a mutable ref of myDesk for realtime state check callback
  const myDeskRef = useRef(myDesk);
  useEffect(() => {
    myDeskRef.current = myDesk;
  }, [myDesk]);

  // Helper to update desk state
  const updateDeskState = async (newState) => {
    const targetDeskId = myDeskRef.current;
    if (!targetDeskId) return;

    const payload = {
      state: newState,
      last_updated: new Date().toISOString()
    };

    if (newState === 'free' || newState === 'abandoned') {
      payload.user_id = null;
      payload.user_email = null;
      setMyDesk(null);
    }

    try {
      const { error } = await supabase
        .from('seats')
        .update(payload)
        .eq('id', targetDeskId);

      if (error) throw error;

      closeStillHere();

      if (newState === 'free') {
        showToast({
          icon: <svg viewBox="0 0 24 24" width="18" height="18" stroke="#10b981" strokeWidth="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>,
          message: 'Checked out successfully.'
        });
      } else if (newState === 'away') {
        showToast({
          icon: <svg viewBox="0 0 24 24" width="18" height="18" stroke="#f59e0b" strokeWidth="2" fill="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>,
          message: 'Session paused. 20 min reserved.'
        });
      } else if (newState === 'occupied') {
        showToast({
          icon: <svg viewBox="0 0 24 24" width="18" height="18" stroke="#10b981" strokeWidth="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>,
          message: "Welcome back / Presence Confirmed!"
        });
      }

      fetchDesks();
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
        title: 'Database Error',
        message: err.message
      }, 5000);
    }
  };

  // 3. Modals and Triggers
  const openOnboarding = () => setShowOnboarding(true);
  const closeOnboarding = (markSeen) => {
    setShowOnboarding(false);
    if (markSeen && user) {
      localStorage.setItem(`deskguard_onboarding_seen_${user.email}`, 'true');
    }
  };

  const openQRModal = (id) => {
    setQrModal({ show: true, deskId: id, phase: 'choice' });
  };

  const closeQRModal = () => {
    setQrModal({ show: false, deskId: null, phase: 'choice' });
    stopQrScanner();
  };

  const startRealScan = () => {
    setQrModal(prev => ({ ...prev, phase: 'scan' }));
    
    // Defer initialization to allow element to mount
    setTimeout(() => {
      const container = document.getElementById('reader');
      if (!container) return;

      qrScannerRef.current = new Html5Qrcode("reader");

      const qrCodeSuccessCallback = (decodedText) => {
        const expected = qrModal.deskId?.toString();
        const expectedFormat = `desk-${qrModal.deskId}`;
        
        if (decodedText === expected || decodedText === expectedFormat) {
          stopQrScanner();
          setQrModal(prev => ({ ...prev, phase: 'success' }));
        } else {
          showToast({
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="var(--occ)" strokeWidth="2" fill="none">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            ),
            title: 'Wrong Desk!',
            message: `You scanned code: ${decodedText}. Please scan Desk #${qrModal.deskId}.`
          }, 4000);
        }
      };

      const config = { fps: 10, qrbox: { width: 200, height: 200 } };
      qrScannerRef.current.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
        .catch(err => {
          console.error("Camera startup error:", err);
          showToast({
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="#f59e0b" strokeWidth="2" fill="none">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            ),
            title: 'Camera Access Denied',
            message: 'Please allow camera permissions to scan.'
          }, 5000);
          setQrModal(prev => ({ ...prev, phase: 'choice' }));
        });
    }, 100);
  };

  const stopQrScanner = () => {
    if (qrScannerRef.current && qrScannerRef.current.isScanning) {
      qrScannerRef.current.stop().catch(err => console.error("Error stopping scanner", err));
    }
  };

  const simulateScan = () => {
    setQrModal(prev => ({ ...prev, phase: 'success' }));
  };

  const finishCheckin = async () => {
    const id = qrModal.deskId;
    if (!id || !user) return;

    try {
      const userDisplayName = profile ? `${profile.full_name} (${profile.reg_no})` : user.email;
      
      const { error } = await supabase
        .from('seats')
        .update({
          state: 'occupied',
          user_id: user.id,
          user_email: userDisplayName,
          last_updated: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      setMyDesk(id);
      closeQRModal();
      showToast({
        icon: <svg viewBox="0 0 24 24" width="18" height="18" stroke="#10b981" strokeWidth="2" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
        title: `Desk #${id}`,
        message: 'Session started successfully.'
      });
      fetchDesks();
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
        title: 'Check-in Failure',
        message: err.message
      });
    }
  };

  // 4. Still Here Countdown
  const openStillHere = (id) => {
    setStillHereModal({ show: true, deskId: id, remaining: 60 });
  };

  const closeStillHere = () => {
    if (stillHereIntervalRef.current) clearInterval(stillHereIntervalRef.current);
    setStillHereModal({ show: false, deskId: null, remaining: 60 });
  };

  const confirmPresence = () => {
    updateDeskState('occupied');
  };

  useEffect(() => {
    if (stillHereModal.show) {
      stillHereIntervalRef.current = setInterval(() => {
        setStillHereModal(prev => {
          if (prev.remaining <= 1) {
            clearInterval(stillHereIntervalRef.current);
            return { ...prev, remaining: 0 };
          }
          return { ...prev, remaining: prev.remaining - 1 };
        });
      }, 1000);
    } else {
      if (stillHereIntervalRef.current) clearInterval(stillHereIntervalRef.current);
    }

    return () => {
      if (stillHereIntervalRef.current) clearInterval(stillHereIntervalRef.current);
    };
  }, [stillHereModal.show]);

  // 5. Emergency Alert Modal
  const openAlert = () => {
    setAlertModal({ show: true, message: '' });
  };

  const closeAlert = () => {
    setAlertModal({ show: false, message: '' });
  };

  const sendAlert = async () => {
    const msg = alertModal.message.trim();
    if (!msg) {
      showToast({
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="#f59e0b" strokeWidth="2" fill="none">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        ),
        title: 'Validation Error',
        message: 'Please enter a short description.'
      }, 4000);
      return;
    }

    if (!myDesk) return;

    try {
      const displayName = profile ? profile.full_name : 'Student';
      const formattedMsg = `[${displayName}]: ${msg}`;

      const { error } = await supabase
        .from('seats')
        .update({ alert_message: formattedMsg })
        .eq('id', myDesk);

      if (error) throw error;

      closeAlert();
      showToast({
        icon: (
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginTop: '2px' }}>
            <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"></path>
          </svg>
        ),
        title: 'Librarian Alerted',
        message: 'Help is on the way.'
      }, 5000, 'alert');
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
        title: 'Network Error',
        message: 'Error sending alert context.'
      }, 5000);
    }
  };

  // 6. Profile Creation Modal
  const saveProfile = async () => {
    const { name, reg, dept, year } = profileForm;

    if (!name || !reg || !dept || !year) {
      showToast({
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="#f59e0b" strokeWidth="2" fill="none">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        ),
        title: 'Validation Error',
        message: 'Please fill out all identity fields.'
      }, 4000);
      return;
    }

    try {
      const newProfile = {
        id: user.id,
        full_name: name,
        reg_no: reg,
        department: dept,
        academic_year: year
      };

      const { error } = await supabase
        .from('profiles')
        .insert(newProfile);

      if (error) throw error;

      setShowProfileModal(false);
      showToast({
        icon: <svg viewBox="0 0 24 24" width="18" height="18" stroke="#10b981" strokeWidth="2" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
        title: 'Profile Created',
        message: 'Welcome to DeskGuard!'
      }, 4000);
      
      await refreshProfile();
      fetchDesks();
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
        title: 'Profile Sync Failure',
        message: err.message
      }, 5000);
    }
  };

  // 3D desk click logic
  const handleDeskClick = useCallback((id) => {
    if (myDeskRef.current === id) {
      showToast({
        icon: <svg viewBox="0 0 24 24" width="20" height="20" stroke="#10b981" strokeWidth="2.5" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
        title: `Desk #${id}`,
        message: 'This is your current workspace.'
      }, 3000);
      return;
    }

    const d = desksRef.current.find(x => x.id === id);
    if (!d) return;

    if (d.state === 'free') {
      if (myDeskRef.current) {
        showToast({
          icon: (
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="#f59e0b" strokeWidth="2" fill="none">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          ),
          message: `You are already checked in at Desk #${myDeskRef.current}. Please check out first.`
        }, 3500);
      } else {
        openQRModal(id);
      }
    } else {
      let stateLabel = d.state.toUpperCase();
      if (d.state === 'prompted') stateLabel = 'OCCUPIED';
      const stateColor = `var(--${d.state === 'prompted' ? 'occ' : d.state === 'abandoned' ? 'abd' : d.state})`;
      
      showToast(
        <div style={{ textAlign: 'center', lineHeight: 1.4 }}>
          <b>Desk #{id}</b><br />
          <span style={{ color: stateColor, fontWeight: 'bold' }}>{stateLabel}</span>
        </div>,
        3000
      );
    }
  }, [showToast]);

  // Keep a mutable ref of desks for click event check callback
  const desksRef = useRef(desks);
  useEffect(() => {
    desksRef.current = desks;
  }, [desks]);

  const activeDeskData = desks.find(d => d.id === myDesk);

  return (
    <>
      {appLoading && (
        <div id="app-loader">
          <div className="brand" style={{ fontSize: '1.8rem', animation: 'pulse 1.5s infinite' }}>
            Desk<span>Guard</span>
          </div>
        </div>
      )}

      {/* Render 3D Canvas */}
      {!appLoading && (
        <Library3DMap
          desks={desks}
          myDesk={myDesk}
          onDeskClick={handleDeskClick}
        />
      )}

      <div id="ui">
        {/* Topbar */}
        <div className="topbar">
          <div className="brand">Desk<span>Guard</span></div>

          <div className="right-controls">
            <button className="help-chip" onClick={openOnboarding} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              How to use
            </button>
            <button className="logout-chip" onClick={handleLogout} type="button">Logout</button>
          </div>
        </div>

        {/* Side Panels */}
        <div className="panels">
          <div className="panel" id="sp">
            <div className="ph" id="user-greeting">
              {profile ? `Hi, ${profile.full_name}!` : 'My Workspace'}
            </div>
            
            {!myDesk ? (
              <div id="s-none">
                <p className="info">
                  You are not checked in.<br />
                  Click any <span style={{ color: '#10b981', fontWeight: 600 }}>green</span> desk on the map to check in and begin your session.
                </p>
              </div>
            ) : activeDeskData && (activeDeskData.state === 'occupied' || activeDeskData.state === 'prompted') ? (
              <div id="s-occ">
                <div className="chip chip-green">
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="3" fill="currentColor">
                    <circle cx="12" cy="12" r="8"></circle>
                  </svg>
                  Active Session
                </div>
                <h2 style={{ marginBottom: '.75rem' }}>Desk <span id="ui-desk-occ" style={{ color: '#10b981' }}>#{myDesk}</span></h2>
                <p className="info">Step away temporarily? Pause reserves your desk for 20 minutes.</p>
                <button className="btn btn-yellow" onClick={() => updateDeskState('away')}>
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                  </svg>
                  Pause Session — Step Away
                </button>
                <button className="btn btn-red btn-alert" onClick={openAlert} style={{ marginTop: '.6rem' }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                    <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  Alert Librarian
                </button>
                <button className="btn btn-ghost" onClick={() => updateDeskState('free')}>End Session (Check Out)</button>
              </div>
            ) : activeDeskData && activeDeskData.state === 'away' ? (
              <div id="s-away">
                <div className="chip chip-yellow">
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                  </svg>
                  Session Paused
                </div>
                <h2 style={{ marginBottom: '.75rem' }}>Desk <span id="ui-desk-away" style={{ color: '#f59e0b' }}>#{myDesk}</span></h2>
                <p className="info">Your desk is reserved. Return before the timer expires or it will be freed automatically.</p>
                <button className="btn btn-blue" onClick={() => updateDeskState('occupied')}>I'm Back — Resume Session</button>
                <button className="btn btn-red btn-alert" onClick={openAlert}>
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                    <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  Alert Librarian
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Legend */}
        <div className="legend">
          <div className="li"><div className="dot" style={{ background: 'var(--free)' }}></div>Free</div>
          <div className="li"><div className="dot" style={{ background: 'var(--occ)' }}></div>Occupied</div>
          <div className="li"><div className="dot" style={{ background: 'var(--away)' }}></div>Away (20 min)</div>
          <div className="li"><div className="dot" style={{ background: 'var(--abd)' }}></div>Abandoned</div>
        </div>
      </div>

      {/* --- PROFILE MODAL --- */}
      {showProfileModal && (
        <div className="modal-overlay">
          <div className="profile-card">
            <div className="brand" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Desk<span>Guard</span></div>
            <h3 style={{ fontSize: '1.2rem', textAlign: 'center', marginBottom: '1.5rem' }}>Complete Your Student Profile</h3>
            
            <div className="form-group">
              <label htmlFor="input-name">Full Name</label>
              <input
                type="text"
                id="input-name"
                placeholder="e.g. John Doe"
                value={profileForm.name}
                onChange={e => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="input-reg">Registration Number</label>
              <input
                type="text"
                id="input-reg"
                placeholder="e.g. 21BCE1042"
                value={profileForm.reg}
                onChange={e => setProfileForm(prev => ({ ...prev, reg: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="input-dept">Department</label>
              <input
                type="text"
                id="input-dept"
                placeholder="e.g. Computer Science"
                value={profileForm.dept}
                onChange={e => setProfileForm(prev => ({ ...prev, dept: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Academic Year</label>
              <div className="year-btn-group">
                {['1st Year', '2nd Year', '3rd Year', '4th Year', 'Postgraduate'].map((val, idx) => {
                  const label = idx < 4 ? `${idx + 1}` : 'PG';
                  return (
                    <button
                      key={val}
                      type="button"
                      className={`year-btn ${profileForm.year === val ? 'selected' : ''}`}
                      onClick={() => setProfileForm(prev => ({ ...prev, year: val }))}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <button className="btn btn-blue" onClick={saveProfile} style={{ marginTop: '1rem', padding: '0.85rem' }}>
              Create Account Profile
            </button>
          </div>
        </div>
      )}

      {/* --- QR SCAN MODAL --- */}
      {qrModal.show && (
        <div className="modal-overlay-translucent">
          <div className="qr-card">
            <div className="qr-title">Check In to Desk #{qrModal.deskId}</div>
            <div className="qr-sub">Library Level 2</div>
            
            {qrModal.phase === 'choice' && (
              <div>
                <div className="qr-wrap">
                  <QRGenerator deskId={qrModal.deskId} />
                </div>
                <button className="btn btn-blue" onClick={startRealScan}>
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                  Scan Real QR Code
                </button>
                <button className="btn btn-ghost" onClick={simulateScan} style={{ marginTop: '.6rem', border: '1px dashed rgba(255,255,255,0.2)' }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.36-7.36l-.71.71M6.34 17.66l-.71.71m12.02 0l-.71-.71M6.34 6.34l-.71-.71M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"></path>
                  </svg>
                  Simulate Scan (Demo)
                </button>
              </div>
            )}

            {qrModal.phase === 'scan' && (
              <div id="qr-phase-scan">
                <div id="reader"></div>
                <div className="scan-tip-box">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="#60a5fa" strokeWidth="2" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M9 18h6m-3-14v-2m-6 4l-1.5-1.5m10.5 0l1.5-1.5m-15 7h2m14 0h2"></path>
                    <path d="M12 6a6 6 0 0 0-6 6c0 2.21 1.34 4.14 3.28 5.15C9.76 17.65 10 18.3 10 19v1a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1c0-.7.24-1.35.72-1.85C16.66 16.14 18 14.21 18 12a6 6 0 0 0-6-6z"></path>
                  </svg>
                  <div>
                    <b style={{ color: '#60a5fa' }}>Demo Tip:</b> Generate a QR code containing the number <b>"{qrModal.deskId}"</b> and hold it up to your camera.
                  </div>
                </div>
              </div>
            )}
            
            {qrModal.phase === 'success' && (
              <div className="scan-success" id="qr-phase-success">
                <div className="check-circle">
                  <svg viewBox="0 0 24 24" width="32" height="32" stroke="#10b981" strokeWidth="3" fill="none">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div style={{ fontFamily: 'Space Grotesk', fontSize: '1.1rem', fontWeight: 700, color: '#10b981', marginTop: '0.5rem' }}>
                  Verified!
                </div>
                
                <div className="session-info" id="session-info">
                  <div className="session-row">
                    <span className="k">Desk</span>
                    <span className="v">#{qrModal.deskId}</span>
                  </div>
                  <div className="session-row">
                    <span className="k">Location</span>
                    <span className="v">Library · Level 2</span>
                  </div>
                  <div className="session-row">
                    <span className="k">Check-in</span>
                    <span className="v">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="session-row">
                    <span className="k">Session limit</span>
                    <span className="v">2 hours</span>
                  </div>
                </div>

                <button className="btn btn-blue" onClick={finishCheckin} style={{ marginTop: '1.2rem', width: '100%' }}>
                  Complete Check-in
                </button>
              </div>
            )}
            
            {qrModal.phase !== 'success' && (
              <button id="qr-cancel-btn" className="btn btn-ghost" onClick={closeQRModal} style={{ marginTop: '1.2rem', fontSize: '.78rem', opacity: .6 }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- STILL HERE MODAL --- */}
      {stillHereModal.show && (
        <div className="modal-overlay-translucent">
          <div className="sh-card">
            <div className="sh-ring">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle className="track" cx="40" cy="40" r="35" />
                <circle
                  className="prog"
                  id="sh-prog"
                  cx="40"
                  cy="40"
                  r="35"
                  style={{
                    strokeDashoffset: (2 * Math.PI * 35) * (1 - stillHereModal.remaining / 60)
                  }}
                />
              </svg>
            </div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: '1.05rem', fontWeight: 700 }}>Are you still here?</div>
            <div style={{ fontSize: '.82rem', color: '#94a3b8', margin: '.5rem 0' }}>
              Desk #{stillHereModal.deskId} · Session limit reached
            </div>
            <div className="sh-timer" id="sh-timer">{stillHereModal.remaining}</div>
            <div style={{ fontSize: '.78rem', color: '#64748b', marginBottom: '1.2rem' }}>
              Seconds until server releases desk
            </div>
            <button className="btn btn-blue" onClick={confirmPresence}>Yes, I'm Here</button>
            <button className="btn btn-ghost" onClick={() => updateDeskState('free')} style={{ marginTop: '.4rem', fontSize: '.78rem' }}>
              Release My Desk
            </button>
          </div>
        </div>
      )}

      {/* --- ALERT LIBRARIAN MODAL --- */}
      {alertModal.show && (
        <div className="modal-overlay-translucent">
          <div className="alert-card">
            <div className="alert-icon">
              <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"></path>
              </svg>
            </div>
            <div className="alert-title">Alert Librarian</div>
            <p className="info" style={{ marginBottom: 0 }}>Describe the issue and a librarian will be notified immediately.</p>
            <textarea
              className="alert-input"
              placeholder="e.g. Someone is being noisy near Desk #12…"
              value={alertModal.message}
              onChange={e => setAlertModal(prev => ({ ...prev, message: e.target.value }))}
            />
            <button className="btn btn-red" onClick={sendAlert} style={{ marginTop: '.9rem' }}>Send Alert</button>
            <button className="btn btn-ghost" onClick={closeAlert} style={{ marginTop: '.35rem', fontSize: '.78rem' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* --- ONBOARDING GUIDE --- */}
      {showOnboarding && (
        <div className="modal-overlay-translucent">
          <div className="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
            <div className="onboard-top">
              <div>
                <div className="onboard-kicker">Quick Start</div>
                <div className="onboard-title" id="onboard-title">New here? Here’s how DeskGuard works.</div>
                <div className="onboard-copy">Use the map to find a free desk, point your camera to scan its QR code, and keep your session active with the timer controls.</div>
              </div>
              <button className="btn-plain" onClick={() => closeOnboarding(true)} style={{ border: 'none', padding: '0.4rem', borderRadius: '6px' }} type="button">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="onboard-steps">
              <div className="onboard-step">
                <div className="onboard-num">1</div>
                <div>
                  <h4>Find a green desk</h4>
                  <p>Green means free, red means occupied, yellow means away, and purple means abandoned.</p>
                </div>
              </div>
              <div className="onboard-step">
                <div className="onboard-num">2</div>
                <div>
                  <h4>Scan to check in</h4>
                  <p>Tap a free desk on the map, choose your scan method, and check in securely.</p>
                </div>
              </div>
              <div className="onboard-step">
                <div className="onboard-num">3</div>
                <div>
                  <h4>Use the session controls</h4>
                  <p>Pause when you step away, confirm when prompted, and check out when you leave.</p>
                </div>
              </div>
            </div>
            <div className="onboard-actions">
              <button className="btn btn-blue" onClick={() => closeOnboarding(true)} type="button" style={{ width: '100%' }}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default StudentMapPage;
