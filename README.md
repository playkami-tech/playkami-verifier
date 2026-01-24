# Playkami Verifier

An open-source Next.js application for independently verifying the fairness of pack openings on the Monad blockchain.

## Features

- **Trustless Verification**: Query blockchain data directly from Monad RPC
- **Complete Transparency**: Verify server seed hash, snapshot hash, and card selection
- **Card-by-Card Breakdown**: See detailed verification for each card in the pack
- **Backward Compatibility**: Handles older packs without snapshot hash
- **Open Source**: All verification algorithms match the backend exactly

## Verification Flow

1. **Server Seed Hash Verification**: Confirms the server couldn't change randomness after committing
2. **Snapshot Hash Verification**: Proves the card pool and odds were locked at opening time
3. **Card Selection Replay**: Recomputes which cards should be selected using the same algorithm as the backend

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- pnpm (or npm/yarn)
- Access to Monad RPC endpoint
- Playkami backend API endpoint

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.local.example .env.local

# Edit .env.local with your configuration
# NEXT_PUBLIC_DEFAULT_RPC_URL=your-monad-rpc-url
# NEXT_PUBLIC_DROP_VENDING_MACHINE_ADDRESS=contract-address
# NEXT_PUBLIC_BACKEND_API_URL=backend-api-url
```

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the verifier.

### Production Build

```bash
pnpm build
pnpm start
```

## Project Structure

```
playkami-verifier/
├── src/
│   ├── app/                      # Next.js app router pages
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── VerificationInput.tsx
│   │   ├── VerificationResult.tsx
│   │   └── CardVerification.tsx
│   ├── providers/
│   │   └── VerifierProvider.tsx  # React context for state management
│   ├── hooks/
│   │   └── useVerification.ts    # Main verification hook
│   ├── utils/
│   │   ├── hashing.ts            # Core hashing algorithms
│   │   ├── verification.ts       # Card selection replay
│   │   ├── blockchain.ts         # Monad blockchain queries
│   │   └── api.ts                # Backend API client
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   └── constants/
│       └── index.ts              # Configuration constants
└── public/
    └── abi/
        └── DropVendingMachine.json  # Contract ABI
```

## How It Works

### 1. Snapshot Hash Computation

```typescript
// CRITICAL: Must match backend exactly
const canonicalOdds = JSON.stringify(oddsSnapshot, ['min', 'max', 'prob', 'rarity']);
const encoded = abiCoder.encode(['uint256[]', 'string'], [cardPoolSnapshot, canonicalOdds]);
const snapshotHash = ethers.keccak256(encoded);
```

### 2. Card Randomness Generation

```typescript
// For each card in the pack
const randomness = ethers.keccak256(
  ethers.solidityPacked(['bytes32', 'bytes32', 'uint256'], [serverSeed, clientSeed, cardIndex])
);
```

### 3. Tier Selection

Uses BigInt arithmetic with Decimal.js for precision to select tier based on cumulative probability.

### 4. Card Selection

- Filter available cards by tier's price range
- Select card using: `cardIndex = randomness % tierCards.length`
- Remove from pool (no duplicates)

## Environment Variables

Create a `.env.local` file with:

```bash
NEXT_PUBLIC_DEFAULT_RPC_URL=https://rpc.ankr.com/monad_testnet
NEXT_PUBLIC_DROP_VENDING_MACHINE_ADDRESS=0x0000000000000000000000000000000000000000
# Testnet: https://monad-testnet.socialscan.io | Mainnet: https://monad.socialscan.io
NEXT_PUBLIC_EXPLORER_URL=https://monad-testnet.socialscan.io
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8084
```

## Backend API Requirements

The verifier requires these endpoints:

- `GET /api/verifier/pack/:packId` - Get pack verification data
- `GET /api/verifier/snapshot/:snapshotHash/packs` - Get packs with same snapshot
- `POST /api/verifier/cards/prices` - Get card prices at opening time
- `GET /api/verifier/packs` - Get pack history

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **ethers.js v6** - Blockchain interaction
- **Decimal.js** - Precise probability calculations
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components

## Contributing

This is an open-source project. Contributions are welcome!

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
