// --- Game Configuration & Constants ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const screens = {
    MENU: document.getElementById('menuScreen'),
    PAUSED: document.getElementById('pauseScreen'),
    GAME_OVER: document.getElementById('gameOverScreen')
};

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
        scoreRate: 0.5
    },
    MEDIUM: {
        directions: ['top', 'left', 'right'],
        speed: 3,
        spawnIntervalMs: 900,
        maxActiveObstacles: 3,
        scoreRate: 1.0
    },
    HARD: {
        directions: ['top', 'left', 'right'],
        speed: 4.5,
        spawnIntervalMs: 500,
        maxActiveObstacles: 6,
        scoreRate: 1.75
    },
    MASTER: {
        directions: ['top', 'bottom', 'left', 'right'],
        speed: 6,
        spawnIntervalMs: 350,
        maxActiveObstacles: 10,
        isMaster: true,
        scoreRate: 3.0
    }
};

const MASTER_INNER_MIN = 120;
const MASTER_INNER_MAX = 480;

// --- Game State ---
let gameState = 'MENU';
let currentConfig = null;
let liveConfig = null;
let currentDifficultyKey = '';
let score = 0;
let bestScore = 0;

let escalations = 0;
let escalationTextEndTime = 0;

// Settings
let isMuted = localStorage.getItem('isMuted') === 'true';
muteToggle.checked = isMuted;

// Timers
let gameTimeAccumulator = 0;
let lastFrameTime = 0;
let lastSpawnTime = 0;
let shakeEndTime = 0;
let playerPulseEndTime = 0;

// Player object
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
    });

    window.addEventListener('keyup', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = false;
        }
    });

    difficultyButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const diffKey = e.target.getAttribute('data-diff');
            startGame(diffKey);
        });
    });

    retryBtn.addEventListener('click', () => {
        startGame(currentDifficultyKey);
    });

    menuBtn.addEventListener('click', () => {
        setGameState('MENU');
    });

    muteToggle.addEventListener('change', (e) => {
        isMuted = e.target.checked;
        localStorage.setItem('isMuted', isMuted);
    });
}


// --- Game Logic ---

function setGameState(newState) {
    gameState = newState;
    
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));

    if (newState === 'MENU') {
        screens.MENU.classList.remove('hidden');
    } else if (newState === 'PAUSED') {
        screens.PAUSED.classList.remove('hidden');
    } else if (newState === 'GAME_OVER') {
        finalScoreEl.innerText = `Score: ${Math.round(score)}`;
        bestScoreEl.innerText = `Best: ${Math.round(bestScore)}`;
        screens.GAME_OVER.classList.remove('hidden');
    }
}

function startGame(diffKey) {
    currentDifficultyKey = diffKey;
    currentConfig = DIFFICULTIES[diffKey];
    
    // Create a live config instance we can mutate via escalations
    liveConfig = {
        directions: [...currentConfig.directions],
        speed: currentConfig.speed,
        spawnIntervalMs: currentConfig.spawnIntervalMs,
        maxActiveObstacles: currentConfig.maxActiveObstacles,
        isMaster: currentConfig.isMaster,
        scoreRate: currentConfig.scoreRate
    };
    
    // Load difficulty-specific best score
    bestScore = parseFloat(localStorage.getItem(`bestScore_${diffKey}`)) || 0;
    
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

    // After the first escalation, or in Master mode, apply inward angular velocity
    if (liveConfig.isMaster || escalations > 0) {
        // Target a random inner area so it passes near the middle
        const targetX = MASTER_INNER_MIN + Math.random() * (MASTER_INNER_MAX - MASTER_INNER_MIN);
        const targetY = MASTER_INNER_MIN + Math.random() * (MASTER_INNER_MAX - MASTER_INNER_MIN);
        
        const angle = Math.atan2(targetY - (obs.y + obs.height / 2), targetX - (obs.x + obs.width / 2));
        obs.dx = Math.cos(angle) * liveConfig.speed;
        obs.dy = Math.sin(angle) * liveConfig.speed;
    } else {
        // Pure straight lines for early unescalated difficulties
        if (dir === 'top') obs.dy = liveConfig.speed;
        if (dir === 'bottom') obs.dy = -liveConfig.speed;
        if (dir === 'left') obs.dx = liveConfig.speed;
        if (dir === 'right') obs.dx = -liveConfig.speed;
    }

    obstacles.push(obs);
    playSound('spawn');
}

function update(deltaTime) {
    if (gameState !== 'PLAYING') return;

    gameTimeAccumulator += deltaTime;

    // --- Escalation System ---
    const prevEscalations = escalations;
    escalations = Math.floor(gameTimeAccumulator / 60000);

    if (escalations > prevEscalations) {
        // Escalate difficulty parameters
        liveConfig.speed *= 1.15;
        liveConfig.spawnIntervalMs = Math.max(200, liveConfig.spawnIntervalMs * 0.85);
        
        // Show escalation text flash
        escalationTextEndTime = Date.now() + 1000;
        
        // Introduce all directions to force unpredictability
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
            
            if (score > bestScore) {
                bestScore = score;
                localStorage.setItem(`bestScore_${currentDifficultyKey}`, bestScore);
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
    ctx.save();

    if (gameState === 'GAME_OVER' && Date.now() < shakeEndTime) {
        const dx = (Math.random() - 0.5) * 10;
        const dy = (Math.random() - 0.5) * 10;
        ctx.translate(dx, dy);
    }

    // 1. Draw the background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Draw walls for Master mode
    if (liveConfig && liveConfig.isMaster) {
        ctx.fillStyle = COLORS.walls;
        
        ctx.fillRect(100, 100, 400, 20); // Top wall
        ctx.fillRect(100, 480, 400, 20); // Bottom wall
        ctx.fillRect(100, 120, 20, 360); // Left wall
        ctx.fillRect(480, 120, 20, 360); // Right wall
    }

    if (gameState !== 'MENU') {
        // 3. Draw the player
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

        // 4. Draw the obstacles
        ctx.fillStyle = COLORS.obstacle;
        ctx.strokeStyle = COLORS.obstacleOutline;
        ctx.lineWidth = 1;
        for (const obs of obstacles) {
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
        }

        // 5. Draw the score
        ctx.fillStyle = COLORS.accent;
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Score: ' + Math.round(score), 15, 35);

        // 6. Draw Milestone Badge
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
        
        // 7. Draw Escalation Text Flash
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
setGameState('MENU');
requestAnimationFrame(gameLoop);
