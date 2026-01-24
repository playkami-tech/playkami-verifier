/**
 * Blockchain utilities for querying Monad blockchain
 */

import { ethers } from 'ethers';
import { PackOpenedEvent } from '@/types';
import {
  DEFAULT_RPC_URL,
  DROP_VENDING_MACHINE_ADDRESS,
  RPC_TIMEOUT_MS,
  RPC_RETRY_ATTEMPTS,
  RPC_RETRY_DELAY_MS
} from '@/constants';

// Import contract ABI
import contractABI from '@/../public/abi/DropVendingMachine.json';

/**
 * Create ethers provider with retry logic
 *
 * @param rpcUrl - RPC endpoint URL
 * @returns Ethers provider
 */
export function createProvider(rpcUrl: string = DEFAULT_RPC_URL): ethers.JsonRpcProvider {
  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
    staticNetwork: true
  });

  return provider;
}

/**
 * Query PackOpened event for a specific pack by transaction hash
 * Note: Event may emit either 'serverSeed' (revealed, old) or 'hashedServerSeed' (committed, new)
 *
 * @param txHash - Transaction hash of pack opening
 * @param packId - Pack ID to verify
 * @param provider - Ethers provider
 * @param contractAddress - Contract address
 * @param expectedClientSeed - Optional client seed to match in batch transactions
 * @returns PackOpened event data
 */
export async function queryPackOpenedEvent(
  txHash: string,
  packId: number,
  provider: ethers.JsonRpcProvider,
  contractAddress: string = DROP_VENDING_MACHINE_ADDRESS,
  expectedClientSeed?: string
): Promise<PackOpenedEvent> {
  try {
    // Create contract instance
    const contract = new ethers.Contract(contractAddress, contractABI.abi, provider);

    // Get transaction receipt (with retry logic)
    let receipt: ethers.TransactionReceipt | null = null;
    for (let attempt = 1; attempt <= RPC_RETRY_ATTEMPTS; attempt++) {
      try {
        receipt = await provider.getTransactionReceipt(txHash);
        break;
      } catch (error) {
        if (attempt === RPC_RETRY_ATTEMPTS) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, RPC_RETRY_DELAY_MS * attempt));
      }
    }

    if (!receipt) {
      throw new Error(`Transaction ${txHash} not found`);
    }

    // Parse logs to find PackOpened event
    const parsedEvents: Array<{
      log: ethers.Log;
      parsed: ethers.LogDescription;
    }> = [];

    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data
        });
        if (parsed && parsed.name === 'PackOpened') {
          parsedEvents.push({ log, parsed });
        }
      } catch {
        // Skip logs that don't match our ABI
        continue;
      }
    }

    // If no events found, try decoding transaction calldata as fallback
    if (parsedEvents.length === 0) {
      console.warn(`[queryPackOpenedEvent] No events found, attempting to decode tx calldata...`);

      // Get the transaction to access calldata
      const tx = await provider.getTransaction(txHash);
      if (!tx || !tx.data) {
        throw new Error(`No PackOpened event found in transaction ${txHash} and unable to decode calldata`);
      }

      try {
        const selector = tx.data.substring(0, 10);

        // Check if this is the old contract function (0x39e86312)
        // Old function: openPackOnBehalf(address user, uint256 packId, RandomnessProof calldata proof, ...)
        // Old RandomnessProof struct: { bytes32 clientSeed; bytes32 hashedServerSeed; uint256 timestamp }
        // Note: Old struct did NOT have snapshotHash field (added later)
        if (selector === '0x39e86312') {
          console.log(`[queryPackOpenedEvent] Old contract function detected, manually decoding...`);

          // Manual decoding (each param is 64 hex chars = 32 bytes)
          let offset = 10; // Skip 0x and 4-byte selector

          // Param 1: address user (32 bytes, but only last 20 bytes are address)
          const user = '0x' + tx.data.substring(offset + 24, offset + 64);
          offset += 64;

          // Param 2: uint256 packId (skip, not needed)
          offset += 64;

          // Param 3: bytes32 clientSeed (from RandomnessProof struct)
          const clientSeed = '0x' + tx.data.substring(offset, offset + 64);
          offset += 64;

          // Param 4: bytes32 hashedServerSeed (from RandomnessProof struct)
          const hashedServerSeed = '0x' + tx.data.substring(offset, offset + 64);
          offset += 64;

          // Param 5: uint256 timestamp (from RandomnessProof struct) - skip, not needed
          // Note: Old struct did NOT have snapshotHash
          offset += 64;

          // Get block timestamp and cardIds from the old event
          // Old event signature: PackOpened(address indexed user, uint256 indexed packId, bytes32 indexed clientSeed, bytes32 hashedServerSeed, bytes32 finalRandomness, uint256 blockTimestamp, uint256[] cardIds)
          const oldPackOpenedTopic = ethers.id('PackOpened(address,uint256,bytes32,bytes32,bytes32,uint256,uint256[])');
          let blockTimestamp = 0;
          let cardIds: string[] = [];

          for (const log of receipt.logs) {
            if (log.topics[0] === oldPackOpenedTopic) {
              console.log('[queryPackOpenedEvent] Found old PackOpened event, manually decoding...');

              try {
                // Manually decode the event data
                const data = log.data;
                let dataOffset = 2; // Skip '0x'

                // Skip hashedServerSeed (32 bytes = 64 hex chars)
                dataOffset += 64;

                // Skip finalRandomness (32 bytes)
                dataOffset += 64;

                // Read blockTimestamp (32 bytes)
                const timestampHex = '0x' + data.substring(dataOffset, dataOffset + 64);
                blockTimestamp = parseInt(timestampHex, 16);
                dataOffset += 64;

                // Read cardIds array offset (32 bytes)
                const arrayOffset = parseInt('0x' + data.substring(dataOffset, dataOffset + 64), 16);

                // Jump to array location
                const arrayStart = 2 + (arrayOffset * 2);

                // Read array length
                const arrayLength = parseInt('0x' + data.substring(arrayStart, arrayStart + 64), 16);

                // Read array elements (Token IDs as BigInt)
                let arrayDataOffset = arrayStart + 64;
                for (let j = 0; j < arrayLength; j++) {
                  const tokenIdHex = '0x' + data.substring(arrayDataOffset, arrayDataOffset + 64);
                  const tokenId = BigInt(tokenIdHex).toString();
                  cardIds.push(tokenId);
                  arrayDataOffset += 64;
                }

                console.log('[queryPackOpenedEvent] Old event decoded:', {
                  blockTimestamp,
                  cardIds: cardIds.length > 0 ? `${cardIds.length} Token IDs` : 'none'
                });
                break;
              } catch (e) {
                console.warn('[queryPackOpenedEvent] Could not parse old event structure:', e);
              }
            }
          }

          // If event not found, try to get block timestamp at least
          if (blockTimestamp === 0) {
            const block = await provider.getBlock(receipt.blockNumber);
            blockTimestamp = block?.timestamp || 0;
          }

          console.log(`[queryPackOpenedEvent] Manually decoded old contract call:`, {
            user,
            clientSeed,
            hashedServerSeed,
            snapshotHash: '(not in old contract)',
            blockTimestamp,
            cardIds: cardIds.length > 0 ? `${cardIds.length} Token IDs` : '(from database)'
          });

          return {
            packId: Number(packId),
            user,
            clientSeed,
            hashedServerSeed,
            snapshotHash: '0x0000000000000000000000000000000000000000000000000000000000000000', // Old contract didn't have snapshotHash
            cardIds, // Token IDs from event (BigInt strings), or empty if event parse failed
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber.toString(),
            blockTimestamp
          };
        }

        // Try to decode the function call (same approach as decode-pack-opening-tx.ts)
        const decodedData = contract.interface.parseTransaction({ data: tx.data, value: tx.value });

        if (!decodedData) {
          throw new Error(`Unable to decode transaction data`);
        }

        console.log(`[queryPackOpenedEvent] Decoded function: ${decodedData.name}`);

        // Handle batch vs single pack functions
        if (decodedData.name === 'openPackBatchOnBehalfWithPromo' || decodedData.name === 'openPackBatchOnBehalf') {
          // Batch: args[2] is an ARRAY of proofs
          const proofs = decodedData.args[2];

          let matchedProof;
          if (expectedClientSeed) {
            // Find proof by matching client seed
            matchedProof = proofs.find((p: any) =>
              p.clientSeed.toLowerCase() === expectedClientSeed.toLowerCase()
            );
          }

          if (!matchedProof && proofs.length > 0) {
            matchedProof = proofs[0]; // Fallback to first proof
            console.warn(`[queryPackOpenedEvent] Batch tx: using first proof (could not match clientSeed)`);
          }

          if (!matchedProof) {
            throw new Error(`No proof found in batch transaction`);
          }

          return {
            packId: Number(packId),
            user: decodedData.args[0].toString(),
            clientSeed: matchedProof.clientSeed.toString(),
            hashedServerSeed: matchedProof.hashedServerSeed.toString(),
            snapshotHash: matchedProof.snapshotHash.toString(),
            cardIds: [],
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber.toString(),
            blockTimestamp: 0
          };
        } else {
          // Single pack: args[2] is a single proof object
          const proof = decodedData.args[2];

          return {
            packId: Number(packId),
            user: decodedData.args[0].toString(),
            clientSeed: proof.clientSeed.toString(),
            hashedServerSeed: proof.hashedServerSeed.toString(),
            snapshotHash: proof.snapshotHash.toString(),
            cardIds: [],
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber.toString(),
            blockTimestamp: 0
          };
        }
      } catch (decodeError: any) {
        console.error(`[queryPackOpenedEvent] Failed to decode calldata:`, decodeError.message);
        console.error(`[queryPackOpenedEvent] Function selector:`, tx.data.substring(0, 10));
        throw new Error(`No PackOpened event found in transaction ${txHash} and unable to decode calldata`);
      }
    }

    // Find the PackOpened event that matches this pack
    // Note: Some transactions may contain multiple pack openings (batch transactions)
    let matchedEvent;

    // Try matching by client seed first (most reliable for batch txs)
    if (expectedClientSeed) {
      matchedEvent = parsedEvents.find(({ parsed }) => {
        const eventClientSeed = parsed.args[2].toString();
        return eventClientSeed.toLowerCase() === expectedClientSeed.toLowerCase();
      });

      if (!matchedEvent) {
        console.warn(`[queryPackOpenedEvent] No event found with clientSeed ${expectedClientSeed}, trying packId. Found ${parsedEvents.length} events.`);
      }
    }

    // Fallback to matching by packId
    if (!matchedEvent) {
      matchedEvent = parsedEvents.find(({ parsed }) => {
        const eventPackId = Number(parsed.args[1]);
        return eventPackId === packId;
      });
    }

    // If still no match, use the first event (backwards compatibility)
    if (!matchedEvent) {
      console.warn(`[queryPackOpenedEvent] No event found matching packId ${packId}, using first event. Found ${parsedEvents.length} events.`);
      matchedEvent = parsedEvents[0];
    }

    const { log, parsed } = matchedEvent;

    // Parse event arguments based on PackOpened event structure:
    // event PackOpened(
    //   address indexed user,           // args[0]
    //   uint256 indexed packId,         // args[1]
    //   bytes32 indexed clientSeed,     // args[2]
    //   bytes32 serverSeed,             // args[3] - hashedServerSeed (or revealed seed in old versions)
    //   bytes32 finalRandomness,        // args[4] - not used for verification
    //   uint256 blockTimestamp,         // args[5]
    //   uint256[] cardIds,              // args[6]
    //   bytes32 snapshotHash            // args[7]
    // )
    const eventArgs = parsed.args;
    const user = eventArgs[0];
    const eventPackId = eventArgs[1];
    const clientSeed = eventArgs[2];
    const serverSeed = eventArgs[3]; // This is hashedServerSeed in new contracts
    const blockTimestamp = eventArgs[5];
    const cardIds = eventArgs[6];
    const snapshotHash = eventArgs[7];

    return {
      packId: Number(packId),
      user: user.toString(),
      clientSeed: clientSeed.toString(),
      hashedServerSeed: serverSeed.toString(),
      snapshotHash: snapshotHash.toString(),
      cardIds: Array.isArray(cardIds) ? cardIds.map((id: any) => {
        // Convert to string to avoid scientific notation for large BigInt values
        if (typeof id === 'bigint') {
          return id.toString();
        }
        // If it's already a number/string, convert to string
        return String(id);
      }) : [],
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber.toString(),
      blockTimestamp: Number(blockTimestamp)
    };
  } catch (error: any) {
    console.error('[queryPackOpenedEvent] Error:', error);
    throw new Error(`Failed to query PackOpened event: ${error.message}`);
  }
}

/**
 * Get transaction details
 *
 * @param txHash - Transaction hash
 * @param provider - Ethers provider
 * @returns Transaction receipt
 */
export async function getTransactionReceipt(
  txHash: string,
  provider: ethers.JsonRpcProvider
): Promise<ethers.TransactionReceipt | null> {
  try {
    for (let attempt = 1; attempt <= RPC_RETRY_ATTEMPTS; attempt++) {
      try {
        const receipt = await provider.getTransactionReceipt(txHash);
        return receipt;
      } catch (error) {
        if (attempt === RPC_RETRY_ATTEMPTS) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, RPC_RETRY_DELAY_MS * attempt));
      }
    }
    return null;
  } catch (error: any) {
    console.error('[getTransactionReceipt] Error:', error);
    return null;
  }
}

/**
 * Get current block number
 *
 * @param provider - Ethers provider
 * @returns Current block number
 */
export async function getCurrentBlockNumber(
  provider: ethers.JsonRpcProvider
): Promise<number> {
  try {
    for (let attempt = 1; attempt <= RPC_RETRY_ATTEMPTS; attempt++) {
      try {
        const blockNumber = await provider.getBlockNumber();
        return blockNumber;
      } catch (error) {
        if (attempt === RPC_RETRY_ATTEMPTS) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, RPC_RETRY_DELAY_MS * attempt));
      }
    }
    throw new Error('Failed to get block number after retries');
  } catch (error: any) {
    console.error('[getCurrentBlockNumber] Error:', error);
    throw error;
  }
}

/**
 * Format blockchain explorer URL
 *
 * @param type - Type of link (tx, address, block)
 * @param value - Value to link to
 * @param explorerUrl - Base explorer URL
 * @returns Full explorer URL
 */
export function getExplorerLink(
  type: 'tx' | 'address' | 'block',
  value: string,
  explorerUrl: string = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://monad-testnet.socialscan.io'
): string {
  const cleanValue = value.trim();

  switch (type) {
    case 'tx':
      return `${explorerUrl}/tx/${cleanValue}`;
    case 'address':
      return `${explorerUrl}/address/${cleanValue}`;
    case 'block':
      return `${explorerUrl}/block/${cleanValue}`;
    default:
      return explorerUrl;
  }
}

/**
 * Truncate hash for display
 *
 * @param hash - Full hash string
 * @param length - Number of characters to show (default: 10)
 * @returns Truncated hash (e.g., "0x1234...5678")
 */
export function truncateHash(hash: string, length: number = 10): string {
  if (!hash || hash.length <= length + 4) {
    return hash;
  }

  const start = hash.slice(0, length);
  const end = hash.slice(-4);
  return `${start}...${end}`;
}
