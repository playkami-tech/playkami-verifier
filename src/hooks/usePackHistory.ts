'use client';

/**
 * Hook for fetching pack history
 */

import { useState, useEffect } from 'react';
import { getPackHistory } from '@/utils/api';
import { PackHistoryItem } from '@/types';

export function usePackHistory(
  page: number = 0,
  limit: number = 50,
  userAddress?: string
) {
  const [packs, setPacks] = useState<PackHistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!userAddress) {
        setPacks([]);
        setTotalCount(0);
        setTotalPages(0);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await getPackHistory(page, limit, userAddress);
        setPacks(response.data.packs);
        setTotalCount(response.data.totalCount);
        setTotalPages(response.data.totalPages);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch pack history');
        console.error('[usePackHistory] Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [page, limit, userAddress]);

  return {
    packs,
    totalCount,
    totalPages,
    isLoading,
    error
  };
}
