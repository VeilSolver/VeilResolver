# VeilSolver ⬡

**MEV-resistant intent solver with TEE-attested AI execution on 0G**

> 0G APAC Hackathon 2026 · Track 5 — Privacy & Sovereign Infrastructure

---

## Live Deployments

| Network | Contract | Explorer |
|---|---|---|
| **0G Aristotle Mainnet** (16661) | `0x02553ef7529118EB33E199b7329732d4F2884cEb` | [chainscan.0g.ai](https://chainscan.0g.ai/address/0x02553ef7529118EB33E199b7329732d4F2884cEb) |
| 0G Galileo Testnet (16602) | `0x4181c06901Ee172cc169fFDf44c6C192c22265aF` | [chainscan-galileo.0g.ai](https://chainscan-galileo.0g.ai/address/0x4181c06901Ee172cc169fFDf44c6C192c22265aF) |

**Live demo:** https://veilsolver.vercel.app

**Solver API:** http://localhost:4000/health

---

## The Problem

DeFi users lose **$1B+/year** to MEV (Maximal Extractable Value). Bots watch the public mempool and sandwich trades in under 200ms. Existing solutions (Flashbots, CoW Protocol) protect transactions but not the AI strategies that produce them — leaked through API logs or inferred from on-chain patterns.

## The Solution

VeilSolver introduces **private intent solving**: your trading strategy is computed inside a Trusted Execution Environment (TEE), encrypted end-to-end, and settled atomically. The strategy is never readable — not by the operator, not by the solver API, not by anyone until execution is final.

```
Normal DEX:
  User → public mempool (VISIBLE) → block builder → execution
                ↑ MEV bots sandwich here in 200ms

VeilSolver:
  User → ECIES encrypted intent → 0G Compute TEE (private) → signed plan → 0G Chain → execution
                                          ↑ host cannot read enclave memory (Intel TDX)
```

**Core thesis:** `Privacy is an architecture property, not a policy promise.`

---

## 0G Integration

| Component | Usage | Depth |
|---|---|---|
| **0G Compute** (GLM-5-FP8, TeeML) | Strategy LLM runs inside Intel TDX + H100 enclave. Host cannot read execution plan. | Core inference path |
| **0G Chain** (chainId 16661) | Settlement contract verifies ECDSA signature from enclave, executes DEX swap atomically | Smart contract deployment |
| **0G Storage** (TypeScript SDK) | Encrypted audit trail stored per intent. Merkle root hash emitted onchain. Tamper-evident. | Full SDK integration |

All three major 0G primitives used in the core happy path — not optional, not demo-only.

---

## How It Works

```
1. User fills form → buildIntent() + encryptIntent() (ECIES, client-side)
2. POST /solve { intent, encryptedIntent } → Solver API
3. Solver API → 0G Compute (GLM-5-FP8 inside Intel TDX + H100 enclave)
4. TEE returns: execution plan JSON + ZG-Res-Key (attestation ID)
5. Solver signs plan with ECDSA key → signature
6. Audit record stored to 0G Storage → merkle root hash
7. Frontend calls VeilSolver.sol.executePlan()
8. Contract: ecrecover(planHash, sig) == solverKey → swap on DEX → IntentExecuted event
```

**Privacy guarantees enforced by cryptography, not policy:**
- Intent contents: ECIES encrypted — only enclave key decrypts
- Strategy logic: Intel TDX — host cannot read enclave memory
- Execution plan: ECDSA — contract verifies via ecrecover, cannot be forged
- Audit record: 0G Storage merkle root — content-addressed, tamper-evident
- Replay protection: `executedIntents` mapping — EVM state is final

---

## Repo Structure

```
veilsolver/
├── contracts/              # Foundry — VeilSolver.sol settlement contract
│   ├── src/VeilSolver.sol  # Core: sig verify + DEX swap + replay protection
│   └── script/Deploy.s.sol # Deploy script (testnet + mainnet)
├── solver-api/             # Node.js — TEE inference orchestrator
│   ├── src/inference.ts    # 0G Compute call + response parsing
│   ├── src/storage.ts      # 0G Storage audit trail upload
│   ├── src/signer.ts       # ECDSA plan signing
│   └── src/server.ts       # Express: /solve /strategy /health /audit
├── frontend/               # Next.js — demo UI
│   ├── src/app/demo/       # Live demo: intent form + execution trace
│   ├── src/app/strategy/   # Strategy Registry: upload encrypted strategies
│   └── src/lib/solver.ts   # buildIntent / encryptIntent / callSolverAPI / submitSettlement
├── sdk/                    # TypeScript SDK (@veilsolver/sdk)
│   └── src/                # VeilSolverClient, strategy registry, audit history
└── shared/                 # Shared types: TradingIntent, ExecutionPlan, SolveResponse
```

---

## Quick Start

### Prerequisites

```bash
node >= 22, pnpm, foundry (https://getfoundry.sh)
Wallet with 0G tokens — testnet: https://faucet.0g.ai
```

### Install

```bash
pnpm install
```

### Deploy Contract

```bash
cd contracts

# Testnet (chainId 16602)
SOLVER_PRIVATE_KEY=0x... forge script script/Deploy.s.sol \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --broadcast --evm-version cancun -vvvv

# Mainnet (chainId 16661)
SOLVER_PRIVATE_KEY=0x... forge script script/Deploy.s.sol \
  --rpc-url https://evmrpc.0g.ai \
  --broadcast --evm-version cancun -vvvv
```

### Configure & Run Solver API

```bash
cd solver-api
cp .env.example .env
# Fill: SOLVER_PRIVATE_KEY, OG_API_KEY, NETWORK=mainnet, CONTRACT_ADDRESS=0x...
pnpm dev
# → http://localhost:4000/health
```

### Configure & Run Frontend

```bash
cd frontend
# Create .env.local (see .env.example)
# Key vars: NEXT_PUBLIC_SOLVER_API, NEXT_PUBLIC_CONTRACT_ADDRESS,
#           NEXT_PUBLIC_SOLVER_PUBKEY, NEXT_PUBLIC_CHAIN_ID=16661
pnpm dev
# → http://localhost:3000
```

---

## API Reference

### `POST /solve`

```json
{
  "intent": {
    "tokenIn": "0x...", "tokenOut": "0x...",
    "amountIn": "100000000",
    "maxSlippageBps": 50,
    "deadlineSeconds": 120,
    "userAddress": "0x...",
    "chainId": 16661,
    "nonce": "0xrandom32bytes"
  },
  "encryptedIntent": "ecies_hex..."
}
```

Response:
```json
{
  "plan": { "tokenIn": "...", "minAmountOut": "...", "route": ["0x...", "0x..."], "deadline": 1234567890, "intentHash": "0x..." },
  "signature": "0x...",
  "attestation": { "chatID": "...", "isVerified": true, "provider": "0x...", "model": "qwen-2.5-7b-instruct", "timestamp": 1234567890 },
  "auditRootHash": "0x..."
}
```

### `GET /health`

Returns solver address, network, and status.

### `POST /strategy`

Upload an ECIES-encrypted strategy prompt to 0G Storage. Returns `strategyId` (merkle root hash). Solver fetches and decrypts inside TEE at solve time.

---

## Security Model

| Threat | Mitigation |
|---|---|
| MEV sandwich | Intent encrypted until execution final — no mempool window |
| Malicious operator | Cannot read intents (ECIES), cannot forge plans (ECDSA), cannot alter audit (0G Storage merkle) |
| Replay attack | `executedIntents` mapping in contract — permanent, EVM-enforced |
| Slippage exceeded | `minAmountOut` enforced by contract — DEX swap reverts if output too low |
| Signature forgery | `ecrecover(planHash, sig) == solverKey` — computationally infeasible |

---

## Roadmap

```
v1 (Hackathon):   Encrypted intents · TEE inference · ECDSA settlement · 0G Storage audit · Strategy Registry
v2:               Enclave-generated solver key · signed oracle price feeds · multi-route split execution
v3 (Production):  On-chain TDX attestation · institutional compliance toolkit · token economics
```

---

Built with: **0G Compute (TeeML)** · **0G Chain** · **0G Storage** · Foundry · Next.js · TypeScript

