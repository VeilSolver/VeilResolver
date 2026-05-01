# VeilSolver ⬡

**MEV-resistant intent solver with TEE-attested AI execution on 0G**

Track 5 — Privacy & Sovereign Infrastructure | 0G APAC Hackathon 2026

---

## What it does

When you submit a trade on a DEX, bots watch the public mempool and sandwich you in 200ms. VeilSolver fixes this:

1. **You submit an encrypted intent** — not a transaction, just what you want
2. **An LLM computes the execution plan inside a TEE** — 0G Sealed Inference (Intel TDX + H100). The host cannot read it
3. **The plan is signed by the enclave key** and verified by a settlement contract on 0G Chain
4. **By the time it's onchain, it's already final** — no mempool window, no sandwich opportunity

## 0G Primitives used

| Primitive | Role |
|---|---|
| **0G Compute** (GLM-5-FP8, TeeML) | Strategy LLM runs inside TEE enclave |
| **0G Chain** (chainId 16602/16661) | Settlement contract verifies sig + executes swap |
| **0G Storage** (TypeScript SDK) | Encrypted audit trail per intent |

## Repo structure

```
veilsolver/
├── solver-api/          # Node.js API: TEE inference + Storage + signing
│   ├── src/inference.ts # 0G Compute broker — the TEE call
│   ├── src/storage.ts   # 0G Storage audit trail
│   ├── src/signer.ts    # ECDSA plan signing
│   └── src/server.ts    # Express server
├── contracts/           # Solidity — Foundry project
│   ├── src/VeilSolver.sol
│   └── script/Deploy.s.sol
├── frontend/            # Next.js demo UI
│   └── src/app/page.tsx
└── shared/              # Shared TypeScript types
    └── src/intent.ts
```

## Quick start

### 1. Prerequisites

```bash
node >= 22
pnpm
foundry (https://getfoundry.sh)
A wallet with 0G testnet tokens (https://faucet.0g.ai)
```

### 2. Install packages

```bash
pnpm install
pnpm add @0glabs/0g-serving-broker -g   # 0G CLI
```

### 3. Configure solver API

```bash
cp solver-api/.env.example solver-api/.env
# Fill in:
#   SOLVER_PRIVATE_KEY=0x...
#   GLM5_PROVIDER_ADDRESS=0x...
#   NETWORK=testnet
```

### 4. Fund your 0G Compute account

```bash
0g-compute-cli setup-network      # choose testnet
0g-compute-cli login              # enter your private key
0g-compute-cli deposit --amount 10
0g-compute-cli transfer-fund --provider <GLM5_PROVIDER> --amount 2
0g-compute-cli inference verify --provider <GLM5_PROVIDER>
```

### 5. Deploy contracts

```bash
cd contracts
forge install foundry-rs/forge-std

# Deploy to testnet
forge script script/Deploy.s.sol \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --broadcast \
  --evm-version cancun

# Verify
forge verify-contract \
  --chain-id 16602 \
  --verifier custom \
  --verifier-api-key PLACEHOLDER \
  --verifier-url https://chainscan-galileo.0g.ai/open/api \
  <CONTRACT_ADDRESS> \
  src/VeilSolver.sol:VeilSolver
```

### 6. Start the API

```bash
cd solver-api && pnpm dev
# → http://localhost:4000/health
```

### 7. Start the frontend

```bash
# Add to frontend/.env.local:
# NEXT_PUBLIC_SOLVER_API=http://localhost:4000
# NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
# NEXT_PUBLIC_SOLVER_PUBKEY=0x...

cd frontend && pnpm dev
# → http://localhost:3000
```

## How MEV is stopped

```
Normal DEX:
  User → public mempool (VISIBLE) → block builder → execution
                ↑ bot sandwiches here in 200ms

VeilSolver:
  User → encrypted intent → TEE (private) → signed plan → contract → execution
                                                    ↑ onchain, already final
```

The transaction never exists in a readable pending state. By the time it hits the chain, execution is done.

## API reference

### POST /solve

```json
{
  "intent": {
    "tokenIn": "0x...",
    "tokenOut": "0x...",
    "amountIn": "100000000",
    "maxSlippageBps": 50,
    "deadlineSeconds": 120,
    "userAddress": "0x...",
    "chainId": 16602,
    "nonce": "0xrandom32bytes"
  },
  "encryptedIntent": "hex..."
}
```

Returns:
```json
{
  "plan": { "tokenIn": "...", "minAmountOut": "...", "route": [...], ... },
  "signature": "0x...",
  "attestation": {
    "chatID": "...",
    "isVerified": true,
    "provider": "0xd9966e...",
    "model": "GLM-5-FP8"
  },
  "auditRootHash": "0x..."
}
```

### GET /health

Returns solver address, network, and status.

## Submission checklist

- [ ] Contract deployed on 0G mainnet (chainId 16661)
- [ ] Contract verified on chainscan.0g.ai
- [ ] GitHub repo with commits spanning hackathon period
- [ ] 3-minute demo video (YouTube/Loom)
- [ ] X post: @0G_labs @0g_CN @0g_Eco @HackQuest_ #0GHackathon #BuildOn0G

---

Built with: 0G Compute (TeeML) · 0G Chain · 0G Storage · Foundry · Next.js
