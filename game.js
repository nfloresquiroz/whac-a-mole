/* ============================================
   WHAC-A-MOLE ARCADE - GAME ENGINE
   ============================================ */

// === Audio Engine (Web Audio API) ===
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Audio not available');
        }
    }

    play(type) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        switch (type) {
            case 'whack':
                this._playWhack(now);
                break;
            case 'golden':
                this._playGolden(now);
                break;
            case 'bomb':
                this._playBomb(now);
                break;
            case 'miss':
                this._playMiss(now);
                break;
            case 'levelup':
                this._playLevelUp(now);
                break;
            case 'gameover':
                this._playGameOver(now);
                break;
            case 'start':
                this._playStart(now);
                break;
            case 'pop':
                this._playPop(now);
                break;
        }
    }

    _createOsc(freq, type, startTime, duration, gainVal = 0.3) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(gainVal, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    _playWhack(t) {
        this._createOsc(300, 'square', t, 0.1, 0.2);
        this._createOsc(600, 'square', t + 0.02, 0.08, 0.15);

        const noise = this.ctx.createBufferSource();
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        noise.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(t);
    }

    _playGolden(t) {
        [523, 659, 784, 1047].forEach((freq, i) => {
            this._createOsc(freq, 'sine', t + i * 0.08, 0.3, 0.15);
        });
    }

    _playBomb(t) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.5);
    }

    _playMiss(t) {
        this._createOsc(200, 'sine', t, 0.15, 0.1);
        this._createOsc(150, 'sine', t + 0.1, 0.15, 0.1);
    }

    _playLevelUp(t) {
        [440, 554, 659, 880].forEach((freq, i) => {
            this._createOsc(freq, 'square', t + i * 0.12, 0.25, 0.1);
        });
    }

    _playGameOver(t) {
        [392, 349, 330, 262].forEach((freq, i) => {
            this._createOsc(freq, 'square', t + i * 0.3, 0.4, 0.15);
        });
    }

    _playStart(t) {
        [262, 330, 392, 523].forEach((freq, i) => {
            this._createOsc(freq, 'square', t + i * 0.1, 0.15, 0.12);
        });
    }

    _playPop(t) {
        this._createOsc(400, 'sine', t, 0.08, 0.15);
        this._createOsc(800, 'sine', t + 0.02, 0.06, 0.1);
    }
}

// === Game State ===
const GameState = {
    IDLE: 'idle',
    PLAYING: 'playing',
    GAMEOVER: 'gameover'
};

// === Main Game Class ===
class WhacAMoleGame {
    constructor() {
        this.audio = new AudioEngine();
        this.state = GameState.IDLE;

        // Game config
        this.GAME_TIME = 30;
        this.MOLE_TYPES = {
            normal: { emoji: '🐹', points: 10, weight: 70 },
            golden: { emoji: '⭐', points: 50, weight: 15, className: 'golden' },
            bomb: { emoji: '💣', points: -30, weight: 15, className: 'bomb' }
        };

        // Game stats
        this.score = 0;
        this.level = 1;
        this.timeLeft = this.GAME_TIME;
        this.combo = 0;
        this.maxCombo = 0;
        this.totalHits = 0;
        this.totalClicks = 0;
        this.highScore = parseInt(localStorage.getItem('whacamole_highscore')) || 0;

        // Mole tracking
        this.activeMoles = new Set();
        this.moleTimers = {};
        this.spawnInterval = null;
        this.timerInterval = null;

        // DOM elements
        this.screens = {
            title: document.getElementById('title-screen'),
            game: document.getElementById('game-screen'),
            gameover: document.getElementById('gameover-screen')
        };

        this.elements = {
            score: document.getElementById('score'),
            level: document.getElementById('level'),
            timer: document.getElementById('timer'),
            combo: document.getElementById('combo'),
            board: document.getElementById('game-board'),
            floatScores: document.getElementById('float-scores'),
            startBtn: document.getElementById('start-btn'),
            restartBtn: document.getElementById('restart-btn'),
            finalScore: document.getElementById('final-score'),
            finalHits: document.getElementById('final-hits'),
            finalCombo: document.getElementById('final-combo'),
            finalLevel: document.getElementById('final-level'),
            finalAccuracy: document.getElementById('final-accuracy'),
            highScoreMsg: document.getElementById('high-score-msg')
        };

        this.moles = document.querySelectorAll('.mole');
        this.holes = document.querySelectorAll('.hole');

        this._bindEvents();
    }

    _bindEvents() {
        this.elements.startBtn.addEventListener('click', () => this.startGame());
        this.elements.restartBtn.addEventListener('click', () => this.startGame());

        this.holes.forEach(hole => {
            hole.addEventListener('click', (e) => this._handleClick(e, hole));

            // Prevent double-tap zoom on mobile
            hole.addEventListener('touchend', (e) => {
                e.preventDefault();
                this._handleClick(e, hole);
            });
        });
    }

    // === Screen Management ===
    showScreen(screenName) {
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        this.screens[screenName].classList.add('active');
    }

    // === Game Flow ===
    startGame() {
        this.audio.init();
        this.audio.play('start');

        // Reset state
        this.score = 0;
        this.level = 1;
        this.timeLeft = this.GAME_TIME;
        this.combo = 0;
        this.maxCombo = 0;
        this.totalHits = 0;
        this.totalClicks = 0;
        this.activeMoles.clear();
        this.state = GameState.PLAYING;

        // Reset moles
        this.moles.forEach(mole => {
            mole.classList.remove('up', 'bonked', 'golden', 'bomb');
            mole.dataset.type = 'normal';
            mole.querySelector('.mole-face').textContent = '🐹';
        });

        this._updateHUD();
        this.showScreen('game');

        // Start timers
        this._startTimer();
        this._startSpawning();
    }

    endGame() {
        this.state = GameState.GAMEOVER;
        this.audio.play('gameover');

        // Clear all timers
        clearInterval(this.timerInterval);
        clearInterval(this.spawnInterval);
        Object.values(this.moleTimers).forEach(t => clearTimeout(t));
        this.moleTimers = {};

        // Hide all moles
        this.moles.forEach(mole => {
            mole.classList.remove('up', 'golden', 'bomb');
        });

        // Update final stats
        this.elements.finalScore.textContent = this.score;
        this.elements.finalHits.textContent = this.totalHits;
        this.elements.finalCombo.textContent = `x${this.maxCombo}`;
        this.elements.finalLevel.textContent = this.level;

        const accuracy = this.totalClicks > 0
            ? Math.round((this.totalHits / this.totalClicks) * 100)
            : 0;
        this.elements.finalAccuracy.textContent = `${accuracy}%`;

        // Check high score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('whacamole_highscore', this.highScore);
            this.elements.highScoreMsg.classList.remove('hidden');
        } else {
            this.elements.highScoreMsg.classList.add('hidden');
        }

        setTimeout(() => this.showScreen('gameover'), 500);
    }

    // === Timer ===
    _startTimer() {
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.elements.timer.textContent = this.timeLeft;

            // Warning when low time
            if (this.timeLeft <= 10) {
                this.elements.timer.classList.add('warning');
            } else {
                this.elements.timer.classList.remove('warning');
            }

            // Level up every 10 seconds
            if (this.timeLeft > 0 && this.timeLeft % 10 === 0 && this.timeLeft < this.GAME_TIME) {
                this._levelUp();
            }

            if (this.timeLeft <= 0) {
                this.endGame();
            }
        }, 1000);
    }

    _levelUp() {
        this.level++;
        this.elements.level.textContent = this.level;
        this.audio.play('levelup');

        // Restart spawning with faster pace
        clearInterval(this.spawnInterval);
        this._startSpawning();

        // Visual feedback
        this.elements.level.style.transform = 'scale(1.5)';
        setTimeout(() => {
            this.elements.level.style.transform = 'scale(1)';
        }, 300);
    }

    // === Mole Spawning ===
    _startSpawning() {
        const baseInterval = Math.max(400, 1200 - (this.level - 1) * 150);

        const spawn = () => {
            if (this.state !== GameState.PLAYING) return;

            this._spawnMole();

            // Randomize next spawn
            const nextDelay = baseInterval + Math.random() * 400;
            this.spawnInterval = setTimeout(spawn, nextDelay);
        };

        spawn();
    }

    _spawnMole() {
        // Find an inactive hole
        const inactiveHoles = [];
        for (let i = 0; i < 9; i++) {
            if (!this.activeMoles.has(i)) inactiveHoles.push(i);
        }

        if (inactiveHoles.length === 0) return;

        // Pick random hole
        const holeIdx = inactiveHoles[Math.floor(Math.random() * inactiveHoles.length)];

        // Determine mole type
        const moleType = this._getRandomMoleType();
        const mole = this.moles[holeIdx];
        const typeConfig = this.MOLE_TYPES[moleType];

        // Set mole appearance
        mole.querySelector('.mole-face').textContent = typeConfig.emoji;
        mole.dataset.type = moleType;
        mole.classList.remove('golden', 'bomb', 'bonked');
        if (typeConfig.className) {
            mole.classList.add(typeConfig.className);
        }

        // Show mole
        mole.classList.add('up');
        this.activeMoles.add(holeIdx);
        this.audio.play('pop');

        // Auto-hide after a duration
        const displayTime = Math.max(600, 1500 - (this.level - 1) * 120);
        this.moleTimers[holeIdx] = setTimeout(() => {
            this._hideMole(holeIdx);
        }, displayTime + Math.random() * 500);
    }

    _getRandomMoleType() {
        const roll = Math.random() * 100;
        let cumulative = 0;

        // Adjust weights based on level
        const bombWeight = Math.min(25, this.MOLE_TYPES.bomb.weight + (this.level - 1) * 2);
        const goldenWeight = Math.min(20, this.MOLE_TYPES.golden.weight + (this.level - 1));
        const normalWeight = 100 - bombWeight - goldenWeight;

        const weights = { normal: normalWeight, golden: goldenWeight, bomb: bombWeight };

        for (const [type, weight] of Object.entries(weights)) {
            cumulative += weight;
            if (roll < cumulative) return type;
        }
        return 'normal';
    }

    _hideMole(holeIdx) {
        const mole = this.moles[holeIdx];
        mole.classList.remove('up', 'golden', 'bomb');
        this.activeMoles.delete(holeIdx);
        delete this.moleTimers[holeIdx];
    }

    // === Click Handling ===
    _handleClick(e, hole) {
        if (this.state !== GameState.PLAYING) return;

        this.totalClicks++;
        const holeIdx = parseInt(hole.dataset.hole);
        const mole = this.moles[holeIdx];

        if (!mole.classList.contains('up') || mole.classList.contains('bonked')) {
            // Missed click
            this.combo = 0;
            this._updateHUD();
            return;
        }

        const moleType = mole.dataset.type;
        const typeConfig = this.MOLE_TYPES[moleType];

        // Clear hide timer
        clearTimeout(this.moleTimers[holeIdx]);
        delete this.moleTimers[holeIdx];

        if (moleType === 'bomb') {
            // Hit a bomb
            this._handleBombHit(holeIdx, e);
        } else {
            // Hit a mole (normal or golden)
            this._handleMoleHit(holeIdx, moleType, typeConfig, e);
        }
    }

    _handleMoleHit(holeIdx, moleType, typeConfig, e) {
        const mole = this.moles[holeIdx];

        this.combo++;
        this.totalHits++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;

        // Calculate points with combo multiplier
        const comboMultiplier = Math.min(5, 1 + Math.floor(this.combo / 3));
        const points = typeConfig.points * comboMultiplier;
        this.score += points;

        // Audio
        this.audio.play(moleType === 'golden' ? 'golden' : 'whack');

        // Bonk animation
        mole.classList.add('bonked');
        mole.classList.remove('up');

        // Float score
        const rect = mole.closest('.hole').getBoundingClientRect();
        this._showFloatScore(
            rect.left + rect.width / 2,
            rect.top,
            `+${points}`,
            moleType === 'golden' ? 'bonus' : ''
        );

        if (this.combo >= 3) {
            setTimeout(() => {
                this._showFloatScore(
                    rect.left + rect.width / 2,
                    rect.top - 25,
                    `🔥 x${comboMultiplier}`,
                    'bonus'
                );
            }, 150);
        }

        // Cleanup
        setTimeout(() => {
            mole.classList.remove('bonked', 'golden', 'bomb');
            this.activeMoles.delete(holeIdx);
        }, 300);

        this._updateHUD();
    }

    _handleBombHit(holeIdx, e) {
        const mole = this.moles[holeIdx];

        this.score = Math.max(0, this.score + this.MOLE_TYPES.bomb.points);
        this.combo = 0;

        this.audio.play('bomb');

        // Screen shake
        this.elements.board.classList.add('shake');
        setTimeout(() => this.elements.board.classList.remove('shake'), 300);

        // Float score
        const rect = mole.closest('.hole').getBoundingClientRect();
        this._showFloatScore(
            rect.left + rect.width / 2,
            rect.top,
            `${this.MOLE_TYPES.bomb.points}`,
            'penalty'
        );

        // Bonk and hide
        mole.classList.add('bonked');
        mole.classList.remove('up');

        setTimeout(() => {
            mole.classList.remove('bonked', 'bomb');
            this.activeMoles.delete(holeIdx);
        }, 300);

        // Deduct time
        this.timeLeft = Math.max(1, this.timeLeft - 3);

        this._updateHUD();
    }

    // === UI Updates ===
    _updateHUD() {
        this.elements.score.textContent = this.score;
        this.elements.level.textContent = this.level;
        this.elements.timer.textContent = this.timeLeft;
        const comboMultiplier = Math.min(5, 1 + Math.floor(this.combo / 3));
        this.elements.combo.textContent = `x${comboMultiplier}`;

        // Animate score on change
        this.elements.score.style.transform = 'scale(1.3)';
        setTimeout(() => {
            this.elements.score.style.transform = 'scale(1)';
        }, 150);
    }

    _showFloatScore(x, y, text, extraClass = '') {
        const el = document.createElement('div');
        el.className = `float-score ${extraClass}`;
        el.textContent = text;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        this.elements.floatScores.appendChild(el);

        setTimeout(() => el.remove(), 1000);
    }
}

// === Initialize ===
document.addEventListener('DOMContentLoaded', () => {
    const game = new WhacAMoleGame();
});
