/* ============================================
   WHAC-AN-ALIEN · MISIÓN A MARTE — GAME ENGINE
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
        // Laser zap sound
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.12);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.12);

        this._createOsc(500, 'square', t + 0.03, 0.06, 0.1);
    }

    _playGolden(t) {
        // Space chime
        [659, 784, 988, 1319].forEach((freq, i) => {
            this._createOsc(freq, 'sine', t + i * 0.07, 0.35, 0.12);
        });
    }

    _playBomb(t) {
        // Meteor crash
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(20, t + 0.6);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.6);

        // Rumble
        const noise = this.ctx.createBufferSource();
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.3, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.2;
        noise.buffer = buffer;
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.15, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        noise.connect(nGain);
        nGain.connect(this.ctx.destination);
        noise.start(t);
    }

    _playMiss(t) {
        this._createOsc(250, 'sine', t, 0.12, 0.08);
        this._createOsc(180, 'sine', t + 0.08, 0.12, 0.08);
    }

    _playLevelUp(t) {
        // Space fanfare
        [523, 659, 784, 1047].forEach((freq, i) => {
            this._createOsc(freq, 'square', t + i * 0.1, 0.2, 0.1);
            this._createOsc(freq * 1.5, 'sine', t + i * 0.1, 0.15, 0.05);
        });
    }

    _playGameOver(t) {
        [392, 349, 330, 262].forEach((freq, i) => {
            this._createOsc(freq, 'triangle', t + i * 0.35, 0.5, 0.15);
        });
    }

    _playStart(t) {
        // Rocket launch
        [262, 330, 392, 523, 659].forEach((freq, i) => {
            this._createOsc(freq, 'square', t + i * 0.08, 0.12, 0.1);
        });
    }

    _playPop(t) {
        // Alien appear
        this._createOsc(600, 'sine', t, 0.06, 0.12);
        this._createOsc(900, 'sine', t + 0.03, 0.05, 0.08);
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
            normal: { emoji: '👾', points: 10, weight: 70 },
            golden: { emoji: '👽', points: 50, weight: 15, className: 'golden' },
            bomb: { emoji: '☄️', points: -30, weight: 15, className: 'bomb' }
        };

        // Alternative alien emojis for variety
        this.ALIEN_EMOJIS = ['👾', '👾', '🛸', '👾', '👾'];

        // Score thresholds for leveling up
        this.LEVEL_THRESHOLDS = [50, 150, 300, 500, 750, 1000, 1500, 2000, 3000];

        // Game stats
        this.score = 0;
        this.level = 1;
        this.timeLeft = this.GAME_TIME;
        this.combo = 0;
        this.maxCombo = 0;
        this.totalHits = 0;
        this.totalClicks = 0;
        this.highScore = parseInt(localStorage.getItem('whacanalien_highscore')) || 0;

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

            hole.addEventListener('touchend', (e) => {
                e.preventDefault();
                this._handleClick(e, hole);
            });
        });
    }

    showScreen(screenName) {
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        this.screens[screenName].classList.add('active');
    }

    startGame() {
        this.audio.init();
        this.audio.play('start');

        this.score = 0;
        this.level = 1;
        this.timeLeft = this.GAME_TIME;
        this.combo = 0;
        this.maxCombo = 0;
        this.totalHits = 0;
        this.totalClicks = 0;
        this.activeMoles.clear();
        this.state = GameState.PLAYING;

        this.moles.forEach(mole => {
            mole.classList.remove('up', 'bonked', 'golden', 'bomb');
            mole.dataset.type = 'normal';
            mole.querySelector('.mole-face').textContent = '👾';
        });

        this._updateHUD();
        this.showScreen('game');

        this._startTimer();
        this._startSpawning();
    }

    endGame() {
        this.state = GameState.GAMEOVER;
        this.audio.play('gameover');

        clearInterval(this.timerInterval);
        clearInterval(this.spawnInterval);
        Object.values(this.moleTimers).forEach(t => clearTimeout(t));
        this.moleTimers = {};

        this.moles.forEach(mole => {
            mole.classList.remove('up', 'golden', 'bomb');
        });

        this.elements.finalScore.textContent = this.score;
        this.elements.finalHits.textContent = this.totalHits;
        this.elements.finalCombo.textContent = `x${this.maxCombo}`;
        this.elements.finalLevel.textContent = this.level;

        const accuracy = this.totalClicks > 0
            ? Math.round((this.totalHits / this.totalClicks) * 100)
            : 0;
        this.elements.finalAccuracy.textContent = `${accuracy}%`;

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('whacanalien_highscore', this.highScore);
            this.elements.highScoreMsg.classList.remove('hidden');
        } else {
            this.elements.highScoreMsg.classList.add('hidden');
        }

        setTimeout(() => this.showScreen('gameover'), 500);
    }

    _startTimer() {
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.elements.timer.textContent = this.timeLeft;

            if (this.timeLeft <= 10) {
                this.elements.timer.classList.add('warning');
            } else {
                this.elements.timer.classList.remove('warning');
            }

            if (this.timeLeft <= 0) {
                this.endGame();
            }
        }, 1000);
    }

    _checkLevelUp() {
        const thresholdIndex = this.level - 1;
        if (thresholdIndex < this.LEVEL_THRESHOLDS.length && this.score >= this.LEVEL_THRESHOLDS[thresholdIndex]) {
            this.level++;
            this.elements.level.textContent = this.level;
            this.audio.play('levelup');

            // Restart spawning with faster pace
            clearTimeout(this.spawnInterval);
            this._startSpawning();

            this.elements.level.style.transform = 'scale(1.5)';
            setTimeout(() => {
                this.elements.level.style.transform = 'scale(1)';
            }, 300);
        }
    }

    _startSpawning() {
        const baseInterval = Math.max(400, 1200 - (this.level - 1) * 150);

        const spawn = () => {
            if (this.state !== GameState.PLAYING) return;

            this._spawnMole();

            const nextDelay = baseInterval + Math.random() * 400;
            this.spawnInterval = setTimeout(spawn, nextDelay);
        };

        spawn();
    }

    _spawnMole() {
        const inactiveHoles = [];
        for (let i = 0; i < 9; i++) {
            if (!this.activeMoles.has(i)) inactiveHoles.push(i);
        }

        if (inactiveHoles.length === 0) return;

        const holeIdx = inactiveHoles[Math.floor(Math.random() * inactiveHoles.length)];
        const moleType = this._getRandomMoleType();
        const mole = this.moles[holeIdx];
        const typeConfig = this.MOLE_TYPES[moleType];

        // Set alien appearance
        if (moleType === 'normal') {
            const randomAlien = this.ALIEN_EMOJIS[Math.floor(Math.random() * this.ALIEN_EMOJIS.length)];
            mole.querySelector('.mole-face').textContent = randomAlien;
        } else {
            mole.querySelector('.mole-face').textContent = typeConfig.emoji;
        }

        mole.dataset.type = moleType;
        mole.classList.remove('golden', 'bomb', 'bonked');
        if (typeConfig.className) {
            mole.classList.add(typeConfig.className);
        }

        mole.classList.add('up');
        this.activeMoles.add(holeIdx);
        this.audio.play('pop');

        const displayTime = Math.max(600, 1500 - (this.level - 1) * 120);
        this.moleTimers[holeIdx] = setTimeout(() => {
            this._hideMole(holeIdx);
        }, displayTime + Math.random() * 500);
    }

    _getRandomMoleType() {
        const roll = Math.random() * 100;
        let cumulative = 0;

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

    _handleClick(e, hole) {
        if (this.state !== GameState.PLAYING) return;

        this.totalClicks++;
        const holeIdx = parseInt(hole.dataset.hole);
        const mole = this.moles[holeIdx];

        if (!mole.classList.contains('up') || mole.classList.contains('bonked')) {
            this.combo = 0;
            this._updateHUD();
            return;
        }

        const moleType = mole.dataset.type;
        const typeConfig = this.MOLE_TYPES[moleType];

        clearTimeout(this.moleTimers[holeIdx]);
        delete this.moleTimers[holeIdx];

        if (moleType === 'bomb') {
            this._handleBombHit(holeIdx, e);
        } else {
            this._handleMoleHit(holeIdx, moleType, typeConfig, e);
        }
    }

    _handleMoleHit(holeIdx, moleType, typeConfig, e) {
        const mole = this.moles[holeIdx];

        this.combo++;
        this.totalHits++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;

        const comboMultiplier = Math.min(5, 1 + Math.floor(this.combo / 3));
        const points = typeConfig.points * comboMultiplier;
        this.score += points;

        // Check for level up based on score
        this._checkLevelUp();

        this.audio.play(moleType === 'golden' ? 'golden' : 'whack');

        mole.classList.add('bonked');
        mole.classList.remove('up');

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

        this.elements.board.classList.add('shake');
        setTimeout(() => this.elements.board.classList.remove('shake'), 300);

        const rect = mole.closest('.hole').getBoundingClientRect();
        this._showFloatScore(
            rect.left + rect.width / 2,
            rect.top,
            `${this.MOLE_TYPES.bomb.points}`,
            'penalty'
        );

        mole.classList.add('bonked');
        mole.classList.remove('up');

        setTimeout(() => {
            mole.classList.remove('bonked', 'bomb');
            this.activeMoles.delete(holeIdx);
        }, 300);

        this.timeLeft = Math.max(1, this.timeLeft - 3);

        this._updateHUD();
    }

    _updateHUD() {
        this.elements.score.textContent = this.score;
        this.elements.level.textContent = this.level;
        this.elements.timer.textContent = this.timeLeft;
        const comboMultiplier = Math.min(5, 1 + Math.floor(this.combo / 3));
        this.elements.combo.textContent = `x${comboMultiplier}`;

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
