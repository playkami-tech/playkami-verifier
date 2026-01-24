'use client';

import { useState, useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle2, XCircle, AlertTriangle, Copy, Check, ExternalLink, Info } from 'lucide-react';
import { useVerifier } from '@/providers/VerifierProvider';
import { ethers } from 'ethers';

export function VerificationResult() {
  const { verificationSteps, packData, computedSnapshotHash, blockchainEvent, expandAll, setExpandAll } = useVerifier();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Compute hash of revealed server seed
  const computedServerSeedHash = useMemo(() => {
    if (!packData?.serverSeed) return null;
    return ethers.keccak256(packData.serverSeed);
  }, [packData?.serverSeed]);

  // Get expected hash from blockchain event
  const expectedServerSeedHash = blockchainEvent?.hashedServerSeed || null;

  if (!verificationSteps || !packData) return null;

  const {
    serverSeedHashVerified,
    snapshotHashVerified,
    cardSelectionVerified,
    hasSnapshotHash
  } = verificationSteps;

  // Check if this is a legacy pack (opened before sorting fix on Jan 22, 2026)
  // Commit 66b5de7 was deployed at 1769067139 (2026-01-22 15:32:19 SGT/UTC+8)
  const SORTING_FIX_TIMESTAMP = 1769067139;
  const isLegacyPack = packData.blockTimestamp < SORTING_FIX_TIMESTAMP;

  // Determine overall status
  const overallSuccess = serverSeedHashVerified && cardSelectionVerified &&
    (hasSnapshotHash ? snapshotHashVerified : true);

  const isPartiallyVerified = !hasSnapshotHash && serverSeedHashVerified && cardSelectionVerified;

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const truncateHash = (hash: string, start = 10, end = 8) => {
    return `${hash.slice(0, start)}...${hash.slice(-end)}`;
  };

  const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://monad-testnet.socialscan.io';

  return (
    <div className="space-y-6">
      {/* Expand/Collapse All Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpandAll(!expandAll)}
          className="text-xs"
        >
          {expandAll ? 'Collapse All' : 'Expand All'} Details
        </Button>
      </div>

      {/* Overall Status Banner */}
      <Card className="border-2 border-slate-200 dark:border-slate-700">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            {overallSuccess ? (
              <>
                <div className="flex justify-center">
                  <CheckCircle2 className="h-16 w-16 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                    {isPartiallyVerified ? 'Partially Verified' : 'All Checks Passed'}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-2">
                    Your pack opening is {isPartiallyVerified ? 'verified (older pack without snapshot hash)' : 'provably fair and verifiable'}
                  </p>
                </div>
              </>
            ) : isLegacyPack && !cardSelectionVerified && serverSeedHashVerified ? (
              <>
                <div className="flex justify-center">
                  <XCircle className="h-16 w-16 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                    Legacy Pack Detected
                  </h2>
                  <p className="text-amber-600 dark:text-amber-400 mt-2">
                    Pack opened before Jan 22, 2026 - card selection uses legacy algorithm
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Server seed verification passed. Card selection was provably fair, but cannot be verified with current algorithm.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-center">
                  <XCircle className="h-16 w-16 text-red-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-red-900 dark:text-red-100">
                    Verification Failed
                  </h2>
                  <p className="text-red-600 dark:text-red-400 mt-2">
                    One or more verification checks did not pass
                  </p>
                </div>
              </>
            )}

            <div className="text-sm text-slate-600 dark:text-slate-400">
              <p className="font-mono">
                Pack #{packData.packId} • Opened by {truncateHash(packData.user, 8, 6)}
              </p>
              <p>
                {new Date(packData.blockTimestamp * 1000).toLocaleString()} • Block {packData.blockNumber}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* YOUR UNIQUE RANDOMNESS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            YOUR UNIQUE RANDOMNESS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Client Seed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Client Seed <span className="text-xs text-slate-500">(generated client-side)</span>
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(packData.clientSeed, 'client')}
              >
                {copiedField === 'client' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="font-mono text-sm bg-slate-100 dark:bg-slate-800 p-3 rounded border break-all">
              {packData.clientSeed}
            </p>
          </div>

          {/* Server Seed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Server Seed <span className="text-xs text-slate-500">(revealed after opening)</span>
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(packData.serverSeed, 'server')}
              >
                {copiedField === 'server' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="font-mono text-sm bg-slate-100 dark:bg-slate-800 p-3 rounded border break-all">
              {packData.serverSeed}
            </p>

            {/* Server Seed Hash Verification Details */}
            <Accordion type="single" collapsible className="border-none" value={expandAll ? "hash-verification" : undefined}>
              <AccordionItem value="hash-verification" className="border-t">
                <AccordionTrigger className="text-sm hover:no-underline py-2">
                  <div className="flex items-center gap-2">
                    {serverSeedHashVerified ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-green-700 dark:text-green-400">
                          Hash verified: Server couldn't change seed after committing
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-red-700 dark:text-red-400">
                          Hash verification failed
                        </span>
                      </>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Computed Hash (keccak256 of revealed server seed):
                    </p>
                    <p className="font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded border break-all">
                      {computedServerSeedHash || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Expected Hash (committed on-chain before opening):
                    </p>
                    <p className="font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded border break-all">
                      {expectedServerSeedHash || 'N/A'}
                    </p>
                  </div>
                  {serverSeedHashVerified ? (
                    <p className="text-green-700 dark:text-green-400 flex items-center gap-2 pt-2 border-t">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>✓ Hashes match! Server committed to this seed before opening.</span>
                    </p>
                  ) : (
                    <p className="text-red-700 dark:text-red-400 flex items-center gap-2 pt-2 border-t">
                      <XCircle className="h-4 w-4" />
                      <span>✗ Hashes don't match! Potential manipulation detected.</span>
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </CardContent>
      </Card>

      {/* GAME STATE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            GAME STATE
            {hasSnapshotHash && (
              <Badge variant="secondary" className="text-xs">
                <Info className="h-3 w-3 mr-1" />
                Shared with other packs
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasSnapshotHash ? (
            <>
              {/* Snapshot Hash Verification */}
              <div className="space-y-4">
                {/* Computed Hash */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Computed Snapshot Hash
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(computedSnapshotHash || '', 'computed-snapshot')}
                    >
                      {copiedField === 'computed-snapshot' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="font-mono text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded border break-all">
                    {computedSnapshotHash}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Independently calculated from card pool and odds data
                  </p>
                </div>

                {/* Blockchain Hash */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Blockchain Snapshot Hash
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(blockchainEvent?.snapshotHash || '', 'blockchain-snapshot')}
                    >
                      {copiedField === 'blockchain-snapshot' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="font-mono text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded border break-all">
                    {blockchainEvent?.snapshotHash || '0x0000000000000000000000000000000000000000000000000000000000000000'}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Retrieved from PackOpened event on-chain
                  </p>
                </div>

                {/* Verification Result */}
                <div className={`p-3 rounded border ${snapshotHashVerified ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
                  <div className="flex items-center gap-2 text-sm">
                    {snapshotHashVerified ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-700 dark:text-green-400">
                            ✓ Snapshot Hash Verified
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                            Hashes match! Card pool and odds were frozen on-chain at opening time.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-red-600" />
                        <div>
                          <p className="font-semibold text-red-700 dark:text-red-400">
                            ✗ Snapshot Verification Failed
                          </p>
                          <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                            Hashes don't match! The card pool or odds may have been tampered with.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Snapshot Data & Computation */}
              <Accordion type="single" collapsible className="border-none" value={expandAll ? "snapshot-computation" : undefined}>
                <AccordionItem value="snapshot-computation" className="border-t">
                  <AccordionTrigger className="text-sm hover:no-underline">
                    View Snapshot Data & Computation
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                    <p className="text-xs">
                      The snapshot hash is computed by ABI-encoding the card pool and odds, then taking the keccak256 hash.
                    </p>

                    <div className="space-y-3">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-50 mb-1">
                          Card Pool ({packData.cardPoolSnapshot?.length || 0} available cards)
                        </p>
                        <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded border font-mono text-xs break-all max-h-32 overflow-y-auto">
                          [{packData.cardPoolSnapshot?.join(', ')}]
                        </div>
                      </div>

                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-50 mb-1">
                          Odds Snapshot
                        </p>
                        {packData.oddsSnapshot && packData.oddsSnapshot.length > 0 && (
                          <ul className="ml-4 space-y-1 text-xs">
                            {packData.oddsSnapshot.map((tier: any, i: number) => (
                              <li key={i}>
                                <strong>{tier.rarity}:</strong> {((tier.prob || 0) * 100).toFixed(1)}% (${tier.min}-${tier.max})
                              </li>
                            ))}
                          </ul>
                        )}
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer text-blue-600 dark:text-blue-400">
                            Show canonical JSON
                          </summary>
                          <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded border font-mono text-xs break-all mt-1">
                            {JSON.stringify(packData.oddsSnapshot, ['min', 'max', 'prob', 'rarity'])}
                          </div>
                        </details>
                      </div>

                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-50 mb-1">
                          Computation
                        </p>
                        <p className="text-xs">
                          <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">keccak256(abi.encode(cardPool, canonicalOddsJSON))</code>
                        </p>
                      </div>
                    </div>

                    <p className="text-xs pt-3 border-t border-slate-200 dark:border-slate-700">
                      This snapshot was cryptographically locked on-chain at opening time. The hashes above prove
                      that the card pool and odds shown here match what was committed on the blockchain.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

            </>
          ) : (
            <>
              {/* Old Pack Warning */}
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Older Pack (No On-Chain Snapshot Hash)</AlertTitle>
                <AlertDescription>
                  This pack was opened before snapshot hash was added to the contract.
                  We can still show you the card pool and odds that were used, but cannot verify them against an on-chain hash.
                </AlertDescription>
              </Alert>

              {/* Show Computed Hash for Transparency */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Computed Snapshot Hash
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(computedSnapshotHash || '', 'computed-snapshot')}
                  >
                    {copiedField === 'computed-snapshot' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="font-mono text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded border break-all">
                  {computedSnapshotHash}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Calculated from the card pool and odds shown below (not verified on-chain for older packs)
                </p>
              </div>

              {/* Snapshot Data */}
              <Accordion type="single" collapsible className="border-none" value={expandAll ? "snapshot-data" : undefined}>
                <AccordionItem value="snapshot-data" className="border-t">
                  <AccordionTrigger className="text-sm hover:no-underline">
                    View Card Pool & Odds Data
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                    <p className="text-xs">
                      The data below was used for this pack opening. For transparency, we show the exact card pool and odds.
                    </p>

                    <div className="space-y-3">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-50 mb-1">
                          Card Pool ({packData.cardPoolSnapshot?.length || 0} available cards)
                        </p>
                        <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded border font-mono text-xs break-all max-h-32 overflow-y-auto">
                          [{packData.cardPoolSnapshot?.join(', ')}]
                        </div>
                      </div>

                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-50 mb-1">
                          Odds Configuration
                        </p>
                        {packData.oddsSnapshot && (
                          <ul className="space-y-1">
                            {packData.oddsSnapshot.map((tier, index) => (
                              <li key={index} className="text-xs bg-slate-50 dark:bg-slate-900 p-2 rounded border">
                                <span className="font-semibold">{tier.rarity}</span>: ${tier.min} - ${tier.max} ({tier.prob}% chance)
                              </li>
                            ))}
                          </ul>
                        )}
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer text-blue-600 dark:text-blue-400">
                            Show canonical JSON
                          </summary>
                          <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded border font-mono text-xs break-all mt-1">
                            {JSON.stringify(packData.oddsSnapshot, ['min', 'max', 'prob', 'rarity'])}
                          </div>
                        </details>
                      </div>
                    </div>

                    <p className="text-xs pt-3 border-t border-slate-200 dark:border-slate-700">
                      Note: For older packs, this data comes from the backend database and cannot be verified against an on-chain snapshot hash.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          )}
        </CardContent>
      </Card>

      {/* ON-CHAIN DATA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ON-CHAIN DATA
            <Badge variant="secondary" className="text-xs">
              <Info className="h-3 w-3 mr-1" />
              Retrieved from blockchain
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            This data was retrieved directly from the Monad blockchain by querying the PackOpened event.
          </p>

          {/* Blockchain Links */}
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded">
              <span className="text-slate-600 dark:text-slate-400">Transaction</span>
              <a
                href={`${explorerUrl}/tx/${packData.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                {truncateHash(packData.txHash)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded">
              <span className="text-slate-600 dark:text-slate-400">Block</span>
              <a
                href={`${explorerUrl}/block/${packData.blockNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                {packData.blockNumber}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded">
              <span className="text-slate-600 dark:text-slate-400">User</span>
              <a
                href={`${explorerUrl}/address/${packData.user}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                {truncateHash(packData.user, 8, 6)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Event Data */}
          {blockchainEvent && (
            <Accordion type="single" collapsible className="border-none" value={expandAll ? "event-data" : undefined}>
              <AccordionItem value="event-data" className="border-t">
                <AccordionTrigger className="text-sm hover:no-underline">
                  View PackOpened Event Data
                </AccordionTrigger>
                <AccordionContent className="space-y-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Client Seed (from event):
                    </p>
                    <p className="font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded border break-all">
                      {blockchainEvent.clientSeed}
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Hashed Server Seed (committed on-chain):
                    </p>
                    <p className="font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded border break-all">
                      {blockchainEvent.hashedServerSeed}
                    </p>
                  </div>

                  {blockchainEvent.snapshotHash && blockchainEvent.snapshotHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Snapshot Hash (on-chain):
                      </p>
                      <p className="font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded border break-all">
                        {blockchainEvent.snapshotHash}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Card IDs:
                    </p>
                    <p className="font-mono text-xs bg-slate-50 dark:bg-slate-900 p-2 rounded border break-all max-h-32 overflow-y-auto">
                      {blockchainEvent.cardIds && blockchainEvent.cardIds.length > 0 ? (
                        <>
                          {blockchainEvent.cardIds.join(', ')}
                          {!hasSnapshotHash && <span className="text-slate-500"> (from event)</span>}
                        </>
                      ) : packData.cardIds && packData.cardIds.length > 0 ? (
                        <>
                          {packData.cardIds.join(', ')}
                          <span className="text-slate-500"> (from database - old pack event structure differs)</span>
                        </>
                      ) : (
                        'N/A'
                      )}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {blockchainEvent.cardIds && blockchainEvent.cardIds.length > 0 ? (
                        'Card IDs from PackOpened event on-chain'
                      ) : (
                        'Card IDs from database (event structure differs in old contract)'
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Block Timestamp:
                    </p>
                    <p className="font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded border">
                      {blockchainEvent.blockTimestamp} ({new Date(blockchainEvent.blockTimestamp * 1000).toLocaleString()})
                    </p>
                  </div>

                  <p className="text-slate-600 dark:text-slate-400 pt-3 border-t">
                    <strong>Note:</strong> This data is immutable and stored permanently on the Monad blockchain.
                    Anyone can independently verify this by querying the blockchain.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
