'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, CheckCircle2 } from 'lucide-react';
import { getPackVerificationData } from '@/utils/api';
import { PackVerificationData } from '@/types';
import { ethers } from 'ethers';
import { useVerification } from '@/hooks/useVerification';
import { useVerifier } from '@/providers/VerifierProvider';

interface PackDetailsProps {
  packId: number;
  userAddress: string;
  onVerify: () => void;
}

/**
 * Format price to show at least 2 decimals, but more if needed
 */
function formatPrice(priceWei: string): string {
  const value = Number(ethers.formatUnits(priceWei || '0', 6));

  // Format with up to 6 decimals (USDC precision), remove trailing zeros
  const formatted = value.toFixed(6).replace(/(\.\d*?)0+$/, '$1');

  // If no decimal part or less than 2 decimals, use exactly 2 decimals
  const decimalPart = formatted.split('.')[1];
  if (!decimalPart || decimalPart.length < 2) {
    return value.toFixed(2);
  }

  return formatted;
}

export function PackDetails({ packId, userAddress, onVerify }: PackDetailsProps) {
  const [packData, setPackData] = useState<PackVerificationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { verifyPack } = useVerification();
  const { reset, setPackId, isVerifying } = useVerifier();

  useEffect(() => {
    const fetchPackData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getPackVerificationData(packId, userAddress);
        setPackData(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load pack details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPackData();
  }, [packId, userAddress]);

  const handleVerify = async () => {
    reset();
    setPackId(packId.toString());

    // Switch to verify tab
    onVerify();

    try {
      await verifyPack(packId, userAddress);
      // Scroll to top to show results
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Verification error:', error);
    }
  };

  const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://monad-testnet.socialscan.io';

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pack Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pack Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            Error loading pack details: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!packData) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Pack #{packData.packId} Details</CardTitle>
          <Button onClick={handleVerify} disabled={isVerifying}>
            {isVerifying ? 'Verifying...' : 'Verify This Pack'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 rounded font-semibold">
                Opened
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pack ID</p>
              <p className="font-mono text-lg font-bold">{packData.packId}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Opened At</p>
            <p className="text-sm">{new Date(packData.blockTimestamp * 1000).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              Block #{packData.blockNumber}
            </p>
          </div>
        </div>

        {/* Blockchain Info */}
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-sm font-semibold">Blockchain Information</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">User Address</p>
              <a
                href={`${explorerUrl}/address/${packData.user}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                {packData.user}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Transaction Hash</p>
              <a
                href={`${explorerUrl}/tx/${packData.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                {packData.txHash}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Pack Stats */}
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-sm font-semibold">Pack Statistics</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Cards per Pack</p>
              <p className="text-2xl font-bold">{packData.cardsPerPack}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Cards in Pool</p>
              <p className="text-2xl font-bold">{packData.cardPoolSnapshot?.length || 0}</p>
            </div>
          </div>
        </div>

        {/* Cards Revealed */}
        {packData.cards && packData.cards.length > 0 && (
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold">Cards Revealed ({packData.cards.length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {packData.cards.map((card, index) => (
                <div key={index} className="relative group">
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt={card.name || `Card ${card.cardId}`}
                      className="w-full aspect-[2/3] object-cover rounded-lg border shadow-sm"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-slate-200 dark:bg-slate-700 rounded-lg border flex items-center justify-center">
                      <span className="font-mono text-xs">{card.cardId}</span>
                    </div>
                  )}
                  <div className="mt-1 text-xs">
                    <p className="font-semibold truncate">{card.name || `Card #${card.cardId}`}</p>
                    {card.rarity && (
                      <p className="text-muted-foreground capitalize">{card.rarity}</p>
                    )}
                    <p className="font-mono text-muted-foreground">
                      ${formatPrice(card.price || '0')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Call to Action */}
        <div className="border-t pt-4">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100 mb-3">
              <strong>Ready to verify?</strong> Click the button above to run a complete provably fair verification of this pack opening.
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              The verification will check: server seed hash, snapshot hash (if available), and card selection against blockchain data.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
