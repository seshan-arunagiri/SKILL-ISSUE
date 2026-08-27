// --- Game Configuration & Constants ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');

const gameContainer = document.getElementById('gameContainer');

const screens = {
    HOME: document.getElementById('homeScreen'),
    MENU: document.getElementById('menuScreen'),
    PAUSED: document.getElementById('pauseScreen'),
    GAME_OVER: document.getElementById('gameOverScreen')
};

const playBtn = document.getElementById('playBtn');
const highScoreBtn = document.getElementById('highScoreBtn');
const highScoreModal = document.getElementById('highScoreModal');
const closeModalBtn = document.getElementById('closeModalBtn');

const menuBackBtn = document.getElementById('menuBackBtn');
const pauseBackBtn = document.getElementById('pauseBackBtn');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScoreDisplay');
const retryBtn = document.getElementById('retryBtn');
const menuBtn = document.getElementById('menuBtn');
const difficultyButtons = document.querySelectorAll('#menuScreen .menu-btn');
const muteToggle = document.getElementById('muteToggle');

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

// Color Palette
const COLORS = {
    background: '#211D1B',
    player: '#D9722C',
    playerOutline: '#F4ECDD',
    obstacle: '#A63A3A',
    obstacleOutline: '#6E1F1F',
    text: '#F4ECDD',
    accent: '#E3B23C',
    walls: '#5C4433'
};

const DIFFICULTIES = {
    EASY: {
        directions: ['top'],
        speed: 2,
        spawnIntervalMs: 1200,
        maxActiveObstacles: 1,
        scoreRate: 0.5,
        predictiveChance: 0
    },
    MEDIUM: {
        directions: ['top', 'left', 'right'],
        speed: 3,
        spawnIntervalMs: 900,
        maxActiveObstacles: 3,
        scoreRate: 1.0,
        predictiveChance: 0.25
    },
    HARD: {
        directions: ['top', 'left', 'right'],
        speed: 4.5,
        spawnIntervalMs: 500,
        maxActiveObstacles: 6,
        scoreRate: 1.75,
        predictiveChance: 0.50
    },
    MASTER: {
        directions: ['top', 'bottom', 'left', 'right'],
        speed: 6,
        spawnIntervalMs: 350,
        maxActiveObstacles: 10,
        isMaster: true,
        scoreRate: 3.0,
        predictiveChance: 0.80
    }
};

const MASTER_INNER_MIN = 120;
const MASTER_INNER_MAX = 480;

// --- Game State ---
let gameState = 'HOME';
let currentConfig = null;
let liveConfig = null;
let currentDifficultyKey = '';
let score = 0;
let bestScore = 0;

let escalations = 0;
let escalationTextEndTime = 0;

// Settings & LocalStorage
let isMuted = localStorage.getItem('isMuted') === 'true';
muteToggle.checked = isMuted;

// Use a single JSON object for scores
let bestScores = { EASY: 0, MEDIUM: 0, HARD: 0, MASTER: 0 };
try {
    const stored = JSON.parse(localStorage.getItem('skillIssueScores'));
    if (stored) {
        bestScores = { ...bestScores, ...stored };
    } else {
        // Fallback for previous implementation tracking
        if (localStorage.getItem('bestScore_EASY')) bestScores.EASY = parseFloat(localStorage.getItem('bestScore_EASY'));
        if (localStorage.getItem('bestScore_MEDIUM')) bestScores.MEDIUM = parseFloat(localStorage.getItem('bestScore_MEDIUM'));
        if (localStorage.getItem('bestScore_HARD')) bestScores.HARD = parseFloat(localStorage.getItem('bestScore_HARD'));
        if (localStorage.getItem('bestScore_MASTER')) bestScores.MASTER = parseFloat(localStorage.getItem('bestScore_MASTER'));
    }
} catch (e) {
    console.warn("Could not load scores", e);
}

function saveScores() {
    localStorage.setItem('skillIssueScores', JSON.stringify(bestScores));
}

// Timers
let gameTimeAccumulator = 0;
let lastFrameTime = 0;
let lastSpawnTime = 0;
let shakeEndTime = 0;
let playerPulseEndTime = 0;

// Objects
const player = {
    width: 30,
    height: 30,
    x: 0,
    y: 0,
    speed: 5,
    dx: 0,
    dy: 0
};

let obstacles = [];
let homeObstacles = [];

const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    w: false,
    a: false,
    s: false,
    d: false
};

// --- Web Audio API ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (isMuted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'spawn') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1000, now + 0.05);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    } else if (type === 'collision') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'highscore') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(600, now + 0.3);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
}


// --- Initialization Methods ---
function resizeBgCanvas() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeBgCanvas);
resizeBgCanvas();

function setupInput() {
    window.addEventListener('keydown', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = true;
        }

        if (e.key === 'Escape') {
            if (gameState === 'PLAYING') {
                setGameState('PAUSED');
            } else if (gameState === 'PAUSED') {
                setGameState('PLAYING');
            }
        }

        // R key - restart the game
        if (e.key.toLowerCase() === 'r') {
            if (gameState === 'GAME_OVER') {
                resetGame();
                setGameState('PLAYING');
            }
        }
    });
}

    window.addEventListener('keyup', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = false;
        }
    });

    // Landing Page
    playBtn.addEventListener('click', () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        setGameState('MENU');
    });

    // High Score Modal
    highScoreBtn.addEventListener('click', () => {
        ['EASY', 'MEDIUM', 'HARD', 'MASTER'].forEach(diff => {
            const span = document.getElementById(`score-${diff}`);
            const val = bestScores[diff];
            span.innerText = val > 0 ? Math.round(val) : '—';
        });
        highScoreModal.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', () => {
        highScoreModal.classList.add('hidden');
    });

    // Difficulty Menu
    menuBackBtn.addEventListener('click', () => {
        setGameState('HOME');
    });

    difficultyButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const diffKey = e.target.getAttribute('data-diff');
            startGame(diffKey);
        });
    });

    muteToggle.addEventListener('change', (e) => {
        isMuted = e.target.checked;
        localStorage.setItem('isMuted', isMuted);
    });

    // Pause Screen
    pauseBackBtn.addEventListener('click', () => {
        setGameState('MENU');
    });

    // Game Over Screen
    retryBtn.addEventListener('click', () => {
        startGame(currentDifficultyKey);
    });

    menuBtn.addEventListener('click', () => {
        setGameState('MENU');
    });
}

function initHomeObstacles() {
    homeObstacles = [];
    for (let i = 0; i < 8; i++) {
        homeObstacles.push({
            x: Math.random() * bgCanvas.width,
            y: Math.random() * bgCanvas.height,
            dx: (Math.random() - 0.5) * 1.5,
            dy: (Math.random() - 0.5) * 1.5,
            width: 25,
            height: 25
        });
    }
}


// --- Game Logic ---

function setGameState(newState) {
    gameState = newState;
    
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));

    if (newState === 'HOME') {
        initHomeObstacles();
        screens.HOME.classList.remove('hidden');
        gameContainer.classList.add('hidden'); 
    } else {
        gameContainer.classList.remove('hidden'); 
        if (newState === 'MENU') {
            screens.MENU.classList.remove('hidden');
        } else if (newState === 'PAUSED') {
            screens.PAUSED.classList.remove('hidden');
        } else if (newState === 'GAME_OVER') {
            finalScoreEl.innerText = `Score: ${Math.round(score)}`;
            
            // Format difficulty label, e.g. "EASY" -> "Easy"
            const diffLabel = currentDifficultyKey.charAt(0).toUpperCase() + currentDifficultyKey.slice(1).toLowerCase();
            bestScoreEl.innerText = `Best: ${Math.round(bestScore)} (${diffLabel})`;
            
            screens.GAME_OVER.classList.remove('hidden');
        }
    }
}

function startGame(diffKey) {
    currentDifficultyKey = diffKey;
    currentConfig = DIFFICULTIES[diffKey];
    
    liveConfig = {
        directions: [...currentConfig.directions],
        speed: currentConfig.speed,
        spawnIntervalMs: currentConfig.spawnIntervalMs,
        maxActiveObstacles: currentConfig.maxActiveObstacles,
        isMaster: currentConfig.isMaster,
        scoreRate: currentConfig.scoreRate,
        predictiveChance: currentConfig.predictiveChance
    };
    
    // Load score directly from our combined bestScores object
    bestScore = bestScores[diffKey] || 0;
    
    player.x = CANVAS_WIDTH / 2 - player.width / 2;
    player.y = CANVAS_HEIGHT / 2 - player.height / 2;
    
    obstacles = [];
    score = 0;
    escalations = 0;
    
    gameTimeAccumulator = 0;
    lastSpawnTime = 0;
    shakeEndTime = 0;
    playerPulseEndTime = 0;
    escalationTextEndTime = 0;
    
    setGameState('PLAYING');
}

function spawnObstacle() {
    if (obstacles.length >= liveConfig.maxActiveObstacles) return;

    const dir = liveConfig.directions[Math.floor(Math.random() * liveConfig.directions.length)];
    
    const obs = {
        width: 25,
        height: 25,
        x: 0,
        y: 0,
        dx: 0,
        dy: 0,
        hasCausedCloseCall: false
    };

    if (dir === 'top' || dir === 'bottom') {
        obs.x = Math.random() * (CANVAS_WIDTH - obs.width);
    } else {
        obs.y = Math.random() * (CANVAS_HEIGHT - obs.height);
    }

    if (dir === 'top') {
        obs.y = -obs.height;
    } else if (dir === 'bottom') {
        obs.y = CANVAS_HEIGHT;
    } else if (dir === 'left') {
        obs.x = -obs.width;
    } else if (dir === 'right') {
        obs.x = CANVAS_WIDTH;
    }

    const isPredictive = Math.random() < liveConfig.predictiveChance;

    if (isPredictive) {
        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        const obsCenterX = obs.x + obs.width / 2;
        const obsCenterY = obs.y + obs.height / 2;

        const dist = Math.hypot(playerCenterX - obsCenterX, playerCenterY - obsCenterY);
        const travelTimeFrames = dist / liveConfig.speed;

        let targetX = playerCenterX + player.dx * travelTimeFrames;
        let targetY = playerCenterY + player.dy * travelTimeFrames;

        const minX = liveConfig.isMaster ? MASTER_INNER_MIN : 0;
        const maxX = liveConfig.isMaster ? MASTER_INNER_MAX : CANVAS_WIDTH;
        const minY = liveConfig.isMaster ? MASTER_INNER_MIN : 0;
        const maxY = liveConfig.isMaster ? MASTER_INNER_MAX : CANVAS_HEIGHT;

        targetX = Math.max(minX, Math.min(maxX, targetX));
        targetY = Math.max(minY, Math.min(maxY, targetY));

        const angle = Math.atan2(targetY - obsCenterY, targetX - obsCenterX);
        obs.dx = Math.cos(angle) * liveConfig.speed;
        obs.dy = Math.sin(angle) * liveConfig.speed;

    } else if (liveConfig.isMaster || escalations > 0) {
        const targetX = MASTER_INNER_MIN + Math.random() * (MASTER_INNER_MAX - MASTER_INNER_MIN);
        const targetY = MASTER_INNER_MIN + Math.random() * (MASTER_INNER_MAX - MASTER_INNER_MIN);
        
        const angle = Math.atan2(targetY - (obs.y + obs.height / 2), targetX - (obs.x + obs.width / 2));
        obs.dx = Math.cos(angle) * liveConfig.speed;
        obs.dy = Math.sin(angle) * liveConfig.speed;
    } else {
        if (dir === 'top') obs.dy = liveConfig.speed;
        if (dir === 'bottom') obs.dy = -liveConfig.speed;
        if (dir === 'left') obs.dx = liveConfig.speed;
        if (dir === 'right') obs.dx = -liveConfig.speed;
    }

    obstacles.push(obs);
    playSound('spawn');
}

function update(deltaTime) {
    if (gameState === 'HOME') {
        for (const obs of homeObstacles) {
            obs.x += obs.dx;
            obs.y += obs.dy;
            
            if (obs.x > bgCanvas.width) obs.x = -obs.width;
            if (obs.x < -obs.width) obs.x = bgCanvas.width;
            if (obs.y > bgCanvas.height) obs.y = -obs.height;
            if (obs.y < -obs.height) obs.y = bgCanvas.height;
        }
        return; 
    }

    if (gameState !== 'PLAYING') return;

    gameTimeAccumulator += deltaTime;

    // --- Escalation System ---
    const prevEscalations = escalations;
    escalations = Math.floor(gameTimeAccumulator / 60000);

    if (escalations > prevEscalations) {
        liveConfig.speed *= 1.15;
        liveConfig.spawnIntervalMs = Math.max(200, liveConfig.spawnIntervalMs * 0.85);
        escalationTextEndTime = Date.now() + 1000;
        liveConfig.directions = ['top', 'bottom', 'left', 'right'];
    }

    // --- Player Movement ---
    player.dx = 0;
    player.dy = 0;

    if (keys.ArrowUp || keys.w) player.dy = -player.speed;
    if (keys.ArrowDown || keys.s) player.dy = player.speed;
    if (keys.ArrowLeft || keys.a) player.dx = -player.speed;
    if (keys.ArrowRight || keys.d) player.dx = player.speed;

    player.x += player.dx;
    player.y += player.dy;

    if (liveConfig.isMaster) {
        if (player.x < MASTER_INNER_MIN) player.x = MASTER_INNER_MIN;
        if (player.x + player.width > MASTER_INNER_MAX) player.x = MASTER_INNER_MAX - player.width;
        if (player.y < MASTER_INNER_MIN) player.y = MASTER_INNER_MIN;
        if (player.y + player.height > MASTER_INNER_MAX) player.y = MASTER_INNER_MAX - player.height;
    } else {
        if (player.x < 0) player.x = 0;
        if (player.x + player.width > CANVAS_WIDTH) player.x = CANVAS_WIDTH - player.width;
        if (player.y < 0) player.y = 0;
        if (player.y + player.height > CANVAS_HEIGHT) player.y = CANVAS_HEIGHT - player.height;
    }

    // --- Obstacle Spawning ---
    if (gameTimeAccumulator - lastSpawnTime > liveConfig.spawnIntervalMs) {
        spawnObstacle();
        lastSpawnTime = gameTimeAccumulator;
    }

    // --- Obstacle Movement & Collision ---
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        
        obs.x += obs.dx;
        obs.y += obs.dy;
        
        if (obs.x > CANVAS_WIDTH || obs.x + obs.width < 0 || obs.y > CANVAS_HEIGHT || obs.y + obs.height < 0) {
            obstacles.splice(i, 1);
            continue;
        }

        const isColliding = (
            player.x < obs.x + obs.width &&
            player.x + player.width > obs.x &&
            player.y < obs.y + obs.height &&
            player.y + player.height > obs.y
        );

        if (isColliding) {
            playSound('collision');
            shakeEndTime = Date.now() + 150;
            setGameState('GAME_OVER');
            
            // Per-difficulty score tracking via the unified JSON object
            if (score > bestScore) {
                bestScore = score;
                bestScores[currentDifficultyKey] = score;
                saveScores();
                
                setTimeout(() => playSound('highscore'), 200);
            }
        } else if (!obs.hasCausedCloseCall) {
            const closeDist = 15;
            const isClose = (
                player.x < obs.x + obs.width + closeDist &&
                player.x + player.width > obs.x - closeDist &&
                player.y < obs.y + obs.height + closeDist &&
                player.y + player.height > obs.y - closeDist
            );
            if (isClose) {
                obs.hasCausedCloseCall = true;
                playerPulseEndTime = Date.now() + 200;
            }
        }
    }

    // --- Score Update ---
    score = (gameTimeAccumulator / 1000) * liveConfig.scoreRate;
}

function getMilestone(seconds) {
    if (seconds < 30) return { text: 'Beginner', color: '#7A8B69' };
    if (seconds < 60) return { text: 'Survivor', color: '#D9722C' };
    if (seconds < 120) return { text: 'Expert', color: '#C1440E' };
    if (seconds < 180) return { text: 'Master', color: '#5C4433' };
    return { text: 'Legendary', color: '#E3B23C' };
}

function draw() {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    if (gameState === 'HOME') {
        bgCtx.fillStyle = COLORS.obstacle;
        bgCtx.strokeStyle = COLORS.obstacleOutline;
        bgCtx.lineWidth = 1;
        for (const obs of homeObstacles) {
            bgCtx.fillRect(obs.x, obs.y, obs.width, obs.height);
            bgCtx.strokeRect(obs.x, obs.y, obs.width, obs.height);
        }
        return; 
    }

    ctx.save();

    if (gameState === 'GAME_OVER' && Date.now() < shakeEndTime) {
        const dx = (Math.random() - 0.5) * 10;
        const dy = (Math.random() - 0.5) * 10;
        ctx.translate(dx, dy);
    }

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (liveConfig && liveConfig.isMaster) {
        ctx.fillStyle = COLORS.walls;
        
        ctx.fillRect(100, 100, 400, 20); // Top wall
        ctx.fillRect(100, 480, 400, 20); // Bottom wall
        ctx.fillRect(100, 120, 20, 360); // Left wall
        ctx.fillRect(480, 120, 20, 360); // Right wall
    }

    if (gameState !== 'MENU') {
        ctx.fillStyle = COLORS.player;
        let pWidth = player.width;
        let pHeight = player.height;
        let px = player.x;
        let py = player.y;

        if (Date.now() < playerPulseEndTime) {
            const remaining = playerPulseEndTime - Date.now();
            const scale = 1 + Math.sin(((200 - remaining) / 200) * Math.PI) * 0.2;
            pWidth *= scale;
            pHeight *= scale;
            px -= (pWidth - player.width) / 2;
            py -= (pHeight - player.height) / 2;
        }
        ctx.fillRect(px, py, pWidth, pHeight);
        
        ctx.strokeStyle = COLORS.playerOutline;
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, pWidth, pHeight);

        ctx.fillStyle = COLORS.obstacle;
        ctx.strokeStyle = COLORS.obstacleOutline;
        ctx.lineWidth = 1;
        for (const obs of obstacles) {
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
        }

        ctx.fillStyle = COLORS.accent;
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Score: ' + Math.round(score), 15, 35);

        const secondsSurvived = gameTimeAccumulator / 1000;
        const badge = getMilestone(secondsSurvived);
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'right';
        
        const textWidth = ctx.measureText(badge.text).width;
        const badgeX = CANVAS_WIDTH - textWidth - 30;
        const badgeY = 15;
        
        ctx.fillStyle = badge.color;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, textWidth + 20, 26, 6);
        ctx.fill();
        
        ctx.fillStyle = (badge.text === 'Legendary') ? '#211D1B' : '#F4ECDD';
        ctx.fillText(badge.text, CANVAS_WIDTH - 20, badgeY + 18);
        
        if (Date.now() < escalationTextEndTime) {
            const alpha = Math.max(0, (escalationTextEndTime - Date.now()) / 1000);
            ctx.fillStyle = COLORS.accent;
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.globalAlpha = alpha;
            ctx.fillText('Speeding up!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 4);
            ctx.globalAlpha = 1.0;
        }
    }

    ctx.restore();
}

function gameLoop(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    update(deltaTime);
    draw();
    
    requestAnimationFrame(gameLoop);
}

// --- Start the Game ---
setupInput();
setGameState('HOME');
requestAnimationFrame(gameLoop);
