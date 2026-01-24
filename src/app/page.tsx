'use client';

import { useState } from 'react';
import { VerificationInput } from '@/components/VerificationInput';
import { VerificationResult } from '@/components/VerificationResult';
import { CardVerification } from '@/components/CardVerification';
import { PackHistoryTable } from '@/components/PackHistoryTable';
import { PackDetails } from '@/components/PackDetails';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useVerifier } from '@/providers/VerifierProvider';
import { XCircle } from 'lucide-react';

export default function Home() {
  const { isLoading, error, verificationSteps } = useVerifier();
  const [activeTab, setActiveTab] = useState('history');
  const [selectedPackId, setSelectedPackId] = useState<number | null>(null);
  const [selectedUserAddress, setSelectedUserAddress] = useState<string>('');
  const [userAddressFilter, setUserAddressFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(0);
  const enablePackDetails = process.env.NEXT_PUBLIC_ENABLE_PACK_DETAILS === 'true';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-3">
            Playkami Verifier
          </h1>
          {/* <p className="text-lg text-slate-600 dark:text-slate-400">
            Independently verify the fairness of your pack openings on Monad blockchain
          </p> */}
        </div>

        {/* How It Works - Always Visible */}
        <div className="mb-8 p-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-50 text-center">
            How This Verifier Works
          </h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-bold text-xs">
                  1
                </span>
                <strong className="text-slate-900 dark:text-slate-50">Dual-Seed Randomness</strong>
              </div>
              <p className="text-slate-600 dark:text-slate-400 ml-8">
                <strong>Client Seed</strong> (generated client-side) + <strong>Server Seed</strong> (committed before opening) = Your unique randomness. Verifies the server couldn't manipulate the outcome.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-bold text-xs">
                  2
                </span>
                <strong className="text-slate-900 dark:text-slate-50">Snapshot Hash Verification</strong>
              </div>
              <p className="text-slate-600 dark:text-slate-400 ml-8">
                Proves the card pool and odds were locked at opening time. The "game board" was frozen on-chain before any cards were drawn.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-bold text-xs">
                  3
                </span>
                <strong className="text-slate-900 dark:text-slate-50">Card Selection Replay</strong>
              </div>
              <p className="text-slate-600 dark:text-slate-400 ml-8">
                Recomputes which cards should be selected using the same algorithm. Verifies the exact same cards would be drawn given the same seeds.
              </p>
            </div>
          </div>
          <p className="text-xs mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-center text-slate-600 dark:text-slate-400">
            All verification is done independently by querying the Monad blockchain directly.
            This verifier is open-source and can be run locally to ensure complete trustlessness.
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full max-w-md mx-auto ${enablePackDetails ? 'grid-cols-3' : 'grid-cols-2'} mb-8`}>
            <TabsTrigger value="history">Pack History</TabsTrigger>
            {enablePackDetails && (
              <TabsTrigger value="details" disabled={!selectedPackId}>
                Pack Details
              </TabsTrigger>
            )}
            <TabsTrigger value="verify">Verify Pack</TabsTrigger>
          </TabsList>

          {/* Pack History Tab */}
          <TabsContent value="history">
            <PackHistoryTable
              userAddress={userAddressFilter}
              onUserAddressChange={setUserAddressFilter}
              page={currentPage}
              onPageChange={setCurrentPage}
              onVerifyPack={() => setActiveTab('verify')}
              onSelectPack={(packId, userAddress) => {
                setSelectedPackId(packId);
                setSelectedUserAddress(userAddress);
                if (enablePackDetails) {
                  setActiveTab('details');
                }
              }}
            />
          </TabsContent>

          {/* Pack Details Tab */}
          {enablePackDetails && (
            <TabsContent value="details">
              {selectedPackId && selectedUserAddress ? (
                <PackDetails
                  packId={selectedPackId}
                  userAddress={selectedUserAddress}
                  onVerify={() => setActiveTab('verify')}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Select a pack from history to view details
                </div>
              )}
            </TabsContent>
          )}

          {/* Verify Pack Tab */}
          <TabsContent value="verify" className="space-y-6">
            {/* Verification Input */}
            <VerificationInput />

            {/* Loading State */}
            {isLoading && (
              <div className="space-y-6">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-96 w-full" />
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <Alert variant="destructive">
                <XCircle className="h-5 w-5" />
                <AlertDescription>
                  <strong>Verification Error:</strong> {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Results */}
            {!isLoading && verificationSteps && (
              <div className="space-y-6">
                <VerificationResult />
                <CardVerification />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
