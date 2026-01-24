/**
 * Type definitions for Playkami Provably Fair Pack Opening Verifier
 */

export interface PackTypeOddsRange {
  min: number;
  max: number;
  prob: number;
  rarity: string;
}

export interface PackOpenedEvent {
  packId: number;
  user: string;
  clientSeed: string;
  hashedServerSeed: string;
  snapshotHash: string;
  cardIds: string[]; // Changed from number[] to string[] to handle large BigInt values
  txHash: string;
  blockNumber: string;
  blockTimestamp: number;
}

export interface VerificationInput {
  packId: number;
  serverSeed: string;
  clientSeed: string;
  cardPoolSnapshot: number[];
  oddsSnapshot: PackTypeOddsRange[];
  cardsPerPack: number;
  cardPrices: Map<number, string>;
  precision?: number;
  timestamp?: number; // Unix timestamp - used to determine if sorting should be applied
  useSorting?: boolean; // Whether to sort cards before selection (determined by timestamp)
}

export interface TierSelection {
  cardIndex: number;
  randomness: string;
  tierIndex: number;
  tierRarity: string;
  tierProbability: number;
  availableCardsInTier: number;
  availableCardIdsInTier: number[];
  selectedCardIndex: number;
  selectedCardId: number;
  expectedTokenId: number;
  actualTokenId?: number;
  matches: boolean;
}

export interface VerificationResult {
  success: boolean;
  selectedCardIds: number[];
  tierSelections: TierSelection[];
  message?: string;
}

export interface VerificationSteps {
  serverSeedHashVerified: boolean;
  snapshotHashVerified: boolean;
  cardSelectionVerified: boolean;
  hasSnapshotHash: boolean; // Flag for older packs
}

export interface PackVerificationData {
  packId: number;
  user: string;
  clientSeed: string;
  serverSeed: string;
  cardPoolSnapshot: number[];
  oddsSnapshot: PackTypeOddsRange[];
  cardIds: number[]; // Actual card IDs for verification (use these, not tokenIds!)
  tokenIds: string[]; // Token IDs (BigInt strings) - for display only, NOT for card selection verification
  txHash: string;
  blockNumber: string;
  blockTimestamp: number;
  cardsPerPack: number;
  hasSnapshotHash: boolean;
  precision?: number; // Odds precision used for tier selection
  cardPoolPrices?: Record<number, string>; // Prices for all cards in pool (for tier filtering UI)
  cards: CardDisplayData[];
}

export interface CardDisplayData {
  tokenId: string;
  cardId: number;
  name?: string;
  rarity?: string;
  price: string;
  imageUrl?: string;
  cardIndex?: number; // Nonce used in randomness generation (position in pack 0-4)
  proofOfIntegrity?: string; // Hex proof for card authenticity
  fingerprint?: string; // Human-readable card description for verification
  salt?: string; // Salt used to generate tokenId from fingerprint
}

export interface PackHistoryItem {
  packId: number;
  userAddress: string;
  cardsPerPack: number;
  totalPrice: string;
  openedAt: number;
  txHash: string;
  status: string;
}

export interface PackHistoryResponse {
  success: boolean;
  data: {
    packs: PackHistoryItem[];
    totalCount: number;
    page: number;
    totalPages: number;
  };
}

export interface VerifierBackendAPI {
  getPackVerificationData: (packId: number, userAddress: string) => Promise<PackVerificationData>;
  getPacksBySnapshot: (snapshotHash: string, userAddress: string, limit?: number) => Promise<{
    snapshotHash: string;
    totalPacks: number;
    packs: Array<{
      packId: number;
      userAddress: string;
      openedAt: number;
      txHash: string;
    }>;
  }>;
  getCardPrices: (cardIds: number[], openedAt: number) => Promise<Array<{
    id: number;
    price: string;
  }>>;
  getPackHistory: (page: number, limit: number, userAddress: string) => Promise<PackHistoryResponse>;
}
