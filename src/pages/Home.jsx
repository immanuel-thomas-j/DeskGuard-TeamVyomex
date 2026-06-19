import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export const Home = () => {
  const { user, isLibrarian } = useAuth();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [logs, setLogs] = useState([
    { text: `[${new Date().toLocaleTimeString()}] SYSTEM: DeskGuard sweep-agent-daemon initialized.`, type: 'system' },
    { text: `[${new Date().toLocaleTimeString()}] CRON: Verifying 48 desk status entries in ledger...`, type: 'info' },
    { text: `[${new Date().toLocaleTimeString()}] SWEEP: Checked Desks 01-15. Heartbeats active.`, type: 'success' },
  ]);
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes countdown
  const terminalRef = useRef(null);
  const eventIndexRef = useRef(0);
  
  const workspacePath = isLibrarian ? '/library-map' : '/student-map';

  // Timer Countdown Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 180 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Mock Terminal Log Effect
  useEffect(() => {
    const logInterval = setInterval(() => {
      const timeStr = new Date().toLocaleTimeString();
      const mockEvents = [
        { text: `CRON: Initiating automated presence audit...`, type: 'info' },
        { text: `LEDGER: Desks 16-30 checked. All heartbeats active.`, type: 'success' },
        { text: `WARN: Desk #14 has been AWAY for 18 minutes. Grace period ending.`, type: 'warn' },
        { text: `SWEEP: Release threshold exceeded for Desk #07. Reclaiming...`, type: 'system' },
        { text: `LEDGER: Desk #07 state set to FREE. Table row unlocked.`, type: 'success' },
        { text: `ALARM: Handshake lost on Desk #33. Retrying ping...`, type: 'warn' },
        { text: `LEDGER: Desk #33 state set to AWAY. 20m grace period started.`, type: 'info' },
        { text: `INFO: Sweep complete. 47 active seats verified, 1 seat reclaimed.`, type: 'success' },
        { text: `SYSTEM: Syncing database status with local spatial client...`, type: 'system' },
        { text: `INFO: Check-in tokens refreshed for active students.`, type: 'info' },
      ];
      
      const eventIndex = eventIndexRef.current;
      const event = mockEvents[eventIndex];
      
      setLogs((prevLogs) => {
        const updated = [...prevLogs, { text: `[${timeStr}] ${event.text}`, type: event.type }];
        if (updated.length > 20) {
          updated.shift();
        }
        return updated;
      });
      
      eventIndexRef.current = (eventIndex + 1) % mockEvents.length;
    }, 4500);

    return () => clearInterval(logInterval);
  }, []);

  // Auto-scroll Terminal body
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <>
      <div className="ambient-glow"></div>
      <Navbar />

      <header className="hero">
        <div className="hero-container">
          <div className="hero-left">
            <div className="hero-badge animate-fade-up delay-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
              REAL-TIME LEDGER DEMO
            </div>
            <h1 className="animate-fade-up delay-2">Fair seat access for<br />modern libraries.</h1>
            <p className="animate-fade-up delay-3">Track desk occupancy in real time, stop hoarding, and release unused seats automatically so students can study fairly.</p>

            {!user ? (
              // STATE 1: LOGGED OUT HERO
              <div className="hero-actions animate-fade-up delay-4" id="hero-logged-out">
                <Link to="/signin" className="btn-primary hero-btn">
                  Deploy Workspace
                  <div className="btn-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14"></path>
                      <path d="m12 5 7 7-7 7"></path>
                    </svg>
                  </div>
                </Link>
                <a href="#architecture" onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' });
                }} className="btn-outline hero-btn">
                  Explore Architecture
                </a>
              </div>
            ) : (
              // STATE 2: LOGGED IN HERO
              <div className="hero-actions animate-fade-up delay-4" id="hero-logged-in">
                <Link to={workspacePath} className="btn-primary hero-btn">
                  Open Workspace
                  <div className="btn-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon>
                      <line x1="9" y1="3" x2="9" y2="18"></line>
                      <line x1="15" y1="6" x2="15" y2="21"></line>
                    </svg>
                  </div>
                </Link>
                <a href="#architecture" onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' });
                }} className="btn-outline hero-btn">
                  View Architecture
                </a>
              </div>
            )}
          </div>

          <div className="hero-right animate-fade-up delay-3">
            <div className="hero-dashboard">
              {/* Metrics Section */}
              <div className="metrics-row">
                <div className="metric-panel">
                  <span className="metric-label">Sweep Daemon</span>
                  <span className="metric-value">
                    <span className="status-dot-glowing"></span>
                    ACTIVE
                  </span>
                </div>
                <div className="metric-panel">
                  <span className="metric-label">Next Sweep</span>
                  <span className="metric-value" style={{ color: '#60a5fa' }}>{formatTime(timeLeft)}</span>
                </div>
                <div className="metric-panel">
                  <span className="metric-label">Ledger Sync</span>
                  <span className="metric-value" style={{ color: '#34d399' }}>98.4%</span>
                </div>
              </div>

              {/* Terminal Mockup */}
              <div className="mock-terminal">
                <div className="terminal-header">
                  <div className="terminal-buttons">
                    <span className="terminal-btn close"></span>
                    <span className="terminal-btn minimize"></span>
                    <span className="terminal-btn maximize"></span>
                  </div>
                  <span className="terminal-title">sweep-agent-daemon.sh</span>
                  <span className="terminal-badge">LIVE LEDGER</span>
                </div>
                <div className="terminal-body" ref={terminalRef}>
                  {logs.map((log, idx) => (
                    <div key={idx} className={`terminal-line ${log.type}`}>
                      {log.text}
                    </div>
                  ))}
                  <div className="terminal-cursor"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section id="architecture" className="section">
        <div className="section-header">
          <h2>System Architecture</h2>
          <p>Built for scale, engineered for fairness. DeskGuard utilizes robust logic to ensure maximum resource availability.</p>
        </div>
        <div className="diagram-shell" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px' }}>
          {!imageLoaded && (
            <div className="spinner-ring" style={{ margin: '2rem 0' }}></div>
          )}
          <img 
            src="/architecture.png" 
            alt="DeskGuard architecture mindmap showing frontend, backend, and role flows" 
            onLoad={() => setImageLoaded(true)}
            style={{
              opacity: imageLoaded ? 1 : 0,
              transition: 'opacity 0.8s ease',
              display: imageLoaded ? 'block' : 'none'
            }}
          />
          {imageLoaded && (
            <div className="diagram-caption">DeskGuard architecture mindmap</div>
          )}
        </div>
        <div className="grid-3">
          <div className="glass-card">
            <div className="icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
            <h3>Real-Time Spatial Map</h3>
            <p>A high-performance WebGL 3D digital twin of your library floor. Students can instantly visualize available collaborative pods and quiet zones before they even arrive.</p>
          </div>
          <div className="glass-card">
            <div className="icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
            <h3>Automated Sweep Policies</h3>
            <p>Background server cron jobs constantly monitor active sessions. Desks abandoned for over 20 minutes are automatically cleared and released back into the available pool.</p>
          </div>
          <div className="glass-card">
            <div className="icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <h3>Fair-Use Enforcements</h3>
            <p>Interactive "Still Here?" prompts require active verification for long study sessions. Integrated QR simulation ensures physical presence is required to claim a workspace.</p>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--bg-dark)' }}>
        <div className="section-header">
          <h2>How it Works</h2>
          <p>A seamless, logic-driven lifecycle from reservation to release.</p>
        </div>
        <div className="grid-4">
          <div className="step-card">
            <div className="step-number">01</div>
            <div className="step-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <h4>Locate Workspace</h4>
            <p>Students access the 3D map to view live floor capacity. Green indicators highlight free desks across different library zones.</p>
          </div>
          <div className="step-card">
            <div className="step-number">02</div>
            <div className="step-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </div>
            <h4>Scan & Check-In</h4>
            <p>Upon arriving at the physical desk, the student scans the QR code. The system locks the desk and updates the spatial ledger to "Occupied".</p>
          </div>
          <div className="step-card">
            <div className="step-number">03</div>
            <div className="step-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <h4>Pause Session</h4>
            <p>Need a break? Students trigger the "Away" state. The backend timer allows exactly 20 minutes before flagging the desk for review.</p>
          </div>
          <div className="step-card">
            <div className="step-number">04</div>
            <div className="step-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6"></path>
                <path d="M3 12a9 9 0 1 0 2.63-6.37L21 8"></path>
              </svg>
            </div>
            <h4>Auto-Release</h4>
            <p>If the Away timer expires, or if the student ignores the 2-hour presence check, the system automatically marks the desk as "Abandoned" and frees it.</p>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
};
export default Home;
