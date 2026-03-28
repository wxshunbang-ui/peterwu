import { evaluateHand, HAND_TYPES } from './deck.js'

// AI 决策逻辑
// personality: 'aggressive' | 'normal' | 'cautious'
export function aiDecide(player, gameState) {
  const { currentBet, pot, roundNum, activePlayers } = gameState
  const hand = player.cards
  const eval_ = evaluateHand(hand)
  const chips = player.chips
  const hasLooked = player.hasLooked
  const personality = player.personality

  // 筹码不够跟注就弃牌
  const costToCall = hasLooked ? currentBet * 2 : currentBet
  if (chips < costToCall) {
    return { action: 'fold' }
  }

  // 基于牌型的基础强度 0-100
  let strength = 0
  switch (eval_.type) {
    case HAND_TYPES.BAOZI: strength = 100; break
    case HAND_TYPES.SHUNJIN: strength = 90; break
    case HAND_TYPES.JINHUA: strength = 75; break
    case HAND_TYPES.SHUNZI: strength = 60; break
    case HAND_TYPES.DUIZI: strength = 40; break
    case HAND_TYPES.DANZHANG: strength = 15 + eval_.sortedValues[0]; break
  }

  // 性格调整
  const personalityMod = personality === 'aggressive' ? 15 : personality === 'cautious' ? -15 : 0
  strength += personalityMod

  // 随机因子（诈金花的精髓）
  const bluffChance = Math.random() * 30 - 10
  strength += bluffChance

  // 是否先看牌
  if (!hasLooked) {
    // 闷牌策略
    if (roundNum <= 2 && strength > 20) {
      // 前两轮闷牌跟注
      if (strength > 70 && Math.random() > 0.5) {
        const raiseAmount = Math.min(currentBet * 2, chips, 200)
        return { action: 'raise', amount: raiseAmount }
      }
      return { action: 'call' }
    }
    // 第三轮之后考虑看牌
    if (roundNum > 2 && Math.random() > 0.4) {
      return { action: 'look' }
    }
    if (strength > 30) {
      return { action: 'call' }
    }
    // 牌差弃牌概率
    if (Math.random() > 0.6) {
      return { action: 'fold' }
    }
    return { action: 'call' }
  }

  // 已看牌的决策
  if (strength > 80) {
    // 强牌加注
    const raiseAmount = Math.min(currentBet * 2, chips, 200)
    if (raiseAmount > costToCall && chips >= raiseAmount) {
      return { action: 'raise', amount: raiseAmount }
    }
    return { action: 'call' }
  }

  if (strength > 50) {
    return { action: 'call' }
  }

  if (strength > 30) {
    // 中等牌，看情况
    if (activePlayers <= 2 || Math.random() > 0.5) {
      return { action: 'call' }
    }
    return { action: 'fold' }
  }

  // 弱牌
  if (currentBet > 40 || Math.random() > 0.4) {
    return { action: 'fold' }
  }
  return { action: 'call' }
}
