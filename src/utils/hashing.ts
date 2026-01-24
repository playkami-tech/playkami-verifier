/**
 * Hashing utilities for Playkami Provably Fair Pack Opening Verifier
 * CRITICAL: These functions MUST match backend exactly
 * Reference: playkami-be/src/Services/ProvablyFairPackOpening.ts
 */

import { ethers } from 'ethers';
import Decimal from 'decimal.js';
import { PackTypeOddsRange } from '@/types';

/**
 * Compute snapshot hash from card pool and odds
 * MUST MATCH: ProvablyFairPackOpening.ts:75-87
 *
 * @param cardPoolSnapshot - Array of available card IDs
 * @param oddsSnapshot - Pack odds configuration
 * @returns Keccak256 hash of ABI-encoded data
 */
export function computeSnapshotHash(
  cardPoolSnapshot: number[],
  oddsSnapshot: PackTypeOddsRange[]
): string {
  // CRITICAL: Use canonical JSON with specific key order
  // This MUST match backend exactly: ['min', 'max', 'prob', 'rarity']
  const canonicalOdds = JSON.stringify(oddsSnapshot, ['min', 'max', 'prob', 'rarity']);

  // ABI encode: (uint256[], string)
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ['uint256[]', 'string'],
    [cardPoolSnapshot, canonicalOdds]
  );

  return ethers.keccak256(encoded);
}

/**
 * Generate randomness for a specific card in the pack
 * MUST MATCH: ProvablyFairPackOpening.ts:92-99
 *
 * @param serverSeed - Server seed (bytes32)
 * @param clientSeed - Client seed (bytes32)
 * @param cardIndex - Card index (0 to cardsPerPack-1)
 * @returns Keccak256 hash of concatenated seeds + index
 */
export function generateCardRandomness(
  serverSeed: string,
  clientSeed: string,
  cardIndex: number
): string {
  return ethers.keccak256(
    ethers.solidityPacked(
      ['bytes32', 'bytes32', 'uint256'],
      [serverSeed, clientSeed, cardIndex]
    )
  );
}

/**
 * Select odds tier using cumulative probability
 * MUST MATCH: ProvablyFairPackOpening.ts:116-150
 *
 * Uses BigInt arithmetic with Decimal.js for precision
 * CRITICAL: Normalizes randomness to totalProb * precision (not just precision!)
 *
 * @param randomness - Randomness hash (bytes32)
 * @param odds - Pack odds configuration
 * @param precision - Precision for probability calculations (default: 1,000,000)
 * @param useInclusive - Use inclusive (<=) comparison for old packs (default: false)
 * @returns Index of selected tier
 */
export function selectOddsTier(
  randomness: string,
  odds: PackTypeOddsRange[],
  precision: number = 1000000,
  useInclusive: boolean = false
): number {
  // Calculate total probability sum using Decimal for precision
  const totalProb = odds.reduce((sum, tier) => sum + tier.prob, 0);

  // Convert to BigInt via string to avoid Number precision loss
  const maxRangeStr = new Decimal(totalProb).times(precision).round().toFixed(0);
  const maxRange = BigInt(maxRangeStr);

  // Convert randomness to BigInt in range [0, maxRange)
  const randomBigInt = BigInt(randomness);
  const randomValue = randomBigInt % maxRange;

  // Build cumulative probability ranges using BigInt
  let cumulative = BigInt(0);
  for (let i = 0; i < odds.length; i++) {
    const tier = odds[i];
    // Convert tier.prob to BigInt via string to avoid Number precision loss
    const tierWeightStr = new Decimal(tier.prob).times(precision).round().toFixed(0);
    const tierWeight = BigInt(tierWeightStr);
    cumulative += tierWeight;

    // Use inclusive (<=) for old packs, exclusive (<) for new packs
    const tierMatches = useInclusive
      ? randomValue <= cumulative
      : randomValue < cumulative;

    if (tierMatches) {
      return i;
    }
  }

  // Fallback to last tier (handles edge case where randomValue === maxRange due to rounding)
  return odds.length - 1;
}

/**
 * Verify server seed hash
 *
 * @param serverSeed - Revealed server seed
 * @param hashedServerSeed - Committed hash from blockchain event
 * @returns True if hash matches
 */
export function verifyServerSeedHash(
  serverSeed: string,
  hashedServerSeed: string
): boolean {
  const computed = ethers.keccak256(serverSeed);
  return computed.toLowerCase() === hashedServerSeed.toLowerCase();
}
