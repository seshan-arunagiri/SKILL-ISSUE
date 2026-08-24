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

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

// Color Palette
const COLORS = {
    background: '#211D1B',
    player: '#D9722C',
    obstacle: '#C1440E',
    text: '#F4ECDD',
    accent: '#E3B23C',
    walls: '#5C4433'
};

const DIFFICULTIES = {
    EASY: {
        directions: ['top'],
        speed: 2,
        spawnIntervalMs: 1200,
        maxActiveObstacles: 1
    },
    MEDIUM: {
        directions: ['top', 'left', 'right'],
        speed: 3,
        spawnIntervalMs: 900,
        maxActiveObstacles: 3
    },
    HARD: {
        directions: ['top', 'left', 'right'],
        speed: 4.5,
        spawnIntervalMs: 500,
        maxActiveObstacles: 6
    },
    MASTER: {
        directions: ['top', 'bottom', 'left', 'right'],
        speed: 6,
        spawnIntervalMs: 350,
        maxActiveObstacles: 10,
        isMaster: true
    }
};

const MASTER_GAP_START = 270;
const MASTER_GAP_END = 330;
const MASTER_INNER_MIN = 120;
const MASTER_INNER_MAX = 480;

// --- Game State ---
let gameState = 'MENU'; // MENU, PLAYING, PAUSED, GAME_OVER
let currentConfig = null;
let score = 0;
let bestScore = parseInt(localStorage.getItem('bestScore')) || 0;

// Timers
let gameTimeAccumulator = 0;
let lastFrameTime = 0;
let lastSpawnTime = 0;

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


// --- Initialization Methods ---
function setupInput() {
    window.addEventListener('keydown', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = true;
        }

        // Handle Escape to pause/resume
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

    // UI Buttons
    difficultyButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const diffKey = e.target.getAttribute('data-diff');
            startGame(DIFFICULTIES[diffKey]);
        });
    });

    retryBtn.addEventListener('click', () => {
        startGame(currentConfig);
    });

    menuBtn.addEventListener('click', () => {
        setGameState('MENU');
    });
}


// --- Game Logic ---

function setGameState(newState) {
    gameState = newState;
    
    // Hide all UI overlays
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));

    // Show appropriate overlay based on state
    if (newState === 'MENU') {
        screens.MENU.classList.remove('hidden');
    } else if (newState === 'PAUSED') {
        screens.PAUSED.classList.remove('hidden');
    } else if (newState === 'GAME_OVER') {
        finalScoreEl.innerText = `Score: ${score}`;
        bestScoreEl.innerText = `Best: ${bestScore}`;
        screens.GAME_OVER.classList.remove('hidden');
    }
    // PLAYING state has no full-screen HTML overlay
}

function startGame(config) {
    currentConfig = config;
    
    // Reset player position
    player.x = CANVAS_WIDTH / 2 - player.width / 2;
    player.y = CANVAS_HEIGHT / 2 - player.height / 2;
    
    obstacles = [];
    score = 0;
    
    // Reset time tracking
    gameTimeAccumulator = 0;
    lastSpawnTime = 0;
    
    setGameState('PLAYING');
}

function spawnObstacle(config) {
    if (obstacles.length >= config.maxActiveObstacles) return;

    const dir = config.directions[Math.floor(Math.random() * config.directions.length)];
    
    const obs = {
        width: 25,
        height: 25,
        x: 0,
        y: 0,
        dx: 0,
        dy: 0
    };

    if (config.isMaster) {
        let valid = false;
        while (!valid) {
            if (dir === 'top' || dir === 'bottom') {
                obs.x = Math.random() * (CANVAS_WIDTH - obs.width);
                if (obs.x >= MASTER_GAP_START && obs.x + obs.width <= MASTER_GAP_END) valid = true;
            } else {
                obs.y = Math.random() * (CANVAS_HEIGHT - obs.height);
                if (obs.y >= MASTER_GAP_START && obs.y + obs.height <= MASTER_GAP_END) valid = true;
            }
        }
    } else {
        if (dir === 'top' || dir === 'bottom') {
            obs.x = Math.random() * (CANVAS_WIDTH - obs.width);
        } else {
            obs.y = Math.random() * (CANVAS_HEIGHT - obs.height);
        }
    }

    if (dir === 'top') {
        obs.y = -obs.height;
        obs.dy = config.speed;
    } else if (dir === 'bottom') {
        obs.y = CANVAS_HEIGHT;
        obs.dy = -config.speed;
    } else if (dir === 'left') {
        obs.x = -obs.width;
        obs.dx = config.speed;
    } else if (dir === 'right') {
        obs.x = CANVAS_WIDTH;
        obs.dx = -config.speed;
    }

    obstacles.push(obs);
}

function update(deltaTime) {
    if (gameState !== 'PLAYING') return;

    // Track active game time (skipping pauses)
    gameTimeAccumulator += deltaTime;

    // --- Player Movement ---
    player.dx = 0;
    player.dy = 0;

    if (keys.ArrowUp || keys.w) player.dy = -player.speed;
    if (keys.ArrowDown || keys.s) player.dy = player.speed;
    if (keys.ArrowLeft || keys.a) player.dx = -player.speed;
    if (keys.ArrowRight || keys.d) player.dx = player.speed;

    player.x += player.dx;
    player.y += player.dy;

    // Clamp player
    if (currentConfig.isMaster) {
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
    if (gameTimeAccumulator - lastSpawnTime > currentConfig.spawnIntervalMs) {
        spawnObstacle(currentConfig);
        lastSpawnTime = gameTimeAccumulator;
    }

    // --- Obstacle Movement & Collision ---
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        
        obs.x += obs.dx;
        obs.y += obs.dy;
        
        // Remove if off screen
        if (obs.x > CANVAS_WIDTH || obs.x + obs.width < 0 || obs.y > CANVAS_HEIGHT || obs.y + obs.height < 0) {
            obstacles.splice(i, 1);
            continue;
        }

        // AABB Collision detection
        if (
            player.x < obs.x + obs.width &&
            player.x + player.width > obs.x &&
            player.y < obs.y + obs.height &&
            player.y + player.height > obs.y
        ) {
            setGameState('GAME_OVER');
            if (score > bestScore) {
                bestScore = score;
                localStorage.setItem('bestScore', bestScore);
            }
        }
    }

    // --- Score Update ---
    score = Math.floor(gameTimeAccumulator / 1000);
}

function draw() {
    // 1. Draw the background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Draw walls for Master mode
    if (currentConfig && currentConfig.isMaster) {
        ctx.fillStyle = COLORS.walls;
        
        // Top Wall
        ctx.fillRect(100, 100, 170, 20); // Left of gap
        ctx.fillRect(330, 100, 170, 20); // Right of gap
        
        // Bottom Wall
        ctx.fillRect(100, 480, 170, 20); // Left of gap
        ctx.fillRect(330, 480, 170, 20); // Right of gap
        
        // Left Wall
        ctx.fillRect(100, 120, 20, 150); // Top of gap
        ctx.fillRect(100, 330, 20, 150); // Bottom of gap
        
        // Right Wall
        ctx.fillRect(480, 120, 20, 150); // Top of gap
        ctx.fillRect(480, 330, 20, 150); // Bottom of gap
    }

    // Don't draw player and obstacles if we are in the main menu
    if (gameState === 'MENU') return;

    // 3. Draw the player
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // 4. Draw the obstacles
    ctx.fillStyle = COLORS.obstacle;
    for (const obs of obstacles) {
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    }

    // 5. Draw the score
    ctx.fillStyle = COLORS.accent;
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 15, 35);
}

function gameLoop(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    
    // Calculate delta time
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    update(deltaTime);
    draw();
    
    requestAnimationFrame(gameLoop);
}

// --- Start the Game ---
setupInput();
setGameState('MENU'); // Initialize properly to MENU state
requestAnimationFrame(gameLoop);
