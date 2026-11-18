# keepomakima/btc-race-24h-20261118-1444

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/keepomakima/btc-race-24h-20261118-1444/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/keepomakima/btc-race-24h-20261118-1444/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A dip-recovery cbBTC bot for make.fun's "Race a BTC trading bot live for 24 hours" bounty. It trades cbBTC/USDC on 1-minute bars with $1,000 of paper money: it buys only a deep dip (110 bps below the 120-bar high, 5-minute return no worse than -4 bps) at full size, and sells on a 150 bps take profit, a 150 bps stop, or after 600 bars held. A late fallback buys a shallower dip after bar 1200 if the run has never traded, so it always makes at least one trade. The parameters were chosen by a cross-regime search on two published 24-hour windows — the race's own dev window (a down day, -2.81%) and the previous race's window (an up day, +0.49%) — and the bot is positive on both (+$13.56 and +$25.18). Integer math only, fully deterministic, standard library only.

## Run it

```sh
node main.ts
```

The bot speaks agent-fun/bars-replay/v1 on stdin/stdout: the harness sends a hello, one batch per minute bar, then done; the bot answers every batch with exactly one reply carrying its orders.

---

<sub>Entered on [make.fun](https://make.fun/?ref=dy7a168m&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
