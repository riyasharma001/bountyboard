# BountyBoard

Post tasks with XLM rewards locked in escrow. Hunters claim and submit their work. The poster reviews and approves — the reward releases automatically. Rejection reopens the bounty for another hunter.

## Live Links

| | |
|---|---|
| **Frontend** | `https://bountyboard-nine.vercel.app` |
| **Contract** | `https://stellar.expert/explorer/testnet/contract/CDCWS7RXOEX4XMENW4U4IKYCLVDRBSIN4IXVKNNOQ3X3P43GQCTOKUW5` |

## Lifecycle

```
Open → [hunter claims] → InReview → [poster approves] → Paid
                                  → [poster rejects]  → Open (again)
Open → [poster cancels] → Cancelled (refunded)
```

## Contract Functions

```rust
post_bounty(poster, title, description, reward: i128, xlm_token) -> u64
claim_bounty(hunter, bounty_id, claim_note)
approve_claim(poster, bounty_id, xlm_token)  // pays hunter
reject_claim(poster, bounty_id)              // reopens bounty
cancel_bounty(poster, bounty_id, xlm_token)  // refunds poster
get_bounty(id) -> Bounty
get_open_list() -> Vec<u64>
count() -> u64
```

## Stack

| Layer | Tech |
|---|---|
| Contract | Rust + Soroban SDK v22 |
| Network | Stellar Testnet |
| Frontend | React 18 + Vite |
| Wallet | Freighter v1.7.1 |
| Hosting | Vercel |

## Run Locally

```bash
chmod +x scripts/deploy.sh && ./scripts/deploy.sh
cd frontend && npm install && npm run dev
```
