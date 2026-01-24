/**
 * Constants for Playkami Verifier
 */

// Blockchain configuration
export const DEFAULT_RPC_URL = process.env.NEXT_PUBLIC_DEFAULT_RPC_URL || 'https://rpc3.monad.xyz';
export const DROP_VENDING_MACHINE_ADDRESS = process.env.NEXT_PUBLIC_DROP_VENDING_MACHINE_ADDRESS || '0x0000000000000000000000000000000000000000';
// Monad Block Explorer (Testnet: https://monad-testnet.socialscan.io | Mainnet: https://monad.socialscan.io)
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://monad.socialscan.io';

// Backend API
export const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3000';

// Pack opening configuration
export const PRECISION = 1000000; // Same as backend CONFIG.PROVABLY_FAIR_PRECISION
export const USDC_DECIMALS = 6; // USDC has 6 decimals

// Pagination
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;

// RPC configuration
export const RPC_TIMEOUT_MS = 30000; // 30 seconds
export const RPC_RETRY_ATTEMPTS = 3;
export const RPC_RETRY_DELAY_MS = 1000; // 1 second

// UI configuration
export const TRUNCATE_HASH_LENGTH = 10; // Show first 10 chars of hashes
export const MAX_CARD_DISPLAY = 10; // Max cards to show before "show more"
