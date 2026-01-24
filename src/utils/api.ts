/**
 * Backend API client for Playkami Verifier
 */

import {
  PackVerificationData,
  VerifierBackendAPI,
  PackHistoryResponse
} from '@/types';

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8084';

/**
 * Get pack verification data from backend
 *
 * @param packId - Pack ID to verify
 * @param userAddress - User address that owns the pack
 * @param apiUrl - Optional API base URL
 * @returns Pack verification data
 */
export async function getPackVerificationData(
  packId: number,
  userAddress: string,
  apiUrl: string = DEFAULT_API_URL
): Promise<PackVerificationData> {
  const params = new URLSearchParams({
    user_address: userAddress
  });

  const response = await fetch(`${apiUrl}/verifier/pack/${packId}?${params}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `Failed to fetch pack ${packId}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Failed to get pack data');
  }

  return result.data;
}

/**
 * Get packs with same snapshot hash for a specific user
 *
 * @param snapshotHash - Snapshot hash to query
 * @param userAddress - User address to filter packs
 * @param limit - Max number of packs to return
 * @param apiUrl - Optional API base URL
 * @returns List of packs with this snapshot for the user
 */
export async function getPacksBySnapshot(
  snapshotHash: string,
  userAddress: string,
  limit: number = 50,
  apiUrl: string = DEFAULT_API_URL
): Promise<{
  snapshotHash: string;
  totalPacks: number;
  packs: Array<{
    packId: number;
    userAddress: string;
    openedAt: number;
    txHash: string;
  }>;
}> {
  const params = new URLSearchParams({
    user_address: userAddress,
    limit: limit.toString()
  });

  const response = await fetch(
    `${apiUrl}/verifier/snapshot/${snapshotHash}/packs?${params}`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'Failed to fetch packs by snapshot');
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Failed to get packs by snapshot');
  }

  return result.data;
}

/**
 * Get card prices at time of pack opening
 *
 * @param cardIds - Card IDs to get prices for
 * @param openedAt - Pack opening timestamp
 * @param apiUrl - Optional API base URL
 * @returns Array of card prices
 */
export async function getCardPrices(
  cardIds: number[],
  openedAt: number,
  apiUrl: string = DEFAULT_API_URL
): Promise<Array<{ id: number; price: string }>> {
  const response = await fetch(`${apiUrl}/verifier/cards/prices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ cardIds, openedAt })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'Failed to fetch card prices');
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Failed to get card prices');
  }

  return result.data.cards;
}

/**
 * Get pack history with pagination
 *
 * @param page - Page number (0-indexed)
 * @param limit - Packs per page
 * @param userAddress - User address (required)
 * @param apiUrl - Optional API base URL
 * @returns Pack history response
 */
export async function getPackHistory(
  page: number = 0,
  limit: number = 50,
  userAddress: string,
  apiUrl: string = DEFAULT_API_URL
): Promise<PackHistoryResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    user_address: userAddress
  });

  const response = await fetch(`${apiUrl}/verifier/packs?${params}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'Failed to fetch pack history');
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Failed to get pack history');
  }

  return result;
}

/**
 * Create API client with configured base URL
 *
 * @param apiUrl - Base URL for API requests
 * @returns API client with bound functions
 */
export function createAPIClient(apiUrl: string = DEFAULT_API_URL): VerifierBackendAPI {
  return {
    getPackVerificationData: (packId: number, userAddress: string) => getPackVerificationData(packId, userAddress, apiUrl),
    getPacksBySnapshot: (snapshotHash: string, userAddress: string, limit?: number) =>
      getPacksBySnapshot(snapshotHash, userAddress, limit, apiUrl),
    getCardPrices: (cardIds: number[], openedAt: number) =>
      getCardPrices(cardIds, openedAt, apiUrl),
    getPackHistory: (page: number, limit: number, userAddress: string) =>
      getPackHistory(page, limit, userAddress, apiUrl)
  };
}
