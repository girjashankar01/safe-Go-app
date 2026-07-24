import React, { createContext, useContext, useEffect, useState } from 'react';
import ProfileService, { UserProfile, ProfileState } from '../services/ProfileService';

export interface MissingFields {
  bloodGroup: boolean;
  medicalInfo: boolean;
  name: boolean;
  dob: boolean;
  totalMissing: number;
}

export interface SafetyIdentityContextValue {
  profile: UserProfile;
  status: ProfileState;
  missingFields: MissingFields;
}

const SafetyIdentityContext = createContext<SafetyIdentityContextValue | null>(null);

export function SafetyIdentityProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(ProfileService.getProfile());
  const [status, setStatus] = useState<ProfileState>(ProfileService.getStatus());

  useEffect(() => {
    const unsubscribe = ProfileService.subscribe((newProfile, newStatus) => {
      setProfile(newProfile);
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const p = profile.personal;
  const m = profile.medical;

  const missingBloodGroup = !p.bloodGroup;
  const missingMedicalInfo = (!m.medicalConditions && !m.allergies && !m.medications);
  const missingName = !p.fullName || p.fullName.trim().length === 0;
  const missingDob = !p.dateOfBirth;

  const totalMissing = 
    (missingBloodGroup ? 1 : 0) +
    (missingMedicalInfo ? 1 : 0) +
    (missingName ? 1 : 0) +
    (missingDob ? 1 : 0);

  const missingFields: MissingFields = {
    bloodGroup: missingBloodGroup,
    medicalInfo: missingMedicalInfo,
    name: missingName,
    dob: missingDob,
    totalMissing,
  };

  return (
    <SafetyIdentityContext.Provider value={{ profile, status, missingFields }}>
      {children}
    </SafetyIdentityContext.Provider>
  );
}

export function useSafetyIdentity() {
  const context = useContext(SafetyIdentityContext);
  if (!context) {
    throw new Error('useSafetyIdentity must be used within a SafetyIdentityProvider');
  }
  return context;
}
