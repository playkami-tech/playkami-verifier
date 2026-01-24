'use client';

/**
 * Verifier Context Provider
 * Manages verification state across components
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  PackVerificationData,
  VerificationResult,
  VerificationSteps,
  PackOpenedEvent
} from '@/types';

interface VerifierContextType {
  // State
  packId: string;
  packData: PackVerificationData | null;
  blockchainEvent: PackOpenedEvent | null;
  verificationResult: VerificationResult | null;
  verificationSteps: VerificationSteps | null;
  isLoading: boolean;
  isVerifying: boolean;
  error: string | null;
  computedSnapshotHash: string | null;
  expandAll: boolean;

  // Actions
  setPackId: (packId: string) => void;
  setPackData: (data: PackVerificationData | null) => void;
  setBlockchainEvent: (event: PackOpenedEvent | null) => void;
  setVerificationResult: (result: VerificationResult | null) => void;
  setVerificationSteps: (steps: VerificationSteps | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsVerifying: (verifying: boolean) => void;
  setError: (error: string | null) => void;
  setComputedSnapshotHash: (hash: string | null) => void;
  setExpandAll: (expand: boolean) => void;
  reset: () => void;
}

const VerifierContext = createContext<VerifierContextType | undefined>(undefined);

export function VerifierProvider({ children }: { children: ReactNode }) {
  const [packId, setPackId] = useState<string>('');
  const [packData, setPackData] = useState<PackVerificationData | null>(null);
  const [blockchainEvent, setBlockchainEvent] = useState<PackOpenedEvent | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verificationSteps, setVerificationSteps] = useState<VerificationSteps | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [computedSnapshotHash, setComputedSnapshotHash] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState<boolean>(false);

  const reset = () => {
    setPackId('');
    setPackData(null);
    setBlockchainEvent(null);
    setVerificationResult(null);
    setVerificationSteps(null);
    setIsLoading(false);
    setIsVerifying(false);
    setError(null);
    setComputedSnapshotHash(null);
    setExpandAll(false);
  };

  const value: VerifierContextType = {
    packId,
    packData,
    blockchainEvent,
    verificationResult,
    verificationSteps,
    isLoading,
    isVerifying,
    error,
    computedSnapshotHash,
    expandAll,
    setPackId,
    setPackData,
    setBlockchainEvent,
    setVerificationResult,
    setVerificationSteps,
    setIsLoading,
    setIsVerifying,
    setError,
    setComputedSnapshotHash,
    setExpandAll,
    reset
  };

  return (
    <VerifierContext.Provider value={value}>
      {children}
    </VerifierContext.Provider>
  );
}

export function useVerifier() {
  const context = useContext(VerifierContext);
  if (context === undefined) {
    throw new Error('useVerifier must be used within a VerifierProvider');
  }
  return context;
}
