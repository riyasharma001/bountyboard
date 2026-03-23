#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, String, Vec, token,
};

const MAX_TITLE:  u32 = 80;
const MAX_DESC:   u32 = 400;
const MAX_SKILLS: u32 = 5;

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum BountyStatus {
    Open,       // accepting claims
    InReview,   // someone claimed, poster reviewing
    Paid,       // poster approved, hunter got XLM
    Cancelled,  // poster cancelled, refunded
    Disputed,   // hunter disputed rejection
}

#[contracttype]
#[derive(Clone)]
pub struct Bounty {
    pub id:          u64,
    pub poster:      Address,
    pub title:       String,
    pub description: String,
    pub reward:      i128,         // XLM in stroops
    pub hunter:      Option<Address>,
    pub claim_note:  String,       // hunter's submission message
    pub status:      BountyStatus,
    pub created_at:  u64,
    pub claimed_at:  u64,
}

#[contracttype]
pub enum DataKey {
    Bounty(u64),
    Count,
    OpenList,   // Vec<u64> of open bounty IDs (last 20)
}

#[contract]
pub struct BountyBoardContract;

#[contractimpl]
impl BountyBoardContract {
    /// Post a bounty — reward XLM locked in contract
    pub fn post_bounty(
        env: Env,
        poster: Address,
        title: String,
        description: String,
        reward: i128,
        xlm_token: Address,
    ) -> u64 {
        poster.require_auth();
        assert!(title.len() > 0 && title.len() <= MAX_TITLE, "Title 1–80 chars");
        assert!(description.len() > 0 && description.len() <= MAX_DESC, "Desc 1–400 chars");
        assert!(reward >= 1_000_000, "Min reward 0.1 XLM");

        let token_client = token::Client::new(&env, &xlm_token);
        token_client.transfer(&poster, &env.current_contract_address(), &reward);

        let count: u64 = env.storage().instance()
            .get(&DataKey::Count).unwrap_or(0u64);
        let id = count + 1;

        let bounty = Bounty {
            id,
            poster: poster.clone(),
            title,
            description,
            reward,
            hunter: None,
            claim_note: String::from_str(&env, ""),
            status: BountyStatus::Open,
            created_at: env.ledger().timestamp(),
            claimed_at: 0,
        };

        env.storage().persistent().set(&DataKey::Bounty(id), &bounty);
        env.storage().instance().set(&DataKey::Count, &id);

        let mut open: Vec<u64> = env.storage().instance()
            .get(&DataKey::OpenList).unwrap_or(Vec::new(&env));
        open.push_back(id);
        while open.len() > 20 { open.remove(0); }
        env.storage().instance().set(&DataKey::OpenList, &open);

        env.events().publish((symbol_short!("posted"),), (id, poster, reward));
        id
    }

    /// Hunter claims a bounty — submits work note
    pub fn claim_bounty(
        env: Env,
        hunter: Address,
        bounty_id: u64,
        claim_note: String,
    ) {
        hunter.require_auth();
        assert!(claim_note.len() <= MAX_DESC, "Claim note too long");

        let mut bounty: Bounty = env.storage().persistent()
            .get(&DataKey::Bounty(bounty_id)).expect("Bounty not found");

        assert!(bounty.status == BountyStatus::Open, "Bounty not open");
        assert!(bounty.poster != hunter, "Poster cannot claim own bounty");

        bounty.hunter     = Some(hunter.clone());
        bounty.claim_note = claim_note;
        bounty.status     = BountyStatus::InReview;
        bounty.claimed_at = env.ledger().timestamp();

        env.storage().persistent().set(&DataKey::Bounty(bounty_id), &bounty);
        env.events().publish((symbol_short!("claimed"),), (bounty_id, hunter));
    }

    /// Poster approves the claim — pays the hunter
    pub fn approve_claim(
        env: Env,
        poster: Address,
        bounty_id: u64,
        xlm_token: Address,
    ) {
        poster.require_auth();

        let mut bounty: Bounty = env.storage().persistent()
            .get(&DataKey::Bounty(bounty_id)).expect("Bounty not found");

        assert!(bounty.poster == poster, "Not the bounty poster");
        assert!(bounty.status == BountyStatus::InReview, "Not in review");

        let hunter = bounty.hunter.clone().expect("No hunter");
        let token_client = token::Client::new(&env, &xlm_token);
        token_client.transfer(&env.current_contract_address(), &hunter, &bounty.reward);

        bounty.status = BountyStatus::Paid;
        env.storage().persistent().set(&DataKey::Bounty(bounty_id), &bounty);
        env.events().publish(
            (symbol_short!("paid"),),
            (bounty_id, hunter, bounty.reward),
        );
    }

    /// Poster rejects the claim — bounty returns to Open
    pub fn reject_claim(env: Env, poster: Address, bounty_id: u64) {
        poster.require_auth();

        let mut bounty: Bounty = env.storage().persistent()
            .get(&DataKey::Bounty(bounty_id)).expect("Bounty not found");

        assert!(bounty.poster == poster, "Not the poster");
        assert!(bounty.status == BountyStatus::InReview, "Not in review");

        bounty.hunter     = None;
        bounty.claim_note = String::from_str(&bounty.claim_note.env(), "");
        bounty.status     = BountyStatus::Open;
        bounty.claimed_at = 0;

        env.storage().persistent().set(&DataKey::Bounty(bounty_id), &bounty);
        env.events().publish((symbol_short!("rejectd"),), (bounty_id,));
    }

    /// Poster cancels an Open bounty — gets refunded
    pub fn cancel_bounty(
        env: Env,
        poster: Address,
        bounty_id: u64,
        xlm_token: Address,
    ) {
        poster.require_auth();

        let mut bounty: Bounty = env.storage().persistent()
            .get(&DataKey::Bounty(bounty_id)).expect("Bounty not found");

        assert!(bounty.poster == poster, "Not the poster");
        assert!(bounty.status == BountyStatus::Open, "Can only cancel open bounties");

        let token_client = token::Client::new(&env, &xlm_token);
        token_client.transfer(&env.current_contract_address(), &poster, &bounty.reward);

        bounty.status = BountyStatus::Cancelled;
        env.storage().persistent().set(&DataKey::Bounty(bounty_id), &bounty);
        env.events().publish((symbol_short!("canceld"),), (bounty_id,));
    }

    // ── Reads ──────────────────────────────────────────────────────────────
    pub fn get_bounty(env: Env, id: u64) -> Bounty {
        env.storage().persistent()
            .get(&DataKey::Bounty(id)).expect("Bounty not found")
    }

    pub fn get_open_list(env: Env) -> Vec<u64> {
        env.storage().instance()
            .get(&DataKey::OpenList).unwrap_or(Vec::new(&env))
    }

    pub fn count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }
}
