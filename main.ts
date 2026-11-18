// Dip-recovery cbBTC bot for make.fun's "Race a BTC trading bot live for 24 hours"
// (btc-race-24h-20261118-1444).
//
// Strategy (chosen by a cross-regime search on the two published 24h windows:
// the race's own dev window, a down day -2.81%, and the previous race's window,
// an up day +0.49% — the bot is positive on both, which is what the unseen
// live window rewards):
//   - Entry: the close is at least 110 bps below the highest close of the last
//     120 bars AND the 5-minute return is no worse than -4 bps (the fall has
//     paused). One position, full cash.
//   - Exit: the whole position on a +150 bps take profit, a -150 bps stop, or
//     600 bars held, whichever comes first.
//   - Fallback: if no trade has ever filled and the run reaches bar 1200, buy
//     a shallower dip (>= 60 bps below the 120-bar high) once the 5-minute
//     return is flat or positive, so the run always makes at least one trade
//     (the harness's min_trades guardrail).
// Integer (BigInt) math only, fully deterministic, standard library only.
// No network, no clock, no files, no randomness.

import { runBars, type BarsState, type Batch } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const BPS = 10_000n;
const HI_WIN = 120; // bars of history the dip is measured against
const DIP_BPS = 110n; // entry: close this far below the 120-bar high
const GATE_BPS = -4n; // entry: 5-minute return no worse than this
const TP_BPS = 150n; // exit: take profit above the average cost
const STOP_BPS = 150n; // exit: stop below the average cost
const HOLD_BARS = 600; // exit: longest a position is held
const FB_BAR = 1200; // fallback: earliest bar it may fire on
const FB_DIP_BPS = 60n; // fallback: shallower dip
const FB_GATE_BPS = 0n; // fallback: 5-minute return flat or better
const MAX_SLIPPAGE_BPS = 100; // 1% past the close the order was decided on

/** Python-style floor division for BigInt (b > 0); the backtester this bot was
 *  validated against floors negative quotients, while BigInt `/` truncates. */
function floorDiv(a: bigint, b: bigint): bigint {
  return a >= 0n ? a / b : -((-a + b - 1n) / b);
}

/** Closes seen so far, in bar order (one per batch that carries a CBBTC bar). */
const closes: bigint[] = [];
/** Seq of the batch the current position's buy was decided on (-1 when flat). */
let entrySeq = -1;
/** True once any buy of this run has filled. */
let everTraded = false;

/** Highest close of the 120 bars before the current one, or null without them. */
function highBefore(): bigint | null {
  const n = closes.length;
  if (n < HI_WIN + 1) return null;
  let hi = closes[n - HI_WIN - 1]!;
  for (let i = n - HI_WIN; i < n - 1; i++) {
    if (closes[i]! > hi) hi = closes[i]!;
  }
  return hi;
}

/** Return of the current close against the close 5 bars back, in bps. */
function ret5Bps(): bigint | null {
  const n = closes.length;
  if (n < 6) return null;
  const c = closes[n - 1]!;
  const p = closes[n - 6]!;
  return floorDiv((c - p) * BPS, p);
}

/**
 * What a buy may spend this reply: the cash on hand, capped by the harness's
 * own weight room for the symbol (caps.max_weight_bps of equity, less any
 * position already held), and only when it meets the minimum notional. With
 * this competition's caps (max weight 100% of equity, minimum $1) that is the
 * whole cash balance, but the caps are read from hello rather than assumed,
 * so the same code stays inside the rules if a later competition tightens them.
 */
function buyAmount(state: BarsState): bigint | null {
  const room = state.weightRoom(SYMBOL);
  const spend = state.cash < room ? state.cash : room;
  const minNotional = BigInt(state.hello.fees.min_notional_quote_units);
  return spend >= minNotional ? spend : null;
}

await runBars({
  onBatch(state: BarsState, batch: Batch) {
    // A warm-up's orders are all rejected; send none (indicators still seed).
    if (state.warmingUp) return [];
    for (const f of batch.fills) {
      if (f.side === 'buy' && f.status === 'filled') everTraded = true;
    }
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return [];
    closes.push(BigInt(bar.c));
    const c = closes[closes.length - 1]!;
    const pos = state.positions.get(SYMBOL);

    if (pos !== undefined && pos.qty > 0n) {
      // Holding: average cost in quote units per unit, truncated like the
      // backtester (cost and qty are both positive, so this is exact).
      const avg = (pos.cost * 10n ** 7n) / pos.qty;
      const held = state.seq - entrySeq;
      if (
        c * BPS >= avg * (BPS + TP_BPS) ||
        c * BPS <= avg * (BPS - STOP_BPS) ||
        held >= HOLD_BARS
      ) {
        return [{ side: 'sell', symbol: SYMBOL, qty: pos.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    // Flat: need enough history for the dip and the 5-minute return.
    const hi = highBefore();
    const r5 = ret5Bps();
    if (hi === null || r5 === null) return [];
    const dip = floorDiv((hi - c) * BPS, hi);
    const spend = buyAmount(state);
    if (spend === null) return [];

    // Main entry: deep dip with the fall paused.
    if (dip >= DIP_BPS && r5 >= GATE_BPS) {
      entrySeq = state.seq;
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    // Fallback: only if this run has never traded, late in the window, on a
    // shallower dip that has already stabilised.
    if (!everTraded && state.seq >= FB_BAR && dip >= FB_DIP_BPS && r5 >= FB_GATE_BPS) {
      entrySeq = state.seq;
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
