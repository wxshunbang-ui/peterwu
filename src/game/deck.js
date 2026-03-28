// 扑克牌花色和点数
const SUITS = ['♠', '♥', '♣', '♦']
const SUIT_NAMES = { '♠': 'spade', '♥': 'heart', '♣': 'club', '♦': 'diamond' }
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
}

// 创建一副牌（去掉大小王）
export function createDeck() {
  const deck = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, value: RANK_VALUES[rank] })
    }
  }
  return deck
}

// Fisher-Yates 洗牌
export function shuffle(deck) {
  const arr = [...deck]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// 发牌：每人3张
export function deal(deck, numPlayers) {
  const hands = Array.from({ length: numPlayers }, () => [])
  for (let i = 0; i < 3; i++) {
    for (let p = 0; p < numPlayers; p++) {
      hands[p].push(deck.pop())
    }
  }
  return hands
}

// 牌型枚举
export const HAND_TYPES = {
  BAOZI: 6,    // 豹子
  SHUNJIN: 5,  // 顺金
  JINHUA: 4,   // 金花
  SHUNZI: 3,   // 顺子
  DUIZI: 2,    // 对子
  DANZHANG: 1  // 单张
}

export const HAND_TYPE_NAMES = {
  6: '豹子',
  5: '顺金',
  4: '金花',
  3: '顺子',
  2: '对子',
  1: '单张'
}

// 判断牌型并返回 { type, sortedValues }
export function evaluateHand(cards) {
  const values = cards.map(c => c.value).sort((a, b) => b - a)
  const suits = cards.map(c => c.suit)

  const isFlush = suits[0] === suits[1] && suits[1] === suits[2]
  const isTriple = values[0] === values[1] && values[1] === values[2]

  // 检查顺子（包括 A23 特殊情况）
  let isStraight = false
  let straightValues = values

  if (values[0] - values[1] === 1 && values[1] - values[2] === 1) {
    isStraight = true
  }
  // A23 = [14, 3, 2] -> 最小顺子，A当1用
  if (values[0] === 14 && values[1] === 3 && values[2] === 2) {
    isStraight = true
    straightValues = [3, 2, 1] // A当1，3最大
  }

  // 检查对子
  let isPair = false
  let pairValues = values
  if (values[0] === values[1] && values[1] !== values[2]) {
    isPair = true
    pairValues = [values[0], values[0], values[2]]
  } else if (values[1] === values[2] && values[0] !== values[1]) {
    isPair = true
    pairValues = [values[1], values[1], values[0]]
  } else if (values[0] === values[2] && values[0] !== values[1]) {
    isPair = true
    pairValues = [values[0], values[0], values[1]]
  }

  if (isTriple) {
    return { type: HAND_TYPES.BAOZI, sortedValues: values }
  }
  if (isFlush && isStraight) {
    return { type: HAND_TYPES.SHUNJIN, sortedValues: straightValues }
  }
  if (isFlush) {
    return { type: HAND_TYPES.JINHUA, sortedValues: values }
  }
  if (isStraight) {
    return { type: HAND_TYPES.SHUNZI, sortedValues: straightValues }
  }
  if (isPair) {
    return { type: HAND_TYPES.DUIZI, sortedValues: pairValues }
  }
  return { type: HAND_TYPES.DANZHANG, sortedValues: values }
}

// 比较两手牌，返回 >0 表示 a 赢，<0 表示 b 赢，0 平局
export function compareHands(a, b) {
  const evalA = evaluateHand(a)
  const evalB = evaluateHand(b)

  if (evalA.type !== evalB.type) {
    return evalA.type - evalB.type
  }

  for (let i = 0; i < 3; i++) {
    if (evalA.sortedValues[i] !== evalB.sortedValues[i]) {
      return evalA.sortedValues[i] - evalB.sortedValues[i]
    }
  }
  return 0
}

export function cardToString(card) {
  return `${card.suit}${card.rank}`
}

export function isRedSuit(suit) {
  return suit === '♥' || suit === '♦'
}

export { SUITS, RANKS, RANK_VALUES, SUIT_NAMES }
