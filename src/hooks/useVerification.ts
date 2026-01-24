'use client';

/**
 * Main verification hook
 * Orchestrates the entire verification flow
 */

import { useVerifier } from '@/providers/VerifierProvider';
import {
  getPackVerificationData
} from '@/utils/api';
import {
  createProvider,
  queryPackOpenedEvent
} from '@/utils/blockchain';
import {
  computeSnapshotHash,
  verifyServerSeedHash
} from '@/utils/hashing';
import {
  replayPackOpening,
  compareCardSelections
} from '@/utils/verification';
import { VerificationInput } from '@/types';
import { DEFAULT_RPC_URL, DROP_VENDING_MACHINE_ADDRESS, BACKEND_API_URL } from '@/constants';

export function useVerification() {
  const {
    isVerifying,
    setPackData,
    setBlockchainEvent,
    setVerificationResult,
    setVerificationSteps,
    setIsLoading,
    setIsVerifying,
    setError,
    setComputedSnapshotHash
  } = useVerifier();

  /**
   * Verify a pack opening
   *
   * @param packId - Pack ID to verify
   * @param userAddress - User address that owns the pack
   * @param options - Optional configuration
   */
  const verifyPack = async (
    packId: number,
    userAddress: string,
    options?: {
      rpcUrl?: string;
      contractAddress?: string;
      apiUrl?: string;
    }
  ) => {
    setIsVerifying(true);
    setIsLoading(true);
    setError(null);

    const rpcUrl = options?.rpcUrl || DEFAULT_RPC_URL;
    const contractAddress = options?.contractAddress || DROP_VENDING_MACHINE_ADDRESS;
    const apiUrl = options?.apiUrl || BACKEND_API_URL;

    try {
      // Step 1: Get pack data from backend API
      console.log('[useVerification] Step 1: Fetching pack data from backend...');
      const packData = await getPackVerificationData(packId, userAddress, apiUrl);
      setPackData(packData);

      // Step 2: Query blockchain for PackOpened event
      console.log('[useVerification] Step 2: Querying blockchain event...');
      const provider = createProvider(rpcUrl);
      const event = await queryPackOpenedEvent(
        packData.txHash,
        packId,
        provider,
        contractAddress,
        packData.clientSeed // Pass client seed to match correct event in batch txs
      );
      setBlockchainEvent(event);

      // Step 3: Verify server seed hash
      console.log('[useVerification] Step 3: Verifying server seed hash...');
      const serverSeedHashVerified = verifyServerSeedHash(
        packData.serverSeed,
        event.hashedServerSeed
      );

      if (!serverSeedHashVerified) {
        throw new Error('Server seed hash verification failed - seeds do not match!');
      }

      // Step 4: Compute and verify snapshot hash
      console.log('[useVerification] Step 4: Computing snapshot hash...');
      const computed = computeSnapshotHash(
        packData.cardPoolSnapshot,
        packData.oddsSnapshot
      );
      setComputedSnapshotHash(computed);

      // Check if pack has snapshot hash (older packs might not)
      let snapshotHashVerified = false;
      if (packData.hasSnapshotHash) {
        snapshotHashVerified = computed.toLowerCase() === event.snapshotHash.toLowerCase();
        if (!snapshotHashVerified) {
          throw new Error('Snapshot hash verification failed - computed hash does not match on-chain hash!');
        }
      }

      // Step 5: Get card prices for tier filtering
      // CRITICAL: Use prices from pack data that backend already fetched
      // This ensures frontend and backend use the SAME price source
      console.log('[useVerification] Step 5: Using card prices from pack data...');
      const cardPricesMap = new Map(
        Object.entries(packData.cardPoolPrices || {}).map(([id, price]) => [parseInt(id), price])
      );

      // Step 6: Replay pack opening
      console.log('[useVerification] Step 6: Replaying pack opening...');
      const input: VerificationInput = {
        packId,
        serverSeed: packData.serverSeed,
        clientSeed: packData.clientSeed,
        cardPoolSnapshot: packData.cardPoolSnapshot,
        oddsSnapshot: packData.oddsSnapshot,
        cardsPerPack: packData.cardsPerPack,
        cardPrices: cardPricesMap,
        precision: packData.precision,
        timestamp: packData.blockTimestamp // Used to determine if sorting should be applied
      };

      const result = await replayPackOpening(input);
      if (!result.success) {
        throw new Error(result.message || 'Pack opening replay failed');
      }

      // Step 7: Compare expected vs actual card IDs
      console.log('[useVerification] Step 7: Comparing card selections...');
      const cardSelectionVerified = compareCardSelections(
        result.selectedCardIds,
        packData.cardIds,
        result.tierSelections
      );

      setVerificationResult(result);

      // Step 8: Update verification steps
      const steps = {
        serverSeedHashVerified,
        snapshotHashVerified,
        cardSelectionVerified,
        hasSnapshotHash: packData.hasSnapshotHash
      };
      setVerificationSteps(steps);

      // Overall verification success
      const overallSuccess = serverSeedHashVerified && cardSelectionVerified &&
        (packData.hasSnapshotHash ? snapshotHashVerified : true);

      if (!overallSuccess) {
        throw new Error('Verification failed - one or more checks did not pass');
      }

      console.log('[useVerification] ✓ Verification completed successfully!');
    } catch (err: any) {
      console.error('[useVerification] Error:', err);
      setError(err.message || 'Verification failed');
      throw err;
    } finally {
      setIsLoading(false);
      setIsVerifying(false);
    }
  };

  return {
    verifyPack,
    isVerifying
  };
}
