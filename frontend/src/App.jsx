import { useState, useEffect } from 'react'
import {
  connectWallet, postBounty, claimBounty, approveClaim,
  rejectClaim, cancelBounty, getBounty, getOpenList,
  getBountyCount, xlm, short, timeAgo, CONTRACT_ID,
} from './lib/stellar'

// ── Status badge ───────────────────────────────────────────────────────────
const STATUS_CFG = {
  Open:       { label: 'OPEN',      cls: 'badge-open'      },
  InReview:   { label: 'IN REVIEW', cls: 'badge-review'    },
  Paid:       { label: 'PAID',      cls: 'badge-paid'      },
  Cancelled:  { label: 'CANCELLED', cls: 'badge-cancelled' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { label: status, cls: '' }
  return <span className={`status-badge ${cfg.cls}`}>{cfg.label}</span>
}

// ── Reward tag ─────────────────────────────────────────────────────────────
function RewardTag({ reward }) {
  return (
    <div className="reward-tag">
      <span className="rt-xlm">{xlm(reward)}</span>
      <span className="rt-unit">XLM</span>
    </div>
  )
}

// ── Bounty card ────────────────────────────────────────────────────────────
function BountyCard({ bounty, wallet, onAction, expanded, onToggle }) {
  const [claimNote, setClaimNote] = useState('')
  const [busy,      setBusy]      = useState(false)

  const isPoster    = wallet && bounty.poster?.toString() === wallet
  const isHunter    = wallet && bounty.hunter?.toString() === wallet
  const canClaim    = wallet && bounty.status === 'Open' && !isPoster
  const canApprove  = isPoster && bounty.status === 'InReview'
  const canCancel   = isPoster && bounty.status === 'Open'

  const handle = async (fn, msg) => {
    setBusy(true)
    try {
      const hash = await fn()
      onAction({ ok: true, msg, hash, refresh: true })
    } catch (e) { onAction({ ok: false, msg: e.message }) }
    finally { setBusy(false) }
  }

  return (
    <div
      className={`bounty-card ${bounty.status !== 'Open' ? 'card-dim' : ''} ${expanded ? 'card-expanded' : ''}`}
      onClick={!expanded ? onToggle : undefined}
    >
      <div className="bc-top">
        <div className="bc-left">
          <div className="bc-meta">
            <span className="bc-id">#{bounty.id?.toString().padStart(4,'0')}</span>
            <StatusBadge status={bounty.status} />
            <span className="bc-time">{timeAgo(bounty.created_at)}</span>
          </div>
          <h3 className="bc-title">{bounty.title}</h3>
          <div className="bc-poster">by {short(bounty.poster)}</div>
        </div>
        <div className="bc-right">
          <RewardTag reward={bounty.reward} />
          <button
            className="bc-toggle"
            onClick={e => { e.stopPropagation(); onToggle() }}
          >
            {expanded ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="bc-body" onClick={e => e.stopPropagation()}>
          <p className="bc-desc">{bounty.description}</p>

          {/* Hunter submission */}
          {bounty.status === 'InReview' && (
            <div className="submission-box">
              <div className="sub-header">
                <span className="sub-label">SUBMISSION</span>
                <span className="sub-hunter">by {short(bounty.hunter)}</span>
              </div>
              <p className="sub-note">{bounty.claim_note}</p>
            </div>
          )}

          {bounty.status === 'Paid' && bounty.hunter && (
            <div className="paid-box">
              <span className="paid-icon">✓</span>
              Paid {xlm(bounty.reward)} XLM to {short(bounty.hunter)}
            </div>
          )}

          {/* Actions */}
          <div className="bc-actions">
            {canClaim && (
              <div className="claim-area">
                <textarea
                  className="claim-input"
                  value={claimNote}
                  onChange={e => setClaimNote(e.target.value)}
                  placeholder="Describe your work or link your submission…"
                  rows={3}
                  maxLength={400}
                  disabled={busy}
                />
                <button
                  className="btn-claim"
                  disabled={busy || !claimNote.trim()}
                  onClick={() => handle(
                    () => claimBounty(wallet, bounty.id, claimNote),
                    `Claimed bounty #${bounty.id}`
                  )}
                >
                  {busy ? 'Submitting…' : 'Submit Claim'}
                </button>
              </div>
            )}

            {canApprove && (
              <div className="review-actions">
                <button className="btn-approve" disabled={busy}
                  onClick={() => handle(
                    () => approveClaim(wallet, bounty.id),
                    `Approved! ${xlm(bounty.reward)} XLM paid to hunter`
                  )}>
                  {busy ? '…' : `✓ Approve · Pay ${xlm(bounty.reward)} XLM`}
                </button>
                <button className="btn-reject" disabled={busy}
                  onClick={() => handle(
                    () => rejectClaim(wallet, bounty.id),
                    'Submission rejected, bounty re-opened'
                  )}>
                  {busy ? '…' : '✗ Reject'}
                </button>
              </div>
            )}

            {canCancel && (
              <button className="btn-cancel-bounty" disabled={busy}
                onClick={() => handle(
                  () => cancelBounty(wallet, bounty.id),
                  'Bounty cancelled, reward refunded'
                )}>
                {busy ? '…' : 'Cancel Bounty'}
              </button>
            )}

            {isHunter && bounty.status === 'InReview' && !canApprove && (
              <div className="awaiting-review">
                <span>⏳</span> Your submission is under review
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Post form ──────────────────────────────────────────────────────────────
function PostForm({ wallet, onPosted }) {
  const [title, setTitle] = useState('')
  const [desc,  setDesc]  = useState('')
  const [reward, setReward] = useState('5')
  const [busy, setBusy]   = useState(false)
  const [err,  setErr]    = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const hash = await postBounty(wallet, title, desc, parseFloat(reward))
      onPosted(hash)
      setTitle(''); setDesc(''); setReward('5')
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <form className="post-form" onSubmit={handleSubmit}>
      <div className="pf-header">POST A BOUNTY</div>
      <div className="pf-field">
        <label>TASK TITLE</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          maxLength={80} required disabled={!wallet || busy} />
      </div>
      <div className="pf-field">
        <label>DESCRIPTION</label>
        <textarea value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Describe the task in detail. Include acceptance criteria, deliverables, and any technical requirements."
          maxLength={400} rows={5} required disabled={!wallet || busy} />
        <span className="pf-chars">{desc.length}/400</span>
      </div>
      <div className="pf-field pf-reward-field">
        <label>REWARD (XLM)</label>
        <div className="reward-presets">
          {['1','5','10','25','50','100'].map(v => (
            <button key={v} type="button"
              className={`rp-btn ${reward === v ? 'rp-active' : ''}`}
              onClick={() => setReward(v)}>
              {v}
            </button>
          ))}
        </div>
        <input type="number" min="0.1" step="0.1"
          value={reward} onChange={e => setReward(e.target.value)}
          className="reward-custom" required disabled={!wallet || busy} />
        <span className="reward-unit">XLM</span>
      </div>
      <div className="pf-escrow-note">
        <span className="pen-icon">🔒</span>
        {reward} XLM will be locked in the smart contract until you approve a submission.
      </div>
      {err && <p className="pf-err">{err}</p>}
      <button type="submit" className="btn-post"
        disabled={!wallet || busy || !title || !desc}>
        {!wallet ? 'Connect wallet first' : busy ? 'Posting bounty…' : `Post Bounty · ${reward} XLM`}
      </button>
    </form>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function App() {
  const [wallet,       setWallet]       = useState(null)
  const [bounties,     setBounties]     = useState([])
  const [count,        setCount]        = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState('board')
  const [expanded,     setExpanded]     = useState(null)
  const [toast,        setToast]        = useState(null)
  const [filter,       setFilter]       = useState('all')

  const loadBoard = async () => {
    setLoading(true)
    try {
      const [ids, c] = await Promise.all([getOpenList(), getBountyCount()])
      setCount(c)
      const loaded = await Promise.allSettled(ids.map(id => getBounty(id)))
      setBounties(loaded.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadBoard() }, [])

  const handleConnect = async () => {
    try { setWallet(await connectWallet()) }
    catch (e) { showToast(false, e.message) }
  }

  const showToast = (ok, msg, hash) => {
    setToast({ ok, msg, hash })
    setTimeout(() => setToast(null), 6000)
  }

  const handleAction = ({ ok, msg, hash, refresh }) => {
    showToast(ok, msg, hash)
    if (ok && refresh) loadBoard()
  }

  const handlePosted = (hash) => {
    showToast(true, 'Bounty posted on-chain!', hash)
    setTab('board')
    loadBoard()
  }

  const filtered = filter === 'all'
    ? bounties
    : bounties.filter(b => b.status === filter)

  const openCount    = bounties.filter(b => b.status === 'Open').length
  const reviewCount  = bounties.filter(b => b.status === 'InReview').length
  const totalRewards = bounties.filter(b => b.status === 'Open')
    .reduce((s, b) => s + Number(b.reward), 0)

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="brand">
          <div className="brand-hex">◆</div>
          <div>
            <div className="brand-name">BountyBoard</div>
            <div className="brand-tag">on-chain task rewards</div>
          </div>
        </div>

        <div className="header-stats">
          <div className="hs">
            <span className="hs-n">{openCount}</span>
            <span className="hs-l">OPEN</span>
          </div>
          <div className="hs-div"/>
          <div className="hs">
            <span className="hs-n">{reviewCount}</span>
            <span className="hs-l">IN REVIEW</span>
          </div>
          <div className="hs-div"/>
          <div className="hs">
            <span className="hs-n">{xlm(totalRewards)}</span>
            <span className="hs-l">XLM AVAILABLE</span>
          </div>
        </div>

        <div className="header-right">
          {wallet
            ? <div className="wallet-pill"><span className="wdot" />{short(wallet)}</div>
            : <button className="btn-connect" onClick={handleConnect}>Connect Wallet</button>
          }
        </div>
      </header>

      {/* ── Subbar ── */}
      <div className="subbar">
        <nav className="tabs">
          <button className={`tab ${tab === 'board' ? 'tab-active' : ''}`} onClick={() => setTab('board')}>Board</button>
          <button className={`tab ${tab === 'post'  ? 'tab-active' : ''}`} onClick={() => setTab('post')}>+ Post Bounty</button>
        </nav>
        {tab === 'board' && (
          <div className="filters">
            {['all','Open','InReview','Paid'].map(f => (
              <button key={f}
                className={`filter-btn ${filter === f ? 'filter-active' : ''}`}
                onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f === 'InReview' ? 'In Review' : f}
              </button>
            ))}
            <button className="filter-btn filter-refresh" onClick={loadBoard}>↻</button>
          </div>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`toast ${toast.ok ? 'toast-ok' : 'toast-err'}`}>
          <span>{toast.msg}</span>
          {toast.hash && (
            <a href={`https://stellar.expert/explorer/testnet/tx/${toast.hash}`}
              target="_blank" rel="noreferrer" className="toast-link">TX ↗</a>
          )}
        </div>
      )}

      {/* ── Body ── */}
      <main className="main">
        {tab === 'post' && (
          <div className="post-wrap">
            {!wallet
              ? <div className="connect-prompt">
                  <div className="cp-hex">◆</div>
                  <div className="cp-title">Post a bounty with XLM in escrow.</div>
                  <p className="cp-sub">Anyone can claim it. You approve and the reward releases automatically.</p>
                  <button className="btn-connect-lg" onClick={handleConnect}>Connect Freighter</button>
                </div>
              : <PostForm wallet={wallet} onPosted={handlePosted} />
            }
          </div>
        )}

        {tab === 'board' && (
          loading ? (
            <div className="skeleton-list">
              {[1,2,3].map(i => <div key={i} className="bounty-skeleton" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-board">
              <div className="eb-hex">◆</div>
              <div className="eb-title">No bounties {filter !== 'all' ? `with status "${filter}"` : 'yet'}.</div>
              {filter === 'all' && <button className="btn-post-first" onClick={() => setTab('post')}>Post the first bounty</button>}
            </div>
          ) : (
            <div className="bounty-list">
              {filtered.map(b => (
                <BountyCard
                  key={b.id?.toString()}
                  bounty={b}
                  wallet={wallet}
                  onAction={handleAction}
                  expanded={expanded === b.id?.toString()}
                  onToggle={() => setExpanded(
                    expanded === b.id?.toString() ? null : b.id?.toString()
                  )}
                />
              ))}
            </div>
          )
        )}
      </main>

      <footer className="footer">
        <span>BountyBoard · Stellar Testnet · Soroban</span>
        <a href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
          target="_blank" rel="noreferrer">Contract ↗</a>
      </footer>
    </div>
  )
}
