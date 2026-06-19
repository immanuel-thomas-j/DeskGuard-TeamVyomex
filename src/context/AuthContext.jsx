import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

const AuthContext = createContext({
  user: null,
  session: null,
  profile: null,
  isLibrarian: false,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmailAndPassword: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {}
});

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLibrarian, setIsLibrarian] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkLibrarianAndProfile = async (currentUser) => {
    if (!currentUser) {
      setIsLibrarian(false);
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      // 1. Check if email belongs to a Librarian
      const { data: librarianData, error: libError } = await supabase
        .from('librarians')
        .select('email')
        .eq('email', currentUser.email)
        .maybeSingle();

      if (libError) {
        console.error("Error checking librarian status:", libError);
      }

      if (librarianData) {
        setIsLibrarian(true);
        setProfile(null);
        setLoading(false);
        return;
      }

      // 2. Fetch student profile
      const { data: profileData, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (profError) {
        console.error("Error fetching student profile:", profError);
      }

      setProfile(profileData || null);
      setIsLibrarian(false);
    } catch (e) {
      console.error("Auth state synchronization error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if mock admin is active
    const isMockAdmin = localStorage.getItem('deskguard_mock_admin') === 'true';
    if (isMockAdmin) {
      const mockUser = {
        id: 'mock-admin-id-12345',
        email: 'admin@deskguard.com',
        user_metadata: { full_name: 'System Admin' }
      };
      setUser(mockUser);
      setIsLibrarian(true);
      setProfile(null);
      setLoading(false);
      return;
    }

    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      const currentUser = initialSession?.user || null;
      setUser(currentUser);
      
      if (initialSession) {
        localStorage.setItem('deskguard_auth_token', 'true');
        checkLibrarianAndProfile(currentUser);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      // Ignore auth change triggers if mock admin is logged in
      if (localStorage.getItem('deskguard_mock_admin') === 'true') return;

      setSession(currentSession);
      const currentUser = currentSession?.user || null;
      setUser(currentUser);

      if (currentSession) {
        localStorage.setItem('deskguard_auth_token', 'true');
        checkLibrarianAndProfile(currentUser);
      } else {
        localStorage.removeItem('deskguard_auth_token');
        setIsLibrarian(false);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async (redirectTo) => {
    // Clear mock session if Google SSO is triggered
    localStorage.removeItem('deskguard_mock_admin');
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo || window.location.origin + '/signin'
      }
    });
    if (error) throw error;
  };

  const signInWithEmailAndPassword = async (email, password) => {
    // Check for mock admin credential bypass first
    if (email === 'admin@deskguard.com' && password === 'admin123') {
      const mockUser = {
        id: 'mock-admin-id-12345',
        email: 'admin@deskguard.com',
        user_metadata: { full_name: 'System Admin' }
      };
      localStorage.setItem('deskguard_mock_admin', 'true');
      localStorage.setItem('deskguard_auth_token', 'true');
      setUser(mockUser);
      setIsLibrarian(true);
      setProfile(null);
      setLoading(false);
      return { user: mockUser };
    }

    // Otherwise standard Supabase auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    return data;
  };

  const signOut = async () => {
    const isMock = localStorage.getItem('deskguard_mock_admin') === 'true';
    if (isMock) {
      localStorage.removeItem('deskguard_mock_admin');
    } else {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('deskguard_auth_token');
    setIsLibrarian(false);
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  const refreshProfile = async () => {
    if (!user || localStorage.getItem('deskguard_mock_admin') === 'true') return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    setProfile(data || null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      isLibrarian,
      loading,
      signInWithGoogle,
      signInWithEmailAndPassword,
      signOut,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
