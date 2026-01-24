/**
 * Verification logic for Playkami Provably Fair Pack Opening
 * Reference: playkami-be/src/Services/ProvablyFairPackOpening.ts
 */

import { ethers } from 'ethers';
import {
  VerificationInput,
  VerificationResult,
  TierSelection,
  PackTypeOddsRange
} from '@/types';
import {
  generateCardRandomness,
  selectOddsTier
} from './hashing';

/**
 * Replay pack opening to verify card selection
 * MUST MATCH: ProvablyFairPackOpening.ts:1372-1504 (replayPackOpening)
 * and lines 396-463 (selectCardsFromPool)
 *
 * @param input - Verification input data
 * @returns Verification result with card selections
 */
export async function replayPackOpening(
  input: VerificationInput
): Promise<VerificationResult> {
  try {
    const {
      serverSeed,
      clientSeed,
      cardPoolSnapshot,
      oddsSnapshot,
      cardsPerPack,
      cardPrices,
      precision = 1000000, // Default to 1 million if not provided (for backwards compatibility)
      timestamp,
      useSorting: useSortingOverride
    } = input;

    // Determine if sorting should be used based on timestamp
    // If useSorting is explicitly provided, use that (for testing/override)
    // Otherwise, determine from timestamp
    const useSorting = true;

    // Determine if inclusive logic should be used (for packs before Dec 10, 2025 15:06:52 UTC)
    // Pack 139 (1765379211) was the last pack using inclusive logic
    // Pack 140 (1765381572) was the first pack using exclusive logic
    const INCLUSIVE_LOGIC_CUTOFF = parseInt(process.env.NEXT_PUBLIC_INCLUSIVE_LOGIC_CUTOFF || '1765379212');
    const useInclusiveLogic = timestamp !== undefined && timestamp < INCLUSIVE_LOGIC_CUTOFF;

    // Validate inputs
    if (!serverSeed || !clientSeed) {
      return {
        success: false,
        selectedCardIds: [],
        tierSelections: [],
        message: 'Missing server seed or client seed'
      };
    }

    if (!cardPoolSnapshot || cardPoolSnapshot.length === 0) {
      return {
        success: false,
        selectedCardIds: [],
        tierSelections: [],
        message: 'Card pool snapshot is empty'
      };
    }

    if (!oddsSnapshot || oddsSnapshot.length === 0) {
      return {
        success: false,
        selectedCardIds: [],
        tierSelections: [],
        message: 'Odds snapshot is empty'
      };
    }

    // Create a mutable copy of the card pool
    let availableCards = [...cardPoolSnapshot];
    const selectedCardIds: number[] = [];
    const tierSelections: TierSelection[] = [];

    // Select cards one by one
    for (let cardIndex = 0; cardIndex < cardsPerPack; cardIndex++) {
      if (availableCards.length === 0) {
        return {
          success: false,
          selectedCardIds,
          tierSelections,
          message: `No cards available for card index ${cardIndex}`
        };
      }

      // Step 1: Generate randomness for this card
      const randomness = generateCardRandomness(serverSeed, clientSeed, cardIndex);

      // Step 2: Select tier using odds
      const tierIndex = selectOddsTier(randomness, oddsSnapshot, precision, useInclusiveLogic);
      const selectedTier = oddsSnapshot[tierIndex];

      // Step 3: Filter cards by tier's price range
      const tierCards = filterCardsByTier(
        availableCards,
        selectedTier,
        cardPrices,
        useInclusiveLogic
      );

      if (tierCards.length === 0) {
        return {
          success: false,
          selectedCardIds,
          tierSelections,
          message: `No cards available in tier ${selectedTier.rarity} (${selectedTier.min}-${selectedTier.max}) for card index ${cardIndex}`
        };
      }

      // CRITICAL: Sort tierCards by card ID for deterministic selection
      // Must match the sorting in backend ProvablyFairPackOpening.ts:1463-1468
      // Only sort if useSorting is true (packs after Jan 22, 2026)
      if (useSorting) {
        tierCards.sort((a, b) => a - b);
      }

      // Step 4: Select card within tier using randomness
      const randomnessBigInt = BigInt(randomness);
      const selectedCardIndex = Number(randomnessBigInt % BigInt(tierCards.length));
      const selectedCardId = tierCards[selectedCardIndex];

      // Record tier selection
      tierSelections.push({
        cardIndex,
        randomness,
        tierIndex,
        tierRarity: selectedTier.rarity,
        tierProbability: selectedTier.prob,
        availableCardsInTier: tierCards.length,
        availableCardIdsInTier: [...tierCards], // Save for visualization
        selectedCardIndex,
        selectedCardId,
        expectedTokenId: selectedCardId, // Will be updated with actual comparison
        matches: false // Will be updated after comparison
      });

      selectedCardIds.push(selectedCardId);

      // Step 5: Remove selected card from pool (no duplicates)
      const indexInAvailable = availableCards.indexOf(selectedCardId);
      if (indexInAvailable !== -1) {
        availableCards.splice(indexInAvailable, 1);
      }
    }

    return {
      success: true,
      selectedCardIds,
      tierSelections
    };
  } catch (error: any) {
    console.error('[replayPackOpening] Error:', error);
    return {
      success: false,
      selectedCardIds: [],
      tierSelections: [],
      message: error.message || 'Unknown error during replay'
    };
  }
}

/**
 * Filter cards by tier's price range
 * Reference: ProvablyFairPackOpening.ts:418-426
 *
 * @param cardIds - Available card IDs
 * @param tier - Tier configuration with min/max prices (in dollars)
 * @param cardPrices - Map of card ID to price (USDC as BIGINT string with 6 decimals)
 * @param useInclusive - Use inclusive (<=) comparison for old packs (default: false)
 * @returns Filtered array of card IDs in this tier
 */
function filterCardsByTier(
  cardIds: number[],
  tier: PackTypeOddsRange,
  cardPrices: Map<number, string>,
  useInclusive: boolean = false
): number[] {
  // Convert tier price range to BIGINT (6 decimals) to match backend logic exactly
  // This avoids floating-point precision issues
  const minPrice = BigInt(tier.min * 1000000);
  const maxPrice = BigInt(tier.max * 1000000);

  return cardIds.filter(cardId => {
    const priceStr = cardPrices.get(cardId);
    if (!priceStr) {
      console.warn(`[filterCardsByTier] No price found for card ${cardId}`);
      return false;
    }

    // Parse price as BigInt (USDC has 6 decimals)
    const cardPrice = BigInt(priceStr);

    // Use inclusive (<=) for old packs, exclusive (<) for new packs
    if (useInclusive) {
      return cardPrice >= minPrice && cardPrice <= maxPrice;
    } else {
      return cardPrice >= minPrice && cardPrice < maxPrice;
    }
  });
}

/**
 * Compare expected and actual card IDs
 *
 * @param expectedIds - Card IDs from replay
 * @param actualCardIds - Actual card IDs from backend (NOT token IDs!)
 * @param tierSelections - Tier selections to update with comparison results
 * @returns True if all cards match
 */
export function compareCardSelections(
  expectedIds: number[],
  actualCardIds: number[],
  tierSelections: TierSelection[]
): boolean {
  if (expectedIds.length !== actualCardIds.length) {
    console.error('[compareCardSelections] Length mismatch:', {
      expected: expectedIds.length,
      actual: actualCardIds.length
    });
    return false;
  }

  let allMatch = true;

  for (let i = 0; i < expectedIds.length; i++) {
    const expectedId = expectedIds[i];
    const actualCardId = actualCardIds[i];

    const matches = expectedId === actualCardId;
    if (!matches) {
      allMatch = false;
      console.error(`[compareCardSelections] Mismatch at index ${i}:`, {
        expected: expectedId,
        actual: actualCardId
      });
    }

    // Update tier selection with comparison result
    if (tierSelections[i]) {
      tierSelections[i].actualTokenId = actualCardId;
      tierSelections[i].matches = matches;
    }
  }

  return allMatch;
}
