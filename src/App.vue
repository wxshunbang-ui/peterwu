<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { createGame } from './game/engine.js'
import { evaluateHand, HAND_TYPE_NAMES, isRedSuit } from './game/deck.js'

const game = createGame()
const state = game.state

const showRules = ref(false)
const raiseAmount = ref(40)
const animatingCards = ref(false)
const particles = ref([])
const musicPlaying = ref(false)
const bgMusic = ref(null)

const playerHand = computed(() => {
  const p = state.players[0]
  if (!p || !p.cards.length) return null
  return evaluateHand(p.cards)
})

const playerHandName = computed(() => {
  if (!playerHand.value) return ''
  return HAND_TYPE_NAMES[playerHand.value.type]
})

const canAct = computed(() => {
  return state.phase === 'betting' && state.waitingForPlayer && !state.players[0].folded
})

const canRaise = computed(() => {
  return canAct.value && state.currentBet < 200
})

const callCost = computed(() => {
  const p = state.players[0]
  return state.currentBet * (p.hasLooked ? 2 : 1)
})

// 背景音乐 - 使用Web Audio API生成纸醉金迷风格的赌场音乐
let audioCtx = null
let musicNodes = []

function createCasinoMusic() {
  if (audioCtx) return
  audioCtx = new (window.AudioContext || window.webkitAudioContext)()

  function playNote(freq, startTime, duration, type = 'sine', gain = 0.08) {
    const osc = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.setValueAtTime(0, startTime)
    g.gain.linearRampToValueAtTime(gain, startTime + 0.05)
    g.gain.setValueAtTime(gain, startTime + duration - 0.1)
    g.gain.linearRampToValueAtTime(0, startTime + duration)
    osc.connect(g)
    g.connect(audioCtx.destination)
    osc.start(startTime)
    osc.stop(startTime + duration)
    musicNodes.push(osc)
  }

  function scheduleLoop() {
    const now = audioCtx.currentTime
    // 爵士风格和弦进行 - Cmaj7 → Am7 → Dm7 → G7 循环
    const chords = [
      [261.6, 329.6, 392.0, 493.9], // Cmaj7
      [220.0, 261.6, 329.6, 392.0], // Am7
      [293.7, 349.2, 440.0, 523.3], // Dm7
      [196.0, 246.9, 293.7, 349.2], // G7
    ]
    const beatDur = 0.5
    let t = now + 0.1

    for (let bar = 0; bar < 4; bar++) {
      const chord = chords[bar]
      // 柔和pad音色
      for (const freq of chord) {
        playNote(freq, t, beatDur * 4, 'sine', 0.04)
        playNote(freq * 0.5, t, beatDur * 4, 'triangle', 0.02)
      }
      // 低音行走 bass line
      playNote(chord[0] * 0.5, t, beatDur, 'triangle', 0.06)
      playNote(chord[1] * 0.5, t + beatDur, beatDur, 'triangle', 0.05)
      playNote(chord[0] * 0.5, t + beatDur * 2, beatDur, 'triangle', 0.06)
      playNote(chord[2] * 0.5, t + beatDur * 3, beatDur, 'triangle', 0.05)
      t += beatDur * 4
    }

    // 循环
    if (musicPlaying.value) {
      setTimeout(scheduleLoop, (beatDur * 16 - 0.5) * 1000)
    }
  }

  scheduleLoop()
}

function toggleMusic() {
  musicPlaying.value = !musicPlaying.value
  if (musicPlaying.value) {
    createCasinoMusic()
  } else {
    if (audioCtx) {
      audioCtx.close()
      audioCtx = null
      musicNodes = []
    }
  }
}

function startGame() {
  animatingCards.value = true
  game.startNewRound()
  setTimeout(() => { animatingCards.value = false }, 800)
  // 首次开始游戏自动播放音乐
  if (!musicPlaying.value && !audioCtx) {
    musicPlaying.value = true
    createCasinoMusic()
  }
}

function doCall() {
  if (!canAct.value) return
  game.playerAction('call')
}

function doRaise() {
  if (!canRaise.value) return
  game.playerAction('raise', raiseAmount.value)
}

function doFold() {
  if (!canAct.value) return
  game.playerAction('fold')
}

function doLook() {
  if (!canAct.value || state.players[0].hasLooked) return
  game.playerAction('look')
}

function doShowdown() {
  game.forceShowdown()
}

function spawnParticles() {
  const arr = []
  for (let i = 0; i < 30; i++) {
    arr.push({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 3,
      size: 4 + Math.random() * 8,
      emoji: ['✨', '💰', '🎰', '💎', '👑'][Math.floor(Math.random() * 5)]
    })
  }
  particles.value = arr
}

watch(() => state.showdown, (v) => {
  if (v && state.winner) {
    spawnParticles()
  }
})

onMounted(() => {
  spawnParticles()
})

function getCardDisplay(card, show) {
  if (!show) return { text: '🂠', isRed: false }
  return { text: `${card.suit}${card.rank}`, isRed: isRedSuit(card.suit) }
}

// 动态座位布局，根据玩家人数分配
function getPlayerPosition(index) {
  const total = state.players.length
  if (index === 0) return 'bottom' // 玩家总在下方

  // AI均匀分布在上方和两侧
  const aiCount = total - 1
  const aiIndex = index - 1
  if (aiCount <= 2) {
    return ['left', 'right'][aiIndex]
  }
  if (aiCount === 3) {
    return ['left', 'top', 'right'][aiIndex]
  }
  if (aiCount === 4) {
    return ['left', 'top-left', 'top-right', 'right'][aiIndex]
  }
  // 5 AI
  return ['left', 'top-left', 'top', 'top-right', 'right'][aiIndex]
}
</script>

<template>
  <div class="game-container">
    <!-- 背景粒子效果 -->
    <div class="bg-particles">
      <div
        v-for="p in particles"
        :key="p.id"
        class="particle"
        :style="{
          left: p.x + '%',
          animationDelay: p.delay + 's',
          animationDuration: p.duration + 's',
          fontSize: p.size + 'px'
        }"
      >{{ p.emoji }}</div>
    </div>

    <!-- 顶部金色装饰条 -->
    <header class="game-header">
      <div class="header-ornament left">♠♥♣♦</div>
      <h1 class="game-title">
        <span class="title-char">炸</span>
        <span class="title-char">金</span>
        <span class="title-char">花</span>
      </h1>
      <div class="header-ornament right">♦♣♥♠</div>
      <button class="music-btn" @click="toggleMusic" :title="musicPlaying ? '关闭音乐' : '开启音乐'">
        {{ musicPlaying ? '🔊' : '🔇' }}
      </button>
    </header>

    <!-- 主牌桌 -->
    <div class="table-area">
      <div class="table-felt">
        <!-- 金色边框装饰 -->
        <div class="table-border"></div>

        <!-- 奖池 -->
        <div class="pot-display">
          <div class="pot-label">奖 池</div>
          <div class="pot-amount">
            <span class="coin-icon">🪙</span>
            {{ state.pot }}
          </div>
          <div class="bet-info">当前注: {{ state.currentBet }} | 第 {{ state.roundNum }} 轮</div>
        </div>

        <!-- 四个玩家位置 -->
        <div
          v-for="(player, idx) in state.players"
          :key="idx"
          :class="[
            'player-seat',
            'seat-' + getPlayerPosition(idx),
            {
              'is-active': state.currentPlayerIndex === idx && state.phase === 'betting',
              'is-folded': player.folded,
              'is-winner': state.showdown && state.winner === player
            }
          ]"
        >
          <div class="player-avatar">
            {{ player.isAI ? '🤖' : '🧑' }}
            <div v-if="state.currentPlayerIndex === idx && state.phase === 'betting'" class="turn-indicator"></div>
          </div>
          <div class="player-info">
            <div class="player-name">{{ player.name }}</div>
            <div class="player-chips">
              <span class="chip-icon">💰</span> {{ player.chips }}
            </div>
            <div v-if="player.folded" class="fold-badge">弃牌</div>
            <div v-if="player.hasLooked && !player.folded" class="looked-badge">已看牌</div>
          </div>

          <!-- 牌面 -->
          <div class="player-cards" :class="{ 'cards-dealing': animatingCards }">
            <div
              v-for="(card, ci) in player.cards"
              :key="ci"
              :class="[
                'card',
                {
                  'card-back': !(idx === 0 && state.players[0].hasLooked) && !state.showdown,
                  'card-red': (idx === 0 && state.players[0].hasLooked || state.showdown) && isRedSuit(card.suit),
                  'card-black': (idx === 0 && state.players[0].hasLooked || state.showdown) && !isRedSuit(card.suit),
                }
              ]"
              :style="{ animationDelay: (ci * 0.15) + 's' }"
            >
              <template v-if="(idx === 0 && state.players[0].hasLooked) || state.showdown">
                <span class="card-suit">{{ card.suit }}</span>
                <span class="card-rank">{{ card.rank }}</span>
              </template>
              <template v-else>
                <span class="card-back-design">🂠</span>
              </template>
            </div>
          </div>

          <!-- 玩家牌型(看牌后显示/开牌后显示) -->
          <div
            v-if="(idx === 0 && state.players[0].hasLooked && !state.players[0].folded) || (state.showdown && !player.folded)"
            class="hand-type-badge"
          >
            {{ HAND_TYPE_NAMES[evaluateHand(player.cards).type] }}
          </div>
        </div>
      </div>
    </div>

    <!-- 操作按钮区 -->
    <div class="action-bar">
      <template v-if="state.phase === 'idle' || state.phase === 'showdown'">
        <div v-if="state.lastResult" class="result-banner">
          <div class="result-text">
            🏆 {{ state.lastResult.winner }} 以【{{ state.lastResult.handType }}】赢得
            <span class="result-amount">{{ state.lastResult.amount }}</span> 筹码！
          </div>
        </div>
        <button class="btn btn-gold btn-large" @click="startGame">
          {{ state.gameNumber === 0 ? '开始游戏' : '下一局' }}
        </button>
      </template>

      <template v-if="state.phase === 'betting' && state.waitingForPlayer">
        <div class="action-buttons">
          <button
            v-if="!state.players[0].hasLooked"
            class="btn btn-look"
            @click="doLook"
            :disabled="!canAct"
          >
            👁 看牌
          </button>

          <button
            class="btn btn-call"
            @click="doCall"
            :disabled="!canAct"
          >
            ✅ 跟注 ({{ callCost }})
          </button>

          <div v-if="canRaise" class="raise-group">
            <input
              type="range"
              v-model.number="raiseAmount"
              :min="state.currentBet + 20"
              :max="200"
              step="20"
              class="raise-slider"
            />
            <button
              class="btn btn-raise"
              @click="doRaise"
              :disabled="!canRaise"
            >
              ⬆ 加注 ({{ raiseAmount }})
            </button>
          </div>

          <button
            class="btn btn-fold"
            @click="doFold"
            :disabled="!canAct"
          >
            ❌ 弃牌
          </button>

          <button
            class="btn btn-showdown"
            @click="doShowdown"
          >
            🃏 开牌
          </button>
        </div>
      </template>

      <template v-if="state.phase === 'betting' && !state.waitingForPlayer">
        <div class="waiting-text">
          <div class="waiting-dots">等待对手行动中</div>
        </div>
      </template>
    </div>

    <!-- 游戏日志 -->
    <div class="game-log">
      <div class="log-header" @click="showRules = !showRules">
        📜 {{ showRules ? '游戏规则' : '游戏日志' }}
        <span class="log-toggle">{{ showRules ? '查看日志' : '查看规则' }}</span>
      </div>
      <div class="log-content">
        <template v-if="showRules">
          <div class="rules-text">
            <p><strong>牌型大小（从大到小）：</strong></p>
            <p>豹子 > 顺金 > 金花 > 顺子 > 对子 > 单张</p>
            <p><strong>操作说明：</strong></p>
            <p>闷牌（不看牌）下注金额为当前注；看牌后下注金额翻倍</p>
            <p>跟注：匹配当前下注 | 加注：提高下注额 | 弃牌：放弃本局</p>
            <p><strong>特殊规则：</strong>A23为最小顺子</p>
          </div>
        </template>
        <template v-else>
          <div v-for="(log, i) in state.gameLog" :key="i" class="log-entry"
            :class="{ 'log-highlight': log.includes('赢') || log.includes('开始') }">
            {{ log }}
          </div>
          <div v-if="!state.gameLog.length" class="log-empty">点击"开始游戏"开始第一局</div>
        </template>
      </div>
    </div>

    <!-- 底部筹码总览 -->
    <footer class="game-footer">
      <div class="footer-chips">
        <div v-for="(player, idx) in state.players" :key="idx" class="footer-player">
          <span class="footer-name">{{ player.name }}</span>
          <span class="footer-amount">{{ player.chips }}</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ============ 奢华金色主题 ============ */

.game-container {
  min-height: 100vh;
  background:
    radial-gradient(ellipse at 50% 0%, rgba(139, 90, 43, 0.3) 0%, transparent 60%),
    radial-gradient(ellipse at 50% 100%, rgba(139, 90, 43, 0.15) 0%, transparent 50%),
    linear-gradient(180deg, #0d0d0d 0%, #1a0a00 30%, #0d0d0d 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 20px;
  position: relative;
  overflow: hidden;
}

/* 背景粒子 */
.bg-particles {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
  z-index: 0;
}
.particle {
  position: absolute;
  top: -20px;
  animation: particleFall linear infinite;
  opacity: 0.4;
}
@keyframes particleFall {
  0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
  10% { opacity: 0.6; }
  90% { opacity: 0.3; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}

/* ============ 头部 ============ */
.game-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  padding: 15px 50px 10px;
  width: 100%;
  max-width: 600px;
  position: relative;
  z-index: 1;
}
.header-ornament {
  color: #8b5a2b;
  font-size: 14px;
  letter-spacing: 4px;
  opacity: 0.6;
}
.game-title {
  display: flex;
  gap: 8px;
}
.title-char {
  font-size: 36px;
  font-weight: 900;
  background: linear-gradient(180deg, #ffd700 0%, #b8860b 40%, #ffd700 60%, #daa520 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: none;
  filter: drop-shadow(0 2px 4px rgba(218, 165, 32, 0.5));
  animation: titleGlow 3s ease-in-out infinite alternate;
}
@keyframes titleGlow {
  0% { filter: drop-shadow(0 2px 4px rgba(218, 165, 32, 0.3)); }
  100% { filter: drop-shadow(0 2px 12px rgba(255, 215, 0, 0.8)); }
}

@media (max-width: 480px) {
  .title-char { font-size: 28px; }
  .header-ornament { font-size: 10px; letter-spacing: 2px; }
}

/* ============ 牌桌 ============ */
.table-area {
  width: 100%;
  max-width: 600px;
  padding: 10px 15px;
  position: relative;
  z-index: 1;
}
.table-felt {
  position: relative;
  background:
    radial-gradient(ellipse at center, #1a4d1a 0%, #0d2d0d 70%, #061206 100%);
  border-radius: 50% / 20%;
  min-height: 420px;
  padding: 20px;
  box-shadow:
    0 0 0 4px #8b6914,
    0 0 0 8px #5a4510,
    0 0 0 10px #3a2a08,
    0 0 30px rgba(139, 105, 20, 0.4),
    inset 0 0 60px rgba(0,0,0,0.5);
  overflow: visible;
}
.table-border {
  position: absolute;
  inset: 6px;
  border: 2px solid rgba(218, 165, 32, 0.3);
  border-radius: 50% / 20%;
  pointer-events: none;
}

@media (max-width: 480px) {
  .table-felt {
    min-height: 380px;
    border-radius: 30px;
    padding: 15px;
  }
  .table-border { border-radius: 26px; }
}

/* 奖池 */
.pot-display {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 2;
}
.pot-label {
  font-size: 12px;
  color: rgba(218, 165, 32, 0.7);
  letter-spacing: 8px;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.pot-amount {
  font-size: 32px;
  font-weight: 900;
  color: #ffd700;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.coin-icon {
  animation: coinSpin 2s ease-in-out infinite;
}
@keyframes coinSpin {
  0%, 100% { transform: rotateY(0deg); }
  50% { transform: rotateY(180deg); }
}
.bet-info {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
}

/* ============ 玩家座位 ============ */
.player-seat {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: all 0.3s ease;
  z-index: 3;
}

.seat-bottom {
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
}
.seat-top {
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
}
.seat-left {
  left: -5px;
  top: 50%;
  transform: translateY(-50%);
}
.seat-right {
  right: -5px;
  top: 50%;
  transform: translateY(-50%);
}
.seat-top-left {
  top: 10%;
  left: 8%;
}
.seat-top-right {
  top: 10%;
  right: 8%;
}

@media (max-width: 480px) {
  .seat-left { left: -10px; }
  .seat-right { right: -10px; }
  .seat-top-left { left: 2%; top: 12%; }
  .seat-top-right { right: 2%; top: 12%; }
}

/* 音乐按钮 */
.music-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(139, 105, 20, 0.3);
  border: 1px solid rgba(218, 165, 32, 0.4);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.music-btn:hover {
  background: rgba(139, 105, 20, 0.6);
  box-shadow: 0 0 10px rgba(218, 165, 32, 0.4);
}

.player-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
  border: 2px solid #8b6914;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  position: relative;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
}

.is-active .player-avatar {
  border-color: #ffd700;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.6);
  animation: activePulse 1.5s ease-in-out infinite;
}
@keyframes activePulse {
  0%, 100% { box-shadow: 0 0 10px rgba(255, 215, 0, 0.4); }
  50% { box-shadow: 0 0 25px rgba(255, 215, 0, 0.8); }
}

.is-winner .player-avatar {
  border-color: #ffd700;
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
}

.is-folded {
  opacity: 0.4;
}

.turn-indicator {
  position: absolute;
  bottom: -4px; right: -4px;
  width: 12px; height: 12px;
  border-radius: 50%;
  background: #00ff00;
  box-shadow: 0 0 8px #00ff00;
  animation: blink 1s ease-in-out infinite;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.player-info {
  text-align: center;
}
.player-name {
  font-size: 12px;
  font-weight: 700;
  color: #daa520;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}
.player-chips {
  font-size: 11px;
  color: #ffd700;
  display: flex;
  align-items: center;
  gap: 2px;
  justify-content: center;
}
.chip-icon { font-size: 10px; }

.fold-badge, .looked-badge {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 8px;
  margin-top: 2px;
  font-weight: 700;
}
.fold-badge {
  background: rgba(255, 0, 0, 0.3);
  color: #ff6b6b;
  border: 1px solid rgba(255, 0, 0, 0.4);
}
.looked-badge {
  background: rgba(0, 200, 255, 0.2);
  color: #00c8ff;
  border: 1px solid rgba(0, 200, 255, 0.3);
}

/* ============ 扑克牌 ============ */
.player-cards {
  display: flex;
  gap: 3px;
}

.card {
  width: 36px;
  height: 50px;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  position: relative;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  transition: transform 0.3s ease;
}
.card:hover {
  transform: translateY(-3px);
}

.cards-dealing .card {
  animation: dealCard 0.5s ease-out backwards;
}
@keyframes dealCard {
  0% { transform: translateY(-100px) rotateY(180deg) scale(0.3); opacity: 0; }
  100% { transform: translateY(0) rotateY(0deg) scale(1); opacity: 1; }
}

.card-back {
  background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #1a237e 100%);
  border: 1.5px solid #5c6bc0;
  color: #7986cb;
}
.card-back-design {
  font-size: 24px;
  opacity: 0.8;
}

.card-red {
  background: linear-gradient(135deg, #fff 0%, #ffe8e8 100%);
  border: 1.5px solid #daa520;
  color: #d32f2f;
}
.card-black {
  background: linear-gradient(135deg, #fff 0%, #f0f0f0 100%);
  border: 1.5px solid #daa520;
  color: #212121;
}

.card-suit {
  font-size: 11px;
  line-height: 1;
}
.card-rank {
  font-size: 14px;
  line-height: 1;
}

/* 牌型标签 */
.hand-type-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: linear-gradient(135deg, #ffd700, #b8860b);
  color: #000;
  font-weight: 900;
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.4);
  animation: badgePop 0.5s ease-out;
  white-space: nowrap;
}
@keyframes badgePop {
  0% { transform: scale(0); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

/* ============ 操作栏 ============ */
.action-bar {
  width: 100%;
  max-width: 600px;
  padding: 10px 15px;
  position: relative;
  z-index: 1;
  min-height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.btn {
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  white-space: nowrap;
}
.btn:active {
  transform: scale(0.95);
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-gold {
  background: linear-gradient(135deg, #ffd700 0%, #b8860b 50%, #ffd700 100%);
  color: #1a0a00;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.4);
  font-size: 18px;
  letter-spacing: 2px;
}
.btn-gold:hover {
  box-shadow: 0 6px 25px rgba(255, 215, 0, 0.6);
  transform: translateY(-2px);
}
.btn-large {
  padding: 14px 40px;
  font-size: 20px;
}

.btn-call {
  background: linear-gradient(135deg, #2e7d32, #1b5e20);
  color: #a5d6a7;
  border: 1px solid #4caf50;
}
.btn-call:hover { box-shadow: 0 0 12px rgba(76, 175, 80, 0.5); }

.btn-raise {
  background: linear-gradient(135deg, #e65100, #bf360c);
  color: #ffcc80;
  border: 1px solid #ff9800;
}
.btn-raise:hover { box-shadow: 0 0 12px rgba(255, 152, 0, 0.5); }

.btn-fold {
  background: linear-gradient(135deg, #424242, #212121);
  color: #bdbdbd;
  border: 1px solid #616161;
}
.btn-fold:hover { box-shadow: 0 0 12px rgba(158, 158, 158, 0.3); }

.btn-look {
  background: linear-gradient(135deg, #0277bd, #01579b);
  color: #81d4fa;
  border: 1px solid #039be5;
}
.btn-look:hover { box-shadow: 0 0 12px rgba(3, 155, 229, 0.5); }

.btn-showdown {
  background: linear-gradient(135deg, #6a1b9a, #4a148c);
  color: #ce93d8;
  border: 1px solid #9c27b0;
}
.btn-showdown:hover { box-shadow: 0 0 12px rgba(156, 39, 176, 0.5); }

.raise-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.raise-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 80px;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(90deg, #b8860b, #ffd700);
  outline: none;
}
.raise-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffd700;
  cursor: pointer;
  box-shadow: 0 0 6px rgba(255, 215, 0, 0.8);
}

.result-banner {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(184, 134, 11, 0.1) 100%);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 12px;
  padding: 12px 20px;
  margin-bottom: 10px;
  text-align: center;
}
.result-text {
  color: #ffd700;
  font-size: 14px;
}
.result-amount {
  font-size: 20px;
  font-weight: 900;
  color: #ffd700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.waiting-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}
.waiting-dots::after {
  content: '';
  animation: dots 1.5s steps(4) infinite;
}
@keyframes dots {
  0% { content: ''; }
  25% { content: '.'; }
  50% { content: '..'; }
  75% { content: '...'; }
}

/* ============ 日志 ============ */
.game-log {
  width: 100%;
  max-width: 600px;
  padding: 0 15px;
  position: relative;
  z-index: 1;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(139, 105, 20, 0.15);
  border: 1px solid rgba(218, 165, 32, 0.2);
  border-radius: 8px 8px 0 0;
  color: #daa520;
  font-size: 13px;
  cursor: pointer;
}
.log-toggle {
  font-size: 11px;
  color: rgba(218, 165, 32, 0.6);
  text-decoration: underline;
}

.log-content {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(218, 165, 32, 0.15);
  border-top: none;
  border-radius: 0 0 8px 8px;
  padding: 8px;
  max-height: 150px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #8b6914 transparent;
}
.log-content::-webkit-scrollbar { width: 4px; }
.log-content::-webkit-scrollbar-thumb { background: #8b6914; border-radius: 2px; }

.log-entry {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  padding: 2px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.log-highlight {
  color: #ffd700;
  font-weight: 700;
}
.log-empty {
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
  text-align: center;
  padding: 10px;
}

.rules-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.8;
}
.rules-text p { margin-bottom: 4px; }
.rules-text strong { color: #daa520; }

/* ============ 底部 ============ */
.game-footer {
  width: 100%;
  max-width: 600px;
  padding: 10px 15px;
  position: relative;
  z-index: 1;
}
.footer-chips {
  display: flex;
  justify-content: space-around;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(218, 165, 32, 0.15);
  border-radius: 8px;
  padding: 8px;
}
.footer-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.footer-name {
  font-size: 10px;
  color: rgba(218, 165, 32, 0.6);
}
.footer-amount {
  font-size: 14px;
  font-weight: 900;
  color: #ffd700;
}

/* ============ 响应式 ============ */
@media (max-width: 380px) {
  .btn { padding: 8px 10px; font-size: 12px; }
  .btn-large { padding: 12px 30px; font-size: 16px; }
  .pot-amount { font-size: 24px; }
  .card { width: 30px; height: 42px; }
  .card-rank { font-size: 12px; }
  .card-suit { font-size: 9px; }
}
</style>
