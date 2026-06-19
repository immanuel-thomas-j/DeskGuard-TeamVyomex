import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../utils/supabase';
import { Library3DMap } from '../components/Library3DMap';

export const LibrarianDashboardPage = () => {
  const { user, signOut, loading: authLoading } = useAuth();
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
  const [logs, setLogs] = useState([
    {
      time: new Date().toLocaleTimeString(),
      message: 'System connected to Supabase Realtime Database.',
      type: 'system'
    }
  ]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Keep a mutable ref of desks to inspect old state in realtime update callback
  const desksRef = useRef([]);
  useEffect(() => {
    desksRef.current = desks;
  }, [desks]);

  // Auth Protection for Admin Role
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/signin');
      return;
    }

    const verifyAdmin = async () => {
      if (user.email === 'admin@deskguard.com') {
        fetchDesks();
        return;
      }

      const { data: librarianData } = await supabase
        .from('librarians')
        .select('email')
        .eq('email', user.email)
        .maybeSingle();

      if (!librarianData) {
        console.warn("Unauthorized: Students cannot access the librarian dashboard.");
        navigate('/student-map');
        return;
      }

      fetchDesks();
    };

    verifyAdmin();
  }, [user, authLoading, navigate]);

  // Sync state and Realtime listener
  const fetchDesks = async () => {
    try {
      const { data, error } = await supabase
        .from('seats')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setDesks(data);
      }
      setAppLoading(false);
    } catch (err) {
      console.error(err);
      setAppLoading(false);
    }
  };

  useEffect(() => {
    if (appLoading) return;

    const logEvent = (log) => {
      const time = new Date().toLocaleTimeString();
      setLogs(prev => [{ time, ...log }, ...prev]);
    };

    const channel = supabase
      .channel('public:seats')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'seats' }, (payload) => {
        const updatedDesk = payload.new;
        const previousDesk = desksRef.current.find(d => d.id === updatedDesk.id);

        // 1. Process Emergency Alert Trigger
        if (updatedDesk.alert_message && (!previousDesk || updatedDesk.alert_message !== previousDesk.alert_message)) {
          showToast(
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', color: 'var(--occ)' }}>
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" style={{ flexShrink: 0, marginTop: '2px' }}>
                <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"></path>
              </svg>
              <div>
                <b style={{ fontSize: '1.05rem' }}>EMERGENCY: Desk #{updatedDesk.id}</b><br />
                <span style={{ color: '#fca5a5' }}>{updatedDesk.alert_message}</span>
              </div>
            </div>,
            10000,
            'alert'
          );

          logEvent({
            type: 'alert',
            deskId: updatedDesk.id,
            message: updatedDesk.alert_message
          });

          // Reset the database field immediately so it clears out
          supabase
            .from('seats')
            .update({ alert_message: null })
            .eq('id', updatedDesk.id)
            .then();
        }

        // 2. Process Standard Status Changes
        if (previousDesk && previousDesk.state !== updatedDesk.state) {
          logEvent({
            type: 'status_change',
            deskId: updatedDesk.id,
            userEmail: updatedDesk.user_email,
            state: updatedDesk.state
          });
        }

        // 3. Update State
        setDesks(prev => prev.map(d => d.id === updatedDesk.id ? updatedDesk : d));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appLoading, showToast]);

  // Elapsed / Sweep Calculation helpers
  const getCronDetails = (desk) => {
    if (!desk.last_updated) return { elapsed: 'Unknown', countdown: 'N/A' };

    const lastUpdated = new Date(desk.last_updated);
    const now = new Date();
    const elapsedMins = Math.floor((now - lastUpdated) / 60000);

    let timeLimit = 0;
    let nextAction = '';
    let color = '#94a3b8';

    if (desk.state === 'occupied') {
      timeLimit = 120;
      nextAction = 'Prompt';
    } else if (desk.state === 'away') {
      timeLimit = 20;
      nextAction = 'Abandon';
      color = '#f59e0b';
    } else if (desk.state === 'prompted') {
      timeLimit = 5;
      nextAction = 'Abandon';
      color = 'var(--occ)';
    } else if (desk.state === 'abandoned') {
      return {
        elapsed: elapsedMins < 60 ? `${elapsedMins}m` : `${Math.floor(elapsedMins / 60)}h ${elapsedMins % 60}m`,
        countdown: <span style={{ color: '#8b5cf6' }}>Waiting for clear</span>
      };
    }

    const remaining = timeLimit - elapsedMins;
    const elapsedStr = elapsedMins < 60 ? `${elapsedMins}m` : `${Math.floor(elapsedMins / 60)}h ${elapsedMins % 60}m`;

    let countdownNode;
    if (remaining <= 0) {
      countdownNode = <span style={{ color: 'var(--occ)' }}>Cron sweeping soon...</span>;
    } else if (remaining < 60) {
      countdownNode = <span style={{ color: color }}>{remaining}m until {nextAction}</span>;
    } else {
      countdownNode = <span style={{ color: color }}>{Math.floor(remaining / 60)}h {remaining % 60}m until {nextAction}</span>;
    }

    return { elapsed: elapsedStr, countdown: countdownNode };
  };

  // State Counts
  const stats = { free: 0, occupied: 0, away: 0, abandoned: 0 };
  desks.forEach(d => {
    if (d.state === 'free') stats.free++;
    else if (d.state === 'occupied' || d.state === 'prompted') stats.occupied++;
    else if (d.state === 'away') stats.away++;
    else if (d.state === 'abandoned') stats.abandoned++;
  });

  // Active sessions sorted
  const activeSessions = desks.filter(d => d.state !== 'free');
  activeSessions.sort((a, b) => {
    const order = { prompted: 1, away: 2, abandoned: 3, occupied: 4 };
    if (order[a.state] !== order[b.state]) return order[a.state] - order[b.state];
    return new Date(a.last_updated) - new Date(b.last_updated);
  });

  // Poller to trigger timer updates on active sessions list
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 15000); // refresh time displays every 15 seconds
    return () => clearInterval(timer);
  }, []);

  // Admin Controls (Release Abandoned seats)
  const clearAbandoned = async () => {
    showToast('Checking for abandoned desks...');
    try {
      const { data, error } = await supabase
        .from('seats')
        .update({
          state: 'free',
          user_id: null,
          user_email: null,
          last_updated: new Date().toISOString()
        })
        .eq('state', 'abandoned')
        .select();

      if (error) throw error;

      const count = data ? data.length : 0;
      
      const time = new Date().toLocaleTimeString();
      if (count === 0) {
        showToast('No abandoned desks to clear.');
      } else {
        setLogs(prev => [
          {
            time,
            type: 'system',
            message: `Admin action: Swept and released ${count} abandoned desk(s).`
          },
          ...prev
        ]);
        showToast({
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          ),
          message: `${count} desk(s) freed.`
        });
        fetchDesks();
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to database.');
    }
  };

  const handleDeskClick = (id) => {
    const d = desks.find(x => x.id === id);
    if (!d) return;

    if (d.state === 'free') {
      showToast(
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="#10b981" strokeWidth="2.5" fill="none">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <div>
            <b>Desk #{id}</b><br />Currently Free
          </div>
        </div>,
        2500
      );
    } else {
      const email = d.user_email || 'Unknown User';
      const elapsed = getCronDetails(d).elapsed;
      const stateColor = `var(--${d.state === 'prompted' ? 'occ' : d.state === 'abandoned' ? 'abd' : d.state})`;

      showToast(
        <div style={{ textAlign: 'left', lineHeight: 1.6 }}>
          <b style={{ fontSize: '1.05rem' }}>Desk #{id}</b> -{' '}
          <span style={{ color: stateColor, fontWeight: 'bold' }}>{d.state.toUpperCase()}</span>
          <br />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            {email}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Status changed: {elapsed} ago
          </div>
        </div>,
        6000
      );
    }
  };

  const openOnboarding = () => setShowOnboarding(true);
  const closeOnboarding = () => setShowOnboarding(false);

  return (
    <>
      {appLoading && (
        <div id="loader">
          <div className="spinner-ring"></div>
          <div className="loader-text">SYNCING LEDGER...</div>
        </div>
      )}

      {/* Render 3D Canvas */}
      {!appLoading && (
        <Library3DMap
          desks={desks}
          onDeskClick={handleDeskClick}
        />
      )}

      <div id="ui">
        {/* Topbar */}
        <div className="topbar">
          <div className="brand">Desk<span>Guard</span></div>
          <div className="vtab">Librarian Admin</div>

          <div className="right-controls">
            <button className="help-chip" onClick={openOnboarding} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              Admin Guide
            </button>
            <button className="logout-chip" onClick={handleLogout} type="button">Logout</button>
          </div>
        </div>

        {/* Side Panels */}
        <div className="panels">
          {/* Left Panel: Active Sessions list */}
          <div className="panel left">
            <div className="ph">Active Sessions</div>
            <p className="info" style={{ marginBottom: '1rem' }}>Live overview of occupied desks and upcoming server cron events.</p>
            
            <div className="session-list" id="session-list">
              {activeSessions.length === 0 ? (
                <div className="empty-state">No active sessions. All desks are free.</div>
              ) : (
                activeSessions.map(d => {
                  const details = getCronDetails(d);
                  const borderColor = `var(--${d.state === 'prompted' ? 'occ' : d.state === 'abandoned' ? 'abd' : d.state})`;
                  const stateLabel = d.state === 'prompted' ? 'PROMPTED' : d.state.toUpperCase();
                  const email = d.user_email || 'Unknown User';

                  return (
                    <div key={d.id} className="session-item" style={{ borderLeftColor: borderColor }}>
                      <div className="si-header">
                        <div className="si-desk">Desk #{d.id}</div>
                        <div className="si-state" style={{ background: `${borderColor}33`, color: borderColor }}>
                          {stateLabel}
                        </div>
                      </div>
                      <div className="si-email">
                        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        {email}
                      </div>
                      <div className="si-time">
                        <div>Time in state: {details.elapsed}</div>
                        <div className="si-countdown">{details.countdown}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Server stats & slog console */}
          <div className="panel right">
            <div className="ph">Server Dashboard</div>
            <p className="info" style={{ marginBottom: '.65rem' }}>Server-side PostgreSQL background workers automatically sweep and enforce timer policies.</p>
            
            <div className="stat-grid">
              <div className="stat-box">
                <div className="stat-v" id="s-occ-n" style={{ color: 'var(--occ)' }}>{stats.occupied}</div>
                <div className="stat-l">Occupied</div>
              </div>
              <div className="stat-box">
                <div className="stat-v" id="s-aw-n" style={{ color: 'var(--away)' }}>{stats.away}</div>
                <div className="stat-l">Away</div>
              </div>
              <div className="stat-box">
                <div className="stat-v" id="s-fr-n" style={{ color: 'var(--free)' }}>{stats.free}</div>
                <div className="stat-l">Free</div>
              </div>
              <div className="stat-box">
                <div className="stat-v" id="s-ab-n" style={{ color: 'var(--abd)' }}>{stats.abandoned}</div>
                <div className="stat-l">Abandoned</div>
              </div>
            </div>
            
            <div className="ph" style={{ fontSize: '.85rem', marginTop: '.5rem' }}>Live Event Logs</div>
            
            <div className="slog" id="slog">
              {logs.map((log, index) => {
                if (log.type === 'alert') {
                  return (
                    <div key={index} className="le">
                      [{log.time}]{' '}
                      <span style={{ color: 'var(--occ)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none">
                          <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        ALERT Desk #{log.deskId}:
                      </span>{' '}
                      {log.message}
                    </div>
                  );
                }
                if (log.type === 'status_change') {
                  return (
                    <div key={index} className="le">
                      [{log.time}] Desk <span className="desk">#{log.deskId}</span>
                      {log.userEmail ? ` (${log.userEmail})` : ''} changed to{' '}
                      <span className="state" style={{ color: `var(--${log.state === 'prompted' ? 'occ' : log.state})` }}>
                        {log.state.toUpperCase()}
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={index} className="le">
                    [{log.time}] {log.message}
                  </div>
                );
              })}
            </div>
            
            <button className="btn btn-red" onClick={clearAbandoned} style={{ marginTop: '.85rem' }}>
              Clear All Abandoned Desks
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="legend">
          <div className="li"><div className="dot" style={{ background: 'var(--free)' }}></div>Free</div>
          <div className="li"><div className="dot" style={{ background: 'var(--occ)' }}></div>Occupied</div>
          <div className="li"><div className="dot" style={{ background: 'var(--away)' }}></div>Away</div>
          <div className="li"><div className="dot" style={{ background: 'var(--abd)' }}></div>Abandoned</div>
        </div>
      </div>

      {/* --- ADMIN GUIDE MODAL --- */}
      {showOnboarding && (
        <div className="modal-overlay-translucent" onClick={closeOnboarding}>
          <div className="onboarding-card" onClick={e => e.stopPropagation()}>
            <div className="onboard-top">
              <div>
                <div className="onboard-kicker">Admin Mode</div>
                <div className="onboard-title">Librarian Floor Control</div>
                <div className="onboard-copy">Monitor who is checked in, spot abandoned desks, and clear them when needed so the room stays available.</div>
              </div>
              <button className="close-btn" onClick={closeOnboarding} type="button" aria-label="Close">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="onboard-steps">
              <div className="onboard-step">
                <div className="onboard-num">1</div>
                <div>
                  <h4>Review the desk map</h4>
                  <p>Green desks are free, red desks are occupied, yellow desks are away, and purple desks are abandoned.</p>
                </div>
              </div>
              <div className="onboard-step">
                <div className="onboard-num">2</div>
                <div>
                  <h4>Watch the server logs</h4>
                  <p>Use the dashboard to see exactly when PostgreSQL background workers auto-expire desks.</p>
                </div>
              </div>
              <div className="onboard-step">
                <div className="onboard-num">3</div>
                <div>
                  <h4>Clear abandoned desks</h4>
                  <p>When desks turn purple, verify they are empty, then click 'Clear All' to release them back to students.</p>
                </div>
              </div>
            </div>
            <div className="onboard-actions">
              <button className="btn-blue-small" onClick={closeOnboarding}>Acknowledge</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default LibrarianDashboardPage;
