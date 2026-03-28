import { reactive } from 'vue'
import { createDeck, shuffle, deal, evaluateHand, compareHands, HAND_TYPE_NAMES } from './deck.js'
import { aiDecide } from './ai.js'

const INITIAL_CHIPS = 2000
const ANTE = 20
const MIN_BET = 20
const MAX_BET = 200
const MAX_BLIND_ROUNDS = 5 // AI最多闷牌5轮
const ALL_AI_NAMES = ['局座', '波哥', '鞭爷', '钱色', '金爷', '猫董', '群主', '盘总']
const AI_PERSONALITIES = ['aggressive', 'normal', 'cautious', 'aggressive', 'normal']

// 随机选取3-5个AI名字
function pickRandomAINames() {
  const count = 3 + Math.floor(Math.random() * 3) // 3, 4, or 5
  const shuffled = [...ALL_AI_NAMES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export function createGame() {
  const state = reactive({
    phase: 'idle', // idle, betting, showdown, gameover
    players: [],
    pot: 0,
    currentBet: MIN_BET,
    currentPlayerIndex: 0,
    dealerIndex: 0,
    roundNum: 1,
    gameLog: [],
    winner: null,
    showdown: false,
    waitingForPlayer: false,
    gameNumber: 0,
    lastResult: null,
  })

  function initPlayers() {
    const aiNames = pickRandomAINames()
    state.players = [
      {
        name: '你',
        chips: INITIAL_CHIPS,
        cards: [],
        folded: false,
        hasLooked: false,
        isAI: false,
        personality: 'normal',
        currentRoundBet: 0,
        blindRounds: 0,
        avatar: '🧑',
      },
      ...aiNames.map((name, i) => ({
        name,
        chips: INITIAL_CHIPS,
        cards: [],
        folded: false,
        hasLooked: false,
        isAI: true,
        personality: AI_PERSONALITIES[i % AI_PERSONALITIES.length],
        currentRoundBet: 0,
        blindRounds: 0,
        avatar: '🤖',
      }))
    ]
  }

  function addLog(msg) {
    state.gameLog.unshift(msg)
    if (state.gameLog.length > 50) state.gameLog.pop()
  }

  function startNewRound() {
    state.gameNumber++
    state.phase = 'betting'
    state.pot = 0
    state.currentBet = MIN_BET
    state.roundNum = 1
    state.winner = null
    state.showdown = false
    state.lastResult = null

    // 检查筹码不足的玩家
    for (const p of state.players) {
      if (p.chips < ANTE) {
        p.chips = INITIAL_CHIPS // 补充筹码
        addLog(`${p.name} 筹码不足，已重新补充到 ${INITIAL_CHIPS}`)
      }
    }

    // 重置玩家状态
    for (const p of state.players) {
      p.cards = []
      p.folded = false
      p.hasLooked = false
      p.currentRoundBet = 0
      p.blindRounds = 0
    }

    const numPlayers = state.players.length

    // 洗牌发牌
    const deck = shuffle(createDeck())
    const hands = deal(deck, numPlayers)
    for (let i = 0; i < numPlayers; i++) {
      state.players[i].cards = hands[i]
    }

    // 收底注
    for (const p of state.players) {
      p.chips -= ANTE
      p.currentRoundBet += ANTE
      state.pot += ANTE
    }

    // 轮转庄家
    state.dealerIndex = (state.dealerIndex + 1) % numPlayers
    state.currentPlayerIndex = (state.dealerIndex + 1) % numPlayers

    addLog(`--- 第 ${state.gameNumber} 局开始 ---`)
    addLog(`每人底注 ${ANTE}，奖池 ${state.pot}`)

    // 如果当前是AI，开始AI行动
    tryAIAction()
  }

  function getActivePlayers() {
    return state.players.filter(p => !p.folded)
  }

  function nextPlayer() {
    const total = state.players.length
    let next = (state.currentPlayerIndex + 1) % total
    let count = 0
    while (state.players[next].folded && count < total) {
      next = (next + 1) % total
      count++
    }
    state.currentPlayerIndex = next
  }

  function checkRoundEnd() {
    const active = getActivePlayers()
    if (active.length === 1) {
      // 只剩一人，直接赢
      const winner = active[0]
      state.winner = winner
      winner.chips += state.pot
      addLog(`${winner.name} 赢得了 ${state.pot} 筹码！（其他人弃牌）`)
      state.lastResult = {
        winner: winner.name,
        amount: state.pot,
        handType: HAND_TYPE_NAMES[evaluateHand(winner.cards).type],
        reason: '其他人弃牌'
      }
      state.phase = 'showdown'
      state.showdown = true
      return true
    }

    // 检查是否所有活跃玩家都已经行动过一轮（简化：每轮每人一次）
    return false
  }

  function resolveShowdown() {
    const active = getActivePlayers()
    let best = active[0]
    for (let i = 1; i < active.length; i++) {
      if (compareHands(active[i].cards, best.cards) > 0) {
        best = active[i]
      }
    }
    state.winner = best
    best.chips += state.pot
    const handType = HAND_TYPE_NAMES[evaluateHand(best.cards).type]
    addLog(`开牌！${best.name} 以【${handType}】赢得 ${state.pot} 筹码！`)

    for (const p of active) {
      const ht = HAND_TYPE_NAMES[evaluateHand(p.cards).type]
      addLog(`${p.name}: ${p.cards.map(c => c.suit + c.rank).join(' ')} (${ht})`)
    }

    state.lastResult = {
      winner: best.name,
      amount: state.pot,
      handType,
      reason: '开牌比大小'
    }
    state.phase = 'showdown'
    state.showdown = true
  }

  function playerAction(action, amount = 0) {
    if (state.phase !== 'betting' || !state.waitingForPlayer) return
    const player = state.players[0] // 玩家总是 index 0

    executeAction(player, action, amount)
    state.waitingForPlayer = false

    if (checkRoundEnd()) return

    nextPlayer()

    // 检查一轮是否结束
    checkBettingRound()

    // 继续AI行动
    tryAIAction()
  }

  function executeAction(player, action, amount = 0) {
    const costMultiplier = player.hasLooked ? 2 : 1

    switch (action) {
      case 'look':
        player.hasLooked = true
        addLog(`${player.name} 看了牌`)
        break

      case 'call': {
        if (!player.hasLooked) player.blindRounds++
        const cost = state.currentBet * costMultiplier
        const actual = Math.min(cost, player.chips)
        player.chips -= actual
        player.currentRoundBet += actual
        state.pot += actual
        addLog(`${player.name} 跟注 ${actual}${!player.hasLooked ? '（闷牌）' : ''}`)
        break
      }

      case 'raise': {
        if (!player.hasLooked) player.blindRounds++
        const raiseAmount = Math.min(Math.max(amount, state.currentBet + MIN_BET), MAX_BET)
        state.currentBet = raiseAmount
        const cost = raiseAmount * costMultiplier
        const actual = Math.min(cost, player.chips)
        player.chips -= actual
        player.currentRoundBet += actual
        state.pot += actual
        addLog(`${player.name} 加注到 ${raiseAmount}${!player.hasLooked ? '（闷牌）' : ''}`)
        break
      }

      case 'fold':
        player.folded = true
        addLog(`${player.name} 弃牌`)
        break
    }
  }

  let actionQueue = Promise.resolve()

  function tryAIAction() {
    actionQueue = actionQueue.then(() => processAIActions())
  }

  function processAIActions() {
    return new Promise(resolve => {
      function step() {
        if (state.phase !== 'betting') { resolve(); return }

        const current = state.players[state.currentPlayerIndex]

        if (!current.isAI) {
          state.waitingForPlayer = true
          resolve()
          return
        }

        if (current.folded) {
          nextPlayer()
          setTimeout(step, 100)
          return
        }

        // AI决策延时，增加体验感
        setTimeout(() => {
          if (state.phase !== 'betting') { resolve(); return }

          // AI闷牌达到上限，强制看牌
          const forceLooked = current.isAI && !current.hasLooked && current.blindRounds >= MAX_BLIND_ROUNDS
          if (forceLooked) {
            executeAction(current, 'look')
            addLog(`${current.name} 闷牌已达${MAX_BLIND_ROUNDS}轮，强制亮牌！`)
          }

          const decision = aiDecide(current, {
            currentBet: state.currentBet,
            pot: state.pot,
            roundNum: state.roundNum,
            activePlayers: getActivePlayers().length
          })

          if (decision.action === 'look' && !current.hasLooked) {
            executeAction(current, 'look')
            // 看牌后还要做决策
            const decision2 = aiDecide(current, {
              currentBet: state.currentBet,
              pot: state.pot,
              roundNum: state.roundNum,
              activePlayers: getActivePlayers().length
            })
            executeAction(current, decision2.action, decision2.amount)
          } else if (decision.action === 'look' && current.hasLooked) {
            // 已看牌就跟注
            executeAction(current, 'call')
          } else {
            executeAction(current, decision.action, decision.amount)
          }

          if (checkRoundEnd()) { resolve(); return }

          nextPlayer()
          checkBettingRound()
          setTimeout(step, 300)
        }, 600 + Math.random() * 800)
      }
      step()
    })
  }

  function checkBettingRound() {
    // 简化：每4次行动算一轮
    const active = getActivePlayers()
    // 如果超过8轮，强制开牌
    if (state.roundNum > 8) {
      resolveShowdown()
      return
    }
  }

  function forceShowdown() {
    if (state.phase === 'betting') {
      resolveShowdown()
    }
  }

  function incrementRound() {
    state.roundNum++
  }

  // 每次从玩家回到玩家，算一轮
  let actionCount = 0
  const originalNextPlayer = nextPlayer

  function isGameOver() {
    return state.players[0].chips <= 0
  }

  initPlayers()

  return {
    state,
    startNewRound,
    playerAction,
    forceShowdown,
    getActivePlayers,
    initPlayers,
    addLog,
  }
}
