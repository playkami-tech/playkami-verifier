'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useVerifier } from '@/providers/VerifierProvider';
import { truncateHash } from '@/utils/blockchain';

export function CardVerification() {
  const { verificationResult, packData, expandAll } = useVerifier();
  const [openCards, setOpenCards] = React.useState<string[]>([]);

  if (!verificationResult || !verificationResult.tierSelections || !packData) return null;

  const { tierSelections } = verificationResult;

  // Update open cards when expandAll changes
  React.useEffect(() => {
    if (expandAll) {
      // Open all cards
      const allCardValues = tierSelections.map((_, index) => `card-${index}`);
      setOpenCards(allCardValues);
    } else {
      // Close all cards
      setOpenCards([]);
    }
  }, [expandAll, tierSelections]);

  // Map card IDs to card details from packData
  const getCardDetails = (cardId: number) => {
    return packData.cards?.find((c: any) => c.cardId === cardId);
  };

  // Truncate long fingerprint text
  const truncateFingerprint = (text: string, maxLength = 50) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Check if this is a legacy pack (opened before sorting fix on Jan 22, 2026)
  // Commit 66b5de7 was deployed at 1769067139 (2026-01-22 15:32:19 SGT/UTC+8)
  const SORTING_FIX_TIMESTAMP = 1769067139;
  const isLegacyPack = packData.blockTimestamp < SORTING_FIX_TIMESTAMP;

  // Calculate tier ranges for visualization
  const getTierRanges = () => {
    if (!packData.oddsSnapshot) return [];

    const PRECISION = packData.precision || 1000000;
    let cumulative = 0;

    return packData.oddsSnapshot.map((tier: any) => {
      const start = cumulative;
      cumulative += tier.prob * PRECISION;
      const end = cumulative;

      return {
        rarity: tier.rarity,
        probability: tier.prob,
        priceMin: tier.min,
        priceMax: tier.max,
        start: Math.floor(start),
        end: Math.floor(end)
      };
    });
  };

  // Calculate max range (totalProb * precision) for correct tier value calculation
  const getMaxRange = () => {
    if (!packData.oddsSnapshot) return packData.precision || 1000000;
    const PRECISION = packData.precision || 1000000;
    const totalProb = packData.oddsSnapshot.reduce((sum: number, tier: any) => sum + tier.prob, 0);
    return Math.floor(totalProb * PRECISION);
  };

  // Calculate which cards belong to each tier based on price ranges
  const getCardsByTier = () => {
    if (!packData.cardPoolSnapshot || !packData.oddsSnapshot || !packData.cardPoolPrices) {
      console.log('[CardVerification] Missing data:', {
        hasCardPoolSnapshot: !!packData.cardPoolSnapshot,
        hasOddsSnapshot: !!packData.oddsSnapshot,
        hasCardPoolPrices: !!packData.cardPoolPrices,
        cardPoolPricesKeys: packData.cardPoolPrices ? Object.keys(packData.cardPoolPrices).length : 0
      });
      return [];
    }

    return packData.oddsSnapshot.map((tier: any) => {
      const cardsInTier = packData.cardPoolSnapshot.filter((cardId: number) => {
        const priceStr = packData.cardPoolPrices?.[cardId];
        if (!priceStr) return false;

        // Convert from USDC wei (6 decimals) to dollars
        const price = parseFloat(priceStr) / 1e6;
        return price >= tier.min && price < tier.max;
      });

      return {
        rarity: tier.rarity,
        priceMin: tier.min,
        priceMax: tier.max,
        probability: tier.prob,
        cardCount: cardsInTier.length,
        cardIds: cardsInTier
      };
    });
  };

  const tierRanges = getTierRanges();
  const cardsByTier = getCardsByTier();
  const maxRange = getMaxRange();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Card-by-Card Verification</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion
          type="multiple"
          value={openCards}
          onValueChange={setOpenCards}
          className="w-full"
        >
          {tierSelections.map((tier, index) => {
            const cardDetails = getCardDetails(tier.expectedTokenId);
            const cardName = cardDetails?.name || `Card #${tier.expectedTokenId}`;
            const cardImage = cardDetails?.imageUrl;

            return (
              <AccordionItem key={index} value={`card-${index}`}>
                <AccordionTrigger>
                  <div className="flex items-center gap-3 flex-1">
                    {cardImage && (
                      <img
                        src={cardImage}
                        alt={cardName}
                        className="w-10 h-10 rounded object-cover"
                      />
                    )}
                    <span className="font-semibold">{cardName}</span>
                    {tier.matches ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <Badge variant="outline">{tier.tierRarity}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {cardImage && (
                      <div className="flex justify-center">
                        <img
                          src={cardImage}
                          alt={cardName}
                          className="w-48 h-auto rounded-lg border shadow-sm"
                        />
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Randomness Generation */}
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-semibold text-muted-foreground">Card Index (Nonce)</p>
                            <p className="font-mono">{tier.cardIndex}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Position in pack (0-{packData.cardsPerPack - 1})
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-muted-foreground">Randomness Generated</p>
                            <p className="font-mono text-xs">{truncateHash(tier.randomness, 16)}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              keccak256(server + client + {tier.cardIndex})
                            </p>
                          </div>
                        </div>

                        {/* Randomness Breakdown */}
                        <details open={expandAll} className="text-xs bg-slate-50 dark:bg-slate-900 p-2 rounded border">
                          <summary className="cursor-pointer font-semibold text-muted-foreground">
                            How randomness is derived and used
                          </summary>
                          <div className="mt-2 space-y-2 font-mono">
                            <div>
                              <p className="text-muted-foreground">Full randomness value:</p>
                              <p className="break-all bg-white dark:bg-slate-800 p-1 rounded">{tier.randomness}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">As decimal (BigInt):</p>
                              <p className="break-all bg-white dark:bg-slate-800 p-1 rounded">{BigInt(tier.randomness).toString()}</p>
                            </div>
                            <div className="pt-2 border-t">
                              <p className="font-semibold text-slate-900 dark:text-slate-50">Step 1: Select Tier</p>
                              <p className="text-muted-foreground mt-1">
                                tierValue = {BigInt(tier.randomness).toString()} % {maxRange.toLocaleString()} = {Number(BigInt(tier.randomness) % BigInt(maxRange)).toLocaleString()}
                              </p>

                              {/* Show all tier ranges */}
                              <div className="mt-2 space-y-1">
                                <p className="text-muted-foreground font-semibold">Available Tiers & Ranges:</p>
                                {tierRanges.map((range, idx) => {
                                  const tierValue = Number(BigInt(tier.randomness) % BigInt(maxRange));
                                  const isSelected = tierValue >= range.start && tierValue < range.end;
                                  const tierCards = cardsByTier[idx];

                                  return (
                                    <div
                                      key={idx}
                                      className={`p-2 rounded ${
                                        isSelected
                                          ? 'bg-green-100 dark:bg-green-900 border-2 border-green-500'
                                          : 'bg-white dark:bg-slate-800'
                                      }`}
                                    >
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="font-semibold">
                                          {isSelected && '✓ '}{range.rarity}
                                        </span>
                                        <span className="text-muted-foreground">
                                          {(range.probability * 100).toFixed(1)}%
                                        </span>
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Probability Range: {range.start.toLocaleString()} - {range.end.toLocaleString()}
                                        {isSelected && (
                                          <span className="ml-2 text-green-700 dark:text-green-400 font-semibold">
                                            ← {tierValue.toLocaleString()} falls here
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        <span className="font-semibold">Price Range:</span> ${range.priceMin} - ${range.priceMax}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        <span className="font-semibold">Cards in tier:</span> {tierCards?.cardCount || 0} / {packData.cardPoolSnapshot?.length || 0}
                                      </div>
                                      {isSelected && tierCards && packData.cardPoolPrices && (
                                        <details className="mt-2 bg-white dark:bg-slate-950 p-2 rounded">
                                          <summary className="cursor-pointer text-xs font-semibold text-green-700 dark:text-green-400">
                                            Show how these {tierCards.cardCount} cards were filtered
                                          </summary>
                                          <div className="mt-2 space-y-2">
                                            <p className="text-xs text-muted-foreground">
                                              Out of {packData.cardPoolSnapshot?.length || 0} total cards in the pool, these {tierCards.cardCount} cards have prices between ${range.priceMin} and ${range.priceMax}:
                                            </p>
                                            <div className="max-h-32 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-2 rounded border">
                                              <div className="space-y-1">
                                                {tierCards.cardIds.slice(0, 20).map((cardId: number) => {
                                                  const priceWei = packData.cardPoolPrices?.[cardId] || '0';
                                                  const priceDollars = parseFloat(priceWei) / 1e6;
                                                  return (
                                                    <div key={cardId} className="text-xs flex justify-between">
                                                      <span className="font-mono">Card #{cardId}</span>
                                                      <span className="text-muted-foreground">
                                                        ${priceDollars.toFixed(2)}
                                                      </span>
                                                    </div>
                                                  );
                                                })}
                                                {tierCards.cardIds.length > 20 && (
                                                  <p className="text-xs text-muted-foreground italic">
                                                    ... and {tierCards.cardIds.length - 20} more cards
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground pt-2 border-t">
                                              The other {(packData.cardPoolSnapshot?.length || 0) - tierCards.cardCount} cards belong to different tiers because their prices fall outside the ${range.priceMin}-${range.priceMax} range.
                                            </p>
                                          </div>
                                        </details>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="pt-2 border-t">
                              <p className="font-semibold text-slate-900 dark:text-slate-50">Step 2: Select Card</p>
                              <p className="text-muted-foreground mt-1">
                                cardIndex = {BigInt(tier.randomness).toString()} % {tier.availableCardsInTier} = {tier.selectedCardIndex}
                              </p>
                              <p className="text-muted-foreground">
                                Card at position {tier.selectedCardIndex} → Card ID {tier.selectedCardId}
                              </p>
                            </div>
                          </div>
                        </details>
                      </div>

                      {/* Tier Selection */}
                      <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
                        <div>
                          <p className="font-semibold text-muted-foreground">Tier Selected</p>
                          <p>{tier.tierRarity} ({(tier.tierProbability * 100).toFixed(1)}% chance)</p>
                        </div>
                        <div>
                          <p className="font-semibold text-muted-foreground">Available Cards in Tier</p>
                          <p>{tier.availableCardsInTier} cards</p>
                        </div>
                      </div>

                      {/* Card Selection Visualization */}
                      {tier.availableCardIdsInTier && tier.availableCardIdsInTier.length > 0 && (
                        <div className="border-t pt-4">
                          <details open={expandAll} className="text-sm">
                            <summary className="cursor-pointer font-semibold text-muted-foreground mb-2">
                              Selection Process: Index {tier.selectedCardIndex} → Card ID {tier.selectedCardId}
                            </summary>
                            <div className="mt-2 space-y-2">
                              <p className="text-xs text-muted-foreground">
                                Formula: selectedIndex = randomness % {tier.availableCardsInTier} = {tier.selectedCardIndex}
                              </p>
                              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded border max-h-32 overflow-y-auto">
                                <p className="text-xs font-semibold mb-1">Available Card IDs in {tier.tierRarity} tier (sorted):</p>
                                <div className="flex flex-wrap gap-1">
                                  {tier.availableCardIdsInTier.map((cardId, idx) => (
                                    <span
                                      key={idx}
                                      className={`inline-block px-2 py-1 rounded text-xs font-mono ${
                                        idx === tier.selectedCardIndex
                                          ? 'bg-green-200 dark:bg-green-800 font-bold border-2 border-green-500'
                                          : 'bg-slate-200 dark:bg-slate-700'
                                      }`}
                                      title={idx === tier.selectedCardIndex ? `Selected at index ${idx}` : `Index ${idx}`}
                                    >
                                      {cardId}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </details>
                        </div>
                      )}

                      {/* Card IDs */}
                      <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
                        <div>
                          <p className="font-semibold text-muted-foreground">Expected Card ID</p>
                          <p className="font-mono">{tier.expectedTokenId}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-muted-foreground">Actual Card ID</p>
                          <p className="font-mono">{tier.actualTokenId || 'N/A'}</p>
                        </div>
                      </div>

                      {/* Proof of Integrity */}
                      {cardDetails?.fingerprint && (
                        <div className="border-t pt-4">
                          <details open={expandAll} className="text-sm">
                            <summary className="cursor-pointer font-semibold text-muted-foreground mb-2">
                              Proof of Integrity (Card Authenticity)
                            </summary>
                            <div className="mt-2 space-y-3 text-xs">
                              <div>
                                <p className="font-semibold mb-1">Fingerprint (Human-readable card description):</p>
                                <p className="font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded border break-all">
                                  {cardDetails.fingerprint}
                                </p>
                              </div>
                              {cardDetails.salt && (
                                <div>
                                  <p className="font-semibold mb-1">Salt:</p>
                                  <p className="font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded border break-all">
                                    {cardDetails.salt}
                                  </p>
                                </div>
                              )}
                              {cardDetails.tokenId && (
                                <div>
                                  <p className="font-semibold mb-1">Token ID (NFT):</p>
                                  <p className="font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded border break-all">
                                    {cardDetails.tokenId}
                                  </p>
                                </div>
                              )}
                              <p className="text-muted-foreground pt-2 border-t">
                                <strong>Verification:</strong> This proves that Token ID = keccak256(fingerprint + salt).
                                You can independently verify the card authenticity using these values.
                              </p>
                            </div>
                          </details>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t">
                      <p className="text-sm">
                        {tier.matches ? (
                          <span className="text-green-600 font-semibold flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Expected and actual card IDs match
                          </span>
                        ) : isLegacyPack ? (
                          <div className="space-y-1">
                            <span className="text-amber-600 font-semibold flex items-center gap-2">
                              <XCircle className="h-4 w-4" />
                              Legacy pack (opened before Jan 22, 2026)
                            </span>
                            <p className="text-xs text-muted-foreground">
                              This pack was opened before a deterministic sorting fix was deployed.
                              Card selection was provably fair, but verification uses updated logic.
                            </p>
                          </div>
                        ) : (
                          <span className="text-red-600 font-semibold flex items-center gap-2">
                            <XCircle className="h-4 w-4" />
                            Card ID mismatch detected
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
