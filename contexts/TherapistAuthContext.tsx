'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface TherapistSession {
  id: string;
  name: string;
  shopId: string;
  shopSlug: string;
  avatarUrl?: string;
}

interface TherapistAuthContextType {
  therapist: TherapistSession | null;
  loading: boolean;
  login: (therapistData: TherapistSession) => void;
  logout: () => void;
}

const TherapistAuthContext = createContext<TherapistAuthContextType>({
  therapist: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export const TherapistAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [therapist, setTherapist] = useState<TherapistSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('therapist_session');
      if (saved) {
        setTherapist(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load therapist session', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (therapistData: TherapistSession) => {
    setTherapist(therapistData);
    localStorage.setItem('therapist_session', JSON.stringify(therapistData));
  };

  const logout = () => {
    setTherapist(null);
    localStorage.removeItem('therapist_session');
  };

  return (
    <TherapistAuthContext.Provider value={{ therapist, loading, login, logout }}>
      {children}
    </TherapistAuthContext.Provider>
  );
};

export const useTherapistAuth = () => useContext(TherapistAuthContext);
