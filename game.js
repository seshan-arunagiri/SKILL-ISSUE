// --- Game Configuration & Constants ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const difficultyButtons = document.querySelectorAll('.overlay button');

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

// Color Palette (from user requirements)
const COLORS = {
    background: '#211D1B',
    player: '#D9722C',
    obstacle: '#C1440E',
    text: '#F4ECDD',
    accent: '#E3B23C'
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
    }
};

// --- Game State ---
let gameState = 'START'; // START, PLAYING, GAME_OVER
let currentConfig = null;
let isGameOver = false;
let gameStartTime = 0;
let lastSpawnTime = 0;
let score = 0;
let bestScore = parseInt(localStorage.getItem('bestScore')) || 0;

// Player object
const player = {
    width: 30,
    height: 30,
    x: CANVAS_WIDTH / 2 - 15,
    y: CANVAS_HEIGHT / 2 - 15,
    speed: 5,
    dx: 0,
    dy: 0
};

// Array to hold active obstacles
let obstacles = [];

// Input state tracking
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

        // Handle game restart
        if (gameState === 'GAME_OVER' && (e.key === 'r' || e.key === 'R')) {
            startGame(currentConfig);
        }
    });

    window.addEventListener('keyup', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = false;
        }
    });

    // UI Buttons for difficulty selection
    difficultyButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const diffKey = e.target.getAttribute('data-diff');
            startGame(DIFFICULTIES[diffKey]);
        });
    });
}


// --- Game Logic ---

/**
 * Initializes and starts a new game with the given difficulty configuration.
 */
function startGame(config) {
    currentConfig = config;
    gameState = 'PLAYING';
    
    // Reset player position
    player.x = CANVAS_WIDTH / 2 - player.width / 2;
    player.y = CANVAS_HEIGHT / 2 - player.height / 2;
    
    // Clear obstacles
    obstacles = [];
    
    // Reset tracking variables
    score = 0;
    gameStartTime = Date.now();
    lastSpawnTime = Date.now();
    
    // Hide UI
    startScreen.classList.add('hidden');
}

/**
 * Spawns a single obstacle based on the active difficulty config.
 */
function spawnObstacle(config) {
    if (obstacles.length >= config.maxActiveObstacles) {
        return;
    }

    const dir = config.directions[Math.floor(Math.random() * config.directions.length)];
    
    const obs = {
        width: 25,
        height: 25,
        x: 0,
        y: 0,
        dx: 0,
        dy: 0
    };

    if (dir === 'top') {
        obs.x = Math.random() * (CANVAS_WIDTH - obs.width);
        obs.y = -obs.height;
        obs.dy = config.speed;
    } else if (dir === 'bottom') {
        obs.x = Math.random() * (CANVAS_WIDTH - obs.width);
        obs.y = CANVAS_HEIGHT;
        obs.dy = -config.speed;
    } else if (dir === 'left') {
        obs.x = -obs.width;
        obs.y = Math.random() * (CANVAS_HEIGHT - obs.height);
        obs.dx = config.speed;
    } else if (dir === 'right') {
        obs.x = CANVAS_WIDTH;
        obs.y = Math.random() * (CANVAS_HEIGHT - obs.height);
        obs.dx = -config.speed;
    }

    obstacles.push(obs);
}

/**
 * Calculates new positions and applies game logic for the current frame.
 */
function update() {
    if (gameState !== 'PLAYING') return;

    // --- Player Movement ---
    player.dx = 0;
    player.dy = 0;

    if (keys.ArrowUp || keys.w) player.dy = -player.speed;
    if (keys.ArrowDown || keys.s) player.dy = player.speed;
    if (keys.ArrowLeft || keys.a) player.dx = -player.speed;
    if (keys.ArrowRight || keys.d) player.dx = player.speed;

    player.x += player.dx;
    player.y += player.dy;

    // Clamp player position
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > CANVAS_WIDTH) player.x = CANVAS_WIDTH - player.width;
    if (player.y < 0) player.y = 0;
    if (player.y + player.height > CANVAS_HEIGHT) player.y = CANVAS_HEIGHT - player.height;

    // --- Obstacle Spawning ---
    const now = Date.now();
    if (now - lastSpawnTime > currentConfig.spawnIntervalMs) {
        spawnObstacle(currentConfig);
        lastSpawnTime = now;
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
            gameState = 'GAME_OVER';
            if (score > bestScore) {
                bestScore = score;
                localStorage.setItem('bestScore', bestScore);
            }
        }
    }

    // --- Score Update ---
    if (gameState === 'PLAYING') {
        score = Math.floor((Date.now() - gameStartTime) / 1000);
    }
}

/**
 * Clears the canvas and draws all game elements.
 */
function draw() {
    // 1. Draw the background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (gameState === 'START') {
        return; // UI handles the start screen
    }

    // 2. Draw the player
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // 3. Draw the obstacles
    ctx.fillStyle = COLORS.obstacle;
    for (const obs of obstacles) {
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    }

    // 4. Draw the score
    ctx.fillStyle = COLORS.accent;
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 15, 35);

    if (gameState === 'GAME_OVER') {
        drawGameOver();
    }
}

/**
 * Renders the Game Over screen and restart instructions.
 */
function drawGameOver() {
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    
    // Draw "GAME OVER"
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
    
    // Draw Scores
    ctx.fillStyle = COLORS.accent;
    ctx.font = '24px sans-serif';
    ctx.fillText('Score: ' + score + '   Best: ' + bestScore, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 5);
    
    // Draw Restart instruction
    ctx.fillStyle = COLORS.text;
    ctx.font = '20px sans-serif';
    ctx.fillText('Press R to restart.', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
}

/**
 * The main game loop function.
 */
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// --- Start the Game ---
setupInput();
requestAnimationFrame(gameLoop);
