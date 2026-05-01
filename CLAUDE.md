# CLAUDE.md — VeilSolver Technical Reference

> Authoritative reference. Read before touching code.

---

## 1. Project Overview

**Problem:** DeFi users lose $1B+/year to MEV. Existing solutions (Flashbots, CoW, Primev) protect transactions but not the AI strategies that produce them — leaked through API logs or inferred from patterns.

**VeilSolver:** Private intent solver. Accepts encrypted trading intents, computes execution plans inside a TEE (0G Sealed Inference), settles atomically on 0G Chain. Intent and strategy are unreadable before execution is final.

**Core thesis:** `Privacy is an architecture property, not a policy promise.` Every guarantee enforced by cryptography or hardware.

---

## 2. High-Level Design

### Layer Responsibilities

| Layer | Responsibility | Technology |
|---|---|---|
| Client | Build + encrypt intent, render trace, submit settlement tx | Next.js, ethers.js, eciesjs |
| SDK | Reusable client for protocol integration | TypeScript |
| Solver API | Orchestrate TEE inference, signing, storage | Node.js, Express |
| 0G Compute | Private strategy execution, TEE attestation | GLM-5-FP8, TeeML, Intel TDX |
| 0G Storage | Encrypted audit trail, verifiable record | @0gfoundation/0g-ts-sdk |
| 0G Chain | Settlement, signature verification, swap | Solidity, Foundry |

### Data Flow Summary

```
User → Frontend (buildIntent + encryptIntent) → POST /solve → Solver API
Solver API → 0G Compute (GLM-5-FP8 in TDX enclave) → plan JSON + ZG-Res-Key
Solver API → processResponse() (TEE verify) → signPlan() → storeAuditRecord()
Solver API → SolveResponse { plan, signature, attestation, auditRootHash }
Frontend → executePlan() → VeilSolver.sol → DEX Router → swap → IntentExecuted
```

### Deployment Topology

- Frontend: Vercel (Next.js SSR, port 3000)
- Solver API: Railway/Fly.io (Node.js, port 4000)
- 0G Compute: TeeML RPC (mainnet)
- 0G Storage: Turbo Indexer (mainnet)
- 0G Chain: chainId 16661

---

## 3. Low-Level Design

### 3.1 Shared Types (`shared/src/intent.ts`)

```typescript
// Intent = what the user WANTS. Solver decides HOW.
interface TradingIntent {
  tokenIn: string           // ERC20 address user sells
  tokenOut: string          // ERC20 address user buys
  amountIn: string          // wei string — avoids BigInt serialization issues
  maxSlippageBps: number    // 150 = 1.5%. Hard limit. Solver cannot exceed.
  deadlineSeconds: number   // relative — converted to absolute unix ts in solver
  userAddress: string       // who gets the output tokens
  chainId: number           // network guard — prevents cross-chain replay
  nonce: string             // 32-byte random hex — unique per intent, replay key
}

// Plan = what the TEE decided. Every field maps to a Solidity function parameter.
interface ExecutionPlan {
  tokenIn: string
  tokenOut: string
  amountIn: string          // same as intent (fee subtracted in contract)
  minAmountOut: string      // expectedOut * (1 - slippage). Contract enforces this.
  route: string[]           // ordered pool addresses e.g. [USDC_POOL, WETH_POOL]
  deadline: number          // absolute unix timestamp (intent.deadlineSeconds + now)
  intentHash: string        // keccak256 of nonce — replay protection key in contract
  reasoning?: string        // PRIVATE. Never leave the enclave. Never log. Never store.
}
```

`reasoning` is on the struct for LLM context coherence but stripped before serialization:
```typescript
const { reasoning: _, ...publicPlan } = solveResult.plan
```

All wei values are `string`, not `BigInt` — BigInt doesn't serialize to JSON. Convert to BigInt only at the Solidity boundary.

---

### 3.2 Solver API Modules

#### `inference.ts` — TEE Call

Single function, zero business logic. Performs TEE-attested inference.

```
Input:  TradingIntent
Output: { plan: ExecutionPlan, chatID: string, isVerified: boolean }

Side effects:
  - 0G Compute account auto-funded if balance low
  - Broker singleton initialized on first call

Critical path:
  createZGComputeNetworkBroker(wallet)
  → broker.inference.getServiceMetadata(provider)
  → broker.inference.getRequestHeaders(provider)
  → fetch(endpoint + "/chat/completions", { headers, body: intent prompt })
  → response.headers.get("ZG-Res-Key")                  ← chatID
  → broker.inference.processResponse(provider, chatID)  ← TEE verification
  → JSON.parse(response choices[0].message.content)     ← execution plan

Error states:
  Provider unreachable → throw (500)
  LLM returns non-JSON → throw with raw output in message
  processResponse fails → isVerified=false (non-fatal for MVP)
  Insufficient balance → SDK auto-tops-up
```

**Singleton broker:** `createZGComputeNetworkBroker()` costs ~2s + onchain gas. Broker is stateless between requests; wallet is thread-safe in ethers v6. If horizontal scaling needed: Redis-backed per-process instances.

**System prompt constraints:** JSON-only output, never exceed declared slippage, reasoning field is private.

---

#### `storage.ts` — Audit Trail

Persists every solve to 0G Storage. Returns merkle root hash (public retrieval key).
Encrypted intent is ECIES — only user decrypts. Attestation + plan stored in plaintext.

```
Input:  AuditRecord, signer wallet key
Output: string (merkle root hash — 0G Storage retrieval key)

AuditRecord schema:
  version:          "1.0"       schema version
  intentHash:       string      matches contract replay protection key
  userAddress:      string      who submitted the intent
  encryptedIntent:  string      hex ECIES — only user decrypts
  attestation:      object      chatID, isVerified, provider, model, timestamp
  plan:             object      public plan WITHOUT reasoning field
  outcome:          object?     added when tx receipt known
  timestamp:        number      unix ms
```

Root hash IS the key (content-addressed storage). Emitted in `IntentExecuted` event → queryable from chain. No secondary index needed.

Users audit their own history by decrypting intents with their wallet key. Regulators request decryption from the user. Operator controls nothing.

---

#### `signer.ts` — Plan Signing

ECDSA signs the execution plan hash. `VeilSolver.sol` verifies via `ecrecover()`.

```
Hash construction (MUST match Solidity exactly):
  planHash = keccak256(abi.encode(
    address tokenIn, address tokenOut,
    uint256 amountIn, uint256 minAmountOut,
    uint256 deadline, bytes32 intentHash
  ))
  ethHash = keccak256("\x19Ethereum Signed Message:\n32" + planHash)

TypeScript: wallet.signMessage(ethers.getBytes(planHash))   // adds prefix internally
Solidity:   ecrecover(ethHash, v, r, s)
```

**CRITICAL:** `route` is NOT hashed — avoids expensive array ABI-encoding. Wrong routing still fails: swap output falls below `minAmountOut`, tx reverts. If adding new fields: update BOTH `signer.ts` AND `_getPlanHash()` together.

---

#### `server.ts` — Express Routes

```
POST /solve
  1. Validate required fields (tokenIn, amountIn, userAddress)
  2. inference.ts → { plan, chatID, isVerified }
  3. signer.ts → signature
  4. Build attestation object
  5. storage.ts → auditRootHash (non-fatal if fails)
  6. Return SolveResponse

GET /health  → { status, solverAddress, network, timestamp }
GET /audit/:rootHash → { rootHash, scanUrl }

Error format: { "error": "message" } | HTTP 400 (validation) | HTTP 500 (TEE/storage/signing)
```

---

### 3.3 VeilSolver.sol — Contract Design

#### Storage Layout

```solidity
address public owner;                              // slot 0
address public solverKey;                          // slot 1 — registered enclave/solver ECDSA key
address public dexRouter;                          // slot 2 — Uniswap V3 fork on 0G
address public feeRecipient;                       // slot 3
uint256 public feeBps;                             // slot 4 — default 10 (0.1%)
uint256 public constant MAX_FEE_BPS = 100;         // 1% hard cap
mapping(bytes32 => bool) public executedIntents;   // replay protection
```

#### `executePlan()` Execution Order (ORDER IS CRITICAL — reentrancy safety)

```
Visibility: external | Gas: ~180,000 (ERC20 transfers + DEX swap)

1.  Check deadline                         (read only)
2.  Check !executedIntents[hash]           (read only)
3.  Verify ECDSA signature                 (pure computation)
4.  SET executedIntents[hash] = true    ← STATE CHANGE BEFORE EXTERNAL CALLS
5.  Calculate fee
6.  transferFrom(user → contract)          (external call #1)
7.  transfer(contract → feeRecipient)      (external call #2)
8.  approve(dexRouter, amountForSwap)      (external call #3)
9.  swapExactTokensForTokens()             (external call #4)
10. emit IntentExecuted
```

Step 4 before external calls = Checks-Effects-Interactions pattern. Reentrant call finds intent already marked executed.
`approve()` per-execution (not max uint256) — approving max to a DEX router is a known security anti-pattern.

#### Signature Verification (TypeScript ↔ Solidity)

```
TypeScript (signer.ts):
  planHash = keccak256(abi.encode(tokenIn, tokenOut, amountIn, minAmountOut, deadline, intentHash))
  sig = wallet.signMessage(getBytes(planHash))   // adds \x19 prefix internally

Solidity (VeilSolver.sol):
  planHash  = keccak256(abi.encode(tokenIn, tokenOut, amountIn, minAmountOut, deadline, intentHash))
  ethHash   = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", planHash))
  recovered = ecrecover(ethHash, v, r, s)
  require(recovered == solverKey)
```

These MUST produce the same hash. Any field added/removed/reordered breaks verification.

---

### 3.4 Frontend Architecture

```
app/
  layout.tsx    root layout — font, metadata, global styles
  page.tsx      single-page app — all state lives here

lib/
  solver.ts     pure functions, no React
    buildIntent()        form values → TradingIntent
    encryptIntent()      TradingIntent → ECIES hex string
    callSolverAPI()      TradingIntent + encrypted → SolveResponse
    submitSettlement()   SolveResponse + signer → TransactionReceipt
```

**Solve flow state machine:**
```
IDLE → ENCRYPTING → TEE_INFERENCE → ATTESTING → STORING → SETTLING → COMPLETE
  (any state) → ERROR → (user edits form) → IDLE
```

Step visual: pending=gray dot, active=white dot+spinner, done=green dot+✓, error=red dot+✗

**No Redux/Zustand:** Single page, single flow. `useState` is correct. Add Zustand if app grows to multiple pages.

---

## 4. Data Flows

### 4.1 Happy Path

```
1.  User fills form, clicks "Solve & Execute"
2.  Frontend: buildIntent() + encryptIntent() (ECIES, local)
3.  Frontend: POST /solve { intent, encryptedIntent }
4.  API: getRequestHeaders(provider) → POST /chat/completions to 0G Compute
5.  GLM-5-FP8 executes inside Intel TDX+H100 enclave → returns plan JSON + ZG-Res-Key
6.  API: processResponse(chatID) → isVerified
7.  API: signPlan(plan) → ECDSA signature
8.  API: storeAuditRecord() → rootHash to 0G Storage
9.  API returns SolveResponse { plan, signature, attestation, auditRootHash }
10. Frontend: submitSettlement() → executePlan() on VeilSolver.sol
11. Contract: verify sig → mark intent executed → fee split → DEX swap → emit IntentExecuted
12. User sees txHash + full execution trace
```

### 4.2 Replay Attack Prevention

```
nonce = 0xdeadbeef... (random 32 bytes)
intentHash = keccak256(nonce)  → mapping key

1st call: require(!executedIntents[intentHash]) → passes → set true
2nd call: require(!executedIntents[intentHash]) → REVERTS

Cross-chain: chainId in intent struct + per-chain contract addresses prevent cross-chain replay.
```

### 4.3 Fee Flow

```
amountIn = 1000 USDC (user approves this)
fee = 1000 * 10 / 10000 = 1 USDC (0.1%)
amountForSwap = 999 USDC

transferFrom(user → contract, 1000 USDC)
transfer(contract → feeRecipient, 1 USDC)
approve(dexRouter, 999 USDC)
swap(999 USDC → WETH, minOut=0.412 WETH) — output direct to user
```

---

## 5. Component Interfaces

### 5.1 Solver API

```typescript
// POST /solve
Request:  { intent: TradingIntent, encryptedIntent: string }

Response 200: {
  plan: ExecutionPlan
  signature: string           // 0x ECDSA hex — verified by settlement contract
  attestation: {
    chatID: string            // ZG-Res-Key from 0G Compute response header
    isVerified: boolean       // processResponse() result
    provider: string          // 0G Compute provider address
    model: string             // "GLM-5-FP8"
    timestamp: number         // unix ms
  }
  auditRootHash: string       // 0G Storage root hash — "" if storage failed
}
Response 400: { error: "Missing required intent fields" }
Response 500: { error: "<inference|storage|signing error message>" }
```

### 5.2 VeilSolver.sol

```solidity
// View
function owner() external view returns (address)
function solverKey() external view returns (address)
function dexRouter() external view returns (address)
function feeRecipient() external view returns (address)
function feeBps() external view returns (uint256)
function executedIntents(bytes32) external view returns (bool)
function getPlanHash(ExecutionPlan calldata) external pure returns (bytes32)

// User-facing
function executePlan(
  ExecutionPlan calldata plan,
  address user,
  string calldata attestationChatID,
  string calldata auditRootHash
) external

// Admin (onlyOwner)
function updateSolverKey(address newKey) external     // rotate enclave key
function updateFee(uint256 newBps) external           // max 100 bps
function updateFeeRecipient(address) external
function transferOwnership(address newOwner) external

// Events
event IntentExecuted(
  bytes32 indexed intentHash, address indexed user,
  address tokenIn, address tokenOut,
  uint256 amountIn, uint256 amountOut,
  string attestationChatID, string auditRootHash
)
event SolverKeyUpdated(address oldKey, address newKey)
event FeeUpdated(uint256 oldBps, uint256 newBps)
```

### 5.3 TypeScript SDK (`@veilsolver/sdk` / `frontend/src/lib/solver.ts`)

```typescript
function buildIntent(params: {
  tokenIn: string; tokenOut: string; amountIn: string  // human-readable e.g. "100"
  decimalsIn: number; maxSlippageBps: number
  userAddress: string; chainId: number
}): TradingIntent

async function encryptIntent(
  intent: TradingIntent,
  solverPublicKey: string  // hex compressed secp256k1
): Promise<string>

async function callSolverAPI(
  intent: TradingIntent,
  encryptedIntent: string
): Promise<SolveResponse>

async function submitSettlement(
  solveResult: SolveResponse,
  contractAddress: string,
  signer: ethers.Signer
): Promise<ethers.TransactionReceipt | null>
```

---

## 6. Design Principles

### P1 — Privacy Is Architecture, Not Policy

| Guarantee | Enforcement |
|---|---|
| Intent contents private | ECIES encryption — only enclave key decrypts |
| Strategy logic private | TeeML — host cannot read enclave memory |
| Execution plan authentic | ECDSA — contract verifies via ecrecover |
| Audit record immutable | 0G Storage merkle root — content-addressed, tamper-evident |
| No replay | onchain mapping — EVM state is final |

Plaintext in a private DB = policy promise. ECIES in 0G Storage = architecture guarantee.

### P2 — TEE Is the Trust Root, Not the Operator

Fully compromised server: encrypted intents remain unreadable, contract rejects unsigned plans, 0G Storage records are immutable, past executions are already final.

Operator CAN: deny service, see request volume.
Operator CANNOT: read intent contents, forge valid plans, alter audit records.

### P3 — Fail Loud on Security, Fail Soft on Availability

```
HARD FAILS (always revert/throw):
  Invalid solver signature, expired deadline, replay, slippage exceeded

SOFT FAILS (log, continue):
  0G Storage upload fails → empty auditRootHash
  processResponse() fails → isVerified=false, still return plan
  Provider balance low → SDK auto-tops-up
  Attestation chatID missing → isVerified=false
```

Never sacrifice security for uptime.

### P4 — Intent vs Execution vs Settlement

```
INTENT:     User defines WHAT → TradingIntent { tokenIn, tokenOut, amountIn, slippage, deadline }
EXECUTION:  TEE decides HOW  → ExecutionPlan { minAmountOut, route, deadline, signature }
SETTLEMENT: Chain enforces   → VeilSolver.sol + DEX Router execute and verify
```

Bad solver can produce poor routing; contract still enforces `minAmountOut`. Worst case = liveness failure, not fund loss.

### P5 — Composability Over Vertical Integration

VeilSolver is infrastructure with no opinion on strategies, assets, or rebalancing. SDK integration is intentionally minimal: `callSolverAPI() + submitSettlement()` = two-hour integration for any protocol.

### P6 — Onchain Data Is Minimal and Permanent

```
ONCHAIN:          solverKey, executedIntents mapping, IntentExecuted events
0G STORAGE:       full AuditRecord, attestation, execution plan, outcome
NOT STORED:       plan.reasoning (strategy), plaintext intent contents
```

Store only what must be verified onchain. Link everything else via merkle root hash.

### P7 — Deterministic Signatures, Non-Deterministic Reasoning

Plan hash = deterministic (contract verifies). LLM reasoning = non-deterministic (stays private). Onchain verifiability without exposing AI reasoning.

---

## 7. Security Model

| Threat Actor | Can Do | Cannot Do |
|---|---|---|
| MEV Bot | — | Read encrypted intents |
| Malicious Operator | Deny service, see request volume | Read intents, forge plans |
| Compromised 0G Provider | Deny inference | Read enclave memory (TDX guarantee) |
| Malicious DEX Router | Bounded loss (minAmountOut enforced) | Exceed declared slippage |
| Replaying Attacker | Submit past plans to contract | Execute (executedIntents mapping blocks) |
| Curious Auditor | Read attestation receipts | Read encrypted intent contents |

**Front-running/Sandwich:** `minAmountOut` enforced. Sandwich back-run fails if price pushed below minOut — bot loses gas on the back leg.

**Strategy Inference:** Encrypted intents reveal nothing. Route visible onchain but not the signal that produced it. Route patterns over time may leak partial signal — acceptable for MVP.

**TEE Side-Channel:** Intel TDX hardware mitigations. Known attacks require physical hardware access.

**Signature Forgery:** `ecrecover(planHash, sig) == solverKey` enforced by contract. Computationally infeasible.

**Solver Key Compromise:** Rotate via `updateSolverKey()` from owner wallet immediately. Past executions are already final — cannot be retroactively invalidated.

---

## 8. Error Handling

### API Layer
```typescript
try {
  res.json(await solveIntent(intent))
} catch (err: any) {
  console.error("[Server] Solve failed:", err.message)
  res.status(500).json({ error: err.message })
}
```

### Storage Failures (Non-Fatal)
```typescript
let auditRootHash = ""
try {
  auditRootHash = await storeAuditRecord(record, key)
} catch (storageErr) {
  // DELIBERATE: storage failure does not block the solve
  console.error("[Server] Storage failed (non-fatal):", storageErr)
}
```

### Contract Errors (Fatal — Revert)
```solidity
require(block.timestamp <= plan.deadline, "VeilSolver: intent expired")
require(!executedIntents[plan.intentHash], "VeilSolver: intent already executed")
require(recovered == solverKey, "VeilSolver: invalid solver signature")
```

Frontend catches ethers `TransactionRevertedError` and displays the revert reason.

### Frontend Error Messages
```
Network error      → "Cannot reach solver API. Check connection."
Invalid plan JSON  → "Solver returned invalid plan. Try again."
TEE not verified   → Warning only (yellow) — non-blocking on testnet
Storage failed     → Step marked warning, solve continues
Contract revert    → Show revert reason from ethers error
User rejected tx   → "Transaction rejected in wallet."
Slippage exceeded  → "Price moved. Increase slippage or retry."
```

---

## 9. State Management

### Frontend (React useState — all in `page.tsx`)
```typescript
wallet, address, tokenIn, tokenOut, amount, slippage,
steps, result, txHash, running, error
```

No Redux/Zustand for MVP. If app grows to multiple pages (audit viewer, strategy marketplace), introduce Zustand at that point.

### API Singleton (`inference.ts`)
```typescript
let brokerInstance: any = null  // initialized once on first request
// createZGComputeNetworkBroker() = ~2s + onchain ledger setup
// Requests are sequential (~5s each) — no concurrency issues
```

### Contract State
```solidity
mapping(bytes32 => bool) public executedIntents  // permanent
address public solverKey      // updateSolverKey()
uint256 public feeBps         // updateFee()
address public feeRecipient   // updateFeeRecipient()
```

---

## 10. 0G Integration

### 0G Compute
```
Package:   @0glabs/0g-serving-broker
Provider:  GLM-5-FP8 (TeeML) — mainnet: 0xd9966e...
           qwen-2.5-7b-instruct — testnet
Endpoint:  broker.inference.getServiceMetadata(provider) → { endpoint, model }
Auth:      broker.inference.getRequestHeaders(provider)  → { Authorization: ... }
Call:      fetch(endpoint + "/chat/completions", { headers, body })
Verify:    broker.inference.processResponse(provider, chatID) → boolean
Fee:       1 0G/1M input tokens, 3.2 0G/1M output tokens (mainnet GLM-5-FP8)

Funding:
  broker.ledger.depositFund(10)
  broker.ledger.transferFund(provider, "inference", 2n * 10n**18n)

Rate limits: 30 req/min, 5 concurrent — VeilSolver is single-tenant, effectively unlimited.
```

### 0G Storage
```
Package:   @0gfoundation/0g-ts-sdk
Indexer:   https://indexer-storage-testnet-turbo.0g.ai (testnet)
           https://indexer-storage-turbo.0g.ai (mainnet)
Upload:    indexer.upload(MemData, rpcUrl, signer) → [tx, err]
Retrieve:  indexer.download(rootHash, outputPath, withProof) → err
Encrypt:   indexer.upload(file, rpcUrl, signer, { encryption: { type: 'ecies', recipientPubKey } })

Each audit record = one upload. rootHash = retrieval key. No DB needed.
Retrieval: query IntentExecuted events → extract auditRootHash → fetch from storage.
```

### 0G Chain
```
Testnet:  chainId 16602, https://evmrpc-testnet.0g.ai
Mainnet:  chainId 16661, https://evmrpc.0g.ai
Explorer: https://chainscan.0g.ai (mainnet)
          https://chainscan-galileo.0g.ai (testnet)
EVM:      Cancun-compatible (--evm-version cancun in Foundry)
Tools:    Foundry (forge, cast), Hardhat compatible
Faucet:   https://faucet.0g.ai (testnet only)
```

---

## 11. Testing Strategy

### Contract Unit Tests (Foundry — `test/VeilSolver.t.sol`)
```solidity
test_executePlan_validSignature()      // valid plan executes
test_executePlan_replayReverts()       // replay attack blocked
test_executePlan_wrongSignerReverts()  // wrong key rejected
test_executePlan_expiredReverts()      // expired deadline blocked
test_executePlan_feeCollected()        // fee math correct
test_executePlan_slippageReverts()     // minAmountOut enforced (mock DEX returns less)
test_signatureCompatibility()          // TS sig verifies in Sol (forge test --ffi)
```

### API Integration Tests (`solver-api/src/__tests__/integration.test.ts`)
```
- GET /health returns 200
- POST /solve with valid intent returns plan + signature
- POST /solve with missing fields returns 400
- Returned signature verifies against plan hash
- attestation.chatID is non-empty string
- auditRootHash is non-empty string
Set NETWORK=testnet in .env — runs against real 0G Compute.
```

### E2E (Manual — Hackathon)
```
1. pnpm dev in solver-api/ and frontend/
2. MetaMask → 0G testnet (chainId 16602), get testnet USDC from faucet
3. Submit: 10 USDC → WETH, 1% slippage
4. Verify: all 5 steps turn green
5. Verify: txHash on chainscan-galileo.0g.ai
6. Verify: auditRootHash on storagescan
7. Verify: IntentExecuted event has correct chatID
```

---

## 12. Deployment Runbook

### Step 1 — Get testnet tokens
```bash
# Visit https://faucet.0g.ai
cast balance <ADDRESS> --rpc-url https://evmrpc-testnet.0g.ai
```

### Step 2 — Fund 0G Compute
```bash
pnpm add @0glabs/0g-serving-broker -g
0g-compute-cli setup-network          # select testnet
0g-compute-cli login                  # enter private key
0g-compute-cli deposit --amount 10
0g-compute-cli inference list-providers    # copy provider address
0g-compute-cli transfer-fund --provider <ADDR> --amount 2
0g-compute-cli inference verify --provider <ADDR>   # confirm TeeML status
```

### Step 3 — Deploy contract
```bash
cd contracts && forge install foundry-rs/forge-std --no-commit

export SOLVER_PRIVATE_KEY=0x...
export SOLVER_ADDRESS=$(cast wallet address $SOLVER_PRIVATE_KEY)
export DEX_ROUTER=0x...       # Uniswap V3 fork address on 0G Chain
export NETWORK=testnet

forge script script/Deploy.s.sol \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --broadcast --evm-version cancun -vvvv

export CONTRACT_ADDRESS=0x...

forge verify-contract \
  --chain-id 16602 --verifier custom \
  --verifier-api-key PLACEHOLDER \
  --verifier-url https://chainscan-galileo.0g.ai/open/api \
  --evm-version cancun \
  $CONTRACT_ADDRESS src/VeilSolver.sol:VeilSolver
```

### Step 4 — Solver API
```bash
cd solver-api && cp .env.example .env
# .env: SOLVER_PRIVATE_KEY=0x..., GLM5_PROVIDER_ADDRESS=0x..., NETWORK=testnet, PORT=4000
pnpm install && pnpm dev
curl http://localhost:4000/health
```

### Step 5 — Frontend
```bash
cd frontend
cat > .env.local << EOF
NEXT_PUBLIC_SOLVER_API=http://localhost:4000
NEXT_PUBLIC_CONTRACT_ADDRESS=$CONTRACT_ADDRESS
NEXT_PUBLIC_SOLVER_PUBKEY=$(cast wallet public-key $SOLVER_PRIVATE_KEY)
EOF
pnpm install && pnpm dev   # http://localhost:3000
```

### Step 6 — Mainnet deploy
Repeat steps 2–5 with `NETWORK=mainnet`, RPC `https://evmrpc.0g.ai`, chainId `16661`, explorer `https://chainscan.0g.ai`.

---

## 13. Known Limitations & Roadmap

### MVP Limitations

**Solver key = regular wallet (not enclave-generated):** Stored in `.env`. Operator could theoretically sign arbitrary plans. Architecture supports upgrade: rotate via `updateSolverKey()` to enclave-generated address without redeploying.

**No on-chain TDX attestation:** Contract verifies ECDSA only. Full on-chain TDX quote verification requires precompile/ZK-attestation not yet on 0G Chain. MVP relays chatID in event — anyone can verify via 0G's attestation API using that chatID.

**No price oracle — LLM computes minAmountOut:** Imprecise, may lag real market. Safe (slippage still enforced) but may produce suboptimal fills. Production: feed signed Chainlink data into enclave.

**Single DEX, single chain:** Multi-hop routing + cross-chain settlement = v2.

### Roadmap

```
v1 (Hackathon MVP):
  ✓ Encrypted intents, TEE inference (GLM-5-FP8 TeeML), ECDSA plan signing
  ✓ 0G Chain settlement, 0G Storage audit trail, Next.js demo UI

v2 (Post-hackathon):
  → Enclave-generated solver key (never exported)
  → Signed oracle price feeds into enclave
  → Multi-route split execution
  → Cross-chain settlement via bridge adapters
  → Strategy author SDK (deploy custom models into enclave)

v3 (Production):
  → On-chain TDX attestation verification
  → Institutional compliance toolkit
  → Token economics (solver staking, governance)
  → Multi-chain indexing of audit records
```

---

## 14. Development Plan

Strategy Registry ships WITH the SDK — not after. Without it, SDK is just a wrapper around hardcoded logic. Together they form the full pitch.

### Build Order

```
Step 1 — sdk/ package scaffold
  sdk/package.json, tsconfig.json, src/index.ts

Step 2 — shared types update
  Add strategyId?: string to TradingIntent

Step 3 — SDK core functions
  sdk/src/intent.ts     buildIntent()
  sdk/src/encrypt.ts    encryptIntent()
  sdk/src/client.ts     callSolverAPI()
  sdk/src/settle.ts     submitSettlement() + ERC20 approve
  sdk/src/errors.ts     SolverAPIError, SettlementError, EncryptionError
  sdk/src/index.ts      VeilSolverClient class wrapping all above

Step 4 — SDK Strategy Registry functions (same sprint as Step 3)
  sdk/src/strategy.ts   uploadStrategy(prompt, solverPubkey, signer) → strategyId
                        fetchStrategy(strategyId) → encrypted blob (for verification)

Step 5 — solver-api changes
  inference.ts          accept strategyId, fetch encrypted blob from 0G Storage,
                        decrypt inside TEE, use as system prompt
                        fallback to default hardcoded prompt if strategyId absent

Step 6 — frontend changes
  Strategy upload UI    text area for system prompt → uploadStrategy() → show strategyId
  Intent form           strategyId selector (dropdown of registered strategies or paste custom)

Step 7 — verify end-to-end
  Upload strategy → get strategyId
  Submit intent with strategyId → TEE uses that strategy → settlement on 0G Chain
  Confirm: different strategies produce different plans for same intent
```

---

### SDK Package Design

```
sdk/
  src/
    index.ts        VeilSolverClient class + named exports
    client.ts       callSolverAPI() — configurable apiUrl, not env var
    intent.ts       buildIntent() — configurable deadlineSeconds
    encrypt.ts      encryptIntent() — ECIES
    settle.ts       submitSettlement() — ERC20 approve + executePlan()
    strategy.ts     uploadStrategy(), listStrategies()
    audit.ts        fetchUserHistory() — decrypt intents from 0G Storage
    errors.ts       SolverAPIError, SettlementError, EncryptionError, StrategyError
  package.json
  tsconfig.json
```

**VeilSolverClient interface:**

```typescript
const solver = new VeilSolverClient({
  apiUrl: "https://solver.veilsolver.xyz",
  contractAddress: "0x...",
  solverPublicKey: "0x..."
})

// One-shot: encrypts intent, calls API, approves ERC20, settles onchain
const receipt = await solver.solve({ tokenIn, tokenOut, amountIn, decimalsIn,
                                     maxSlippageBps, strategyId, signer })

// Strategy management
const strategyId = await solver.uploadStrategy({ prompt: "...", signer })

// Audit
const history = await solver.fetchHistory({ address, signer })
```

---

### Strategy Registry Design

**Why Strategy Registry ships with SDK:**
Without it, all integrators share the same hardcoded `inference.ts` system prompt. SDK value prop collapses — every project gets identical routing logic. Competitors can still infer strategy from patterns.

**Flow:**

```
Strategy author (protocol/fund):
  1. Writes system prompt — the IP ("when funding rate < -0.01%, reduce WETH 20%...")
  2. Calls solver.uploadStrategy({ prompt, signer })
     → ECIES encrypt with solverPublicKey
     → upload encrypted blob to 0G Storage
     → returns strategyId (merkle root hash)
  3. Shares strategyId with their users (public — blob is encrypted, safe to share)

Runtime (per trade):
  Intent includes strategyId
  ↓
  inference.ts receives strategyId
  ↓
  TEE fetches encrypted blob from 0G Storage by strategyId
  ↓
  TEE decrypts using enclave private key (only possible inside TDX)
  ↓
  Decrypted prompt used as system prompt for GLM-5-FP8
  ↓
  strategyHash included in plan → covered by solver ECDSA signature
  ↓
  Verifiable: which strategy ran, without revealing what it contains
```

**No onchain StrategyRegistry.sol needed for hackathon.** strategyId = 0G Storage root hash. Sufficient for demo. Can add onchain registry in v2 for discovery/permissions.

**inference.ts change:**

```typescript
// Before (hardcoded):
const systemPrompt = `You are a DeFi execution optimizer...`

// After (Strategy Registry):
let systemPrompt = DEFAULT_SYSTEM_PROMPT
if (intent.strategyId) {
  const encrypted = await fetchFromStorage(intent.strategyId)
  systemPrompt = decryptInsideEnclave(encrypted, enclavePrivateKey)
}
```

---

### Post-SDK TODOs (after full flow verified)

**Audit Viewer**
Frontend page: connect wallet → query IntentExecuted events → fetch AuditRecords from 0G Storage → ECIES decrypt encryptedIntent with user wallet key → show full history.
Files: `frontend/src/app/audit/page.tsx`, `sdk/src/audit.ts`

**Relayer Mode**
Solver API submits executePlan() on behalf of user via private RPC — closes mempool exposure gap.
Requires: EIP-712 user authorization + 0G Chain private RPC endpoint (confirm with 0G team).
Files: `solver-api/src/server.ts` (POST /relay), `sdk/src/client.ts`

**Strategy Performance Analytics**
Query IntentExecuted events → per-strategy stats (avg slippage, success rate, volume).
Public aggregate stats, private inputs. Demo: "strategy A outperforms B by 0.3% slippage."
Files: `frontend/src/app/analytics/page.tsx`, `sdk/src/analytics.ts`

---

*Last updated: April 2026 | 0G APAC Hackathon — Track 5: Privacy & Sovereign Infrastructure*
