'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePackHistory } from '@/hooks/usePackHistory';
import { useVerifier } from '@/providers/VerifierProvider';
import { useVerification } from '@/hooks/useVerification';
import { ethers } from 'ethers';

interface PackHistoryTableProps {
  onVerifyPack?: () => void;
  onSelectPack?: (packId: number, userAddress: string) => void;
  userAddress?: string;
  onUserAddressChange?: (address: string) => void;
  page?: number;
  onPageChange?: (page: number) => void;
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

export function PackHistoryTable({ onVerifyPack, onSelectPack, userAddress = '', onUserAddressChange, page: propPage = 0, onPageChange }: PackHistoryTableProps) {
  const [localPage, setLocalPage] = useState(propPage);
  const [localUserAddress, setLocalUserAddress] = useState(userAddress);
  const { packs, totalPages, isLoading, error } = usePackHistory(localPage, 50, userAddress || undefined);
  const { reset, setPackId } = useVerifier();
  const { verifyPack } = useVerification();

  // Sync local state with props when they change
  useEffect(() => {
    setLocalUserAddress(userAddress);
  }, [userAddress]);

  useEffect(() => {
    setLocalPage(propPage);
  }, [propPage]);

  const handleVerifyPack = async (packId: number, userAddress: string) => {
    // Set pack ID and run verification immediately
    reset();
    setPackId(packId.toString());

    // Switch to verify tab
    if (onVerifyPack) {
      onVerifyPack();
    }

    try {
      await verifyPack(packId, userAddress);
      // Scroll to top to show results
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Verification error:', error);
    }
  };

  const handleApplyFilter = () => {
    if (localUserAddress.trim()) {
      if (onUserAddressChange) {
        onUserAddressChange(localUserAddress.trim());
      }
      setLocalPage(0);
      if (onPageChange) {
        onPageChange(0);
      }
    }
  };

  const handleClearFilter = () => {
    setLocalUserAddress('');
    if (onUserAddressChange) {
      onUserAddressChange('');
    }
    setLocalPage(0);
    if (onPageChange) {
      onPageChange(0);
    }
  };

  const handlePageChange = (newPage: number) => {
    setLocalPage(newPage);
    if (onPageChange) {
      onPageChange(newPage);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pack History</CardTitle>
        <div className="flex gap-2 mt-4">
          <Input
            placeholder="Enter user address to view packs"
            value={localUserAddress}
            onChange={(e) => setLocalUserAddress(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleApplyFilter} variant="outline" disabled={!localUserAddress.trim()}>
            Apply
          </Button>
          {userAddress && (
            <Button onClick={handleClearFilter} variant="ghost">
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!userAddress ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg mb-2">Enter a user address above to view pack history</p>
            <p className="text-sm">You must provide a wallet address to query packs</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-600">
            Error loading pack history: {error}
          </div>
        ) : packs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No packs found for this address
          </div>
        ) : (
          <>
            {/* Pagination - Top */}
            <div className="flex justify-end items-center gap-4 mb-4">
              <span className="text-sm text-muted-foreground">
                Page {localPage + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handlePageChange(Math.max(0, localPage - 1))}
                  disabled={localPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handlePageChange(Math.min(totalPages - 1, localPage + 1))}
                  disabled={localPage >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pack ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Cards</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Opened At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packs.map((pack) => (
                    <TableRow
                      key={pack.packId}
                    >
                      <TableCell className="font-mono">{pack.packId}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {pack.userAddress.slice(0, 6)}...{pack.userAddress.slice(-4)}
                      </TableCell>
                      <TableCell>{pack.cardsPerPack}</TableCell>
                      <TableCell>
                        ${formatPrice(pack.totalPrice || '0')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(pack.openedAt * 1000).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 rounded">
                          {pack.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVerifyPack(pack.packId, pack.userAddress);
                          }}
                        >
                          Verify
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex justify-end items-center gap-4 mt-6">
              <span className="text-sm text-muted-foreground">
                Page {localPage + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handlePageChange(Math.max(0, localPage - 1))}
                  disabled={localPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handlePageChange(Math.min(totalPages - 1, localPage + 1))}
                  disabled={localPage >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
