// --- Game Configuration & Constants ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

// Color Palette (from user requirements)
const COLORS = {
    background: '#211D1B',
    player: '#D9722C',
    obstacle: '#C1440E'
};

// --- Game State ---

// Player object
const player = {
    width: 30,
    height: 30,
    // Start at the center of the canvas
    x: CANVAS_WIDTH / 2 - 15,
    y: CANVAS_HEIGHT / 2 - 15,
    speed: 5,
    dx: 0, // X velocity
    dy: 0  // Y velocity
};

// Obstacle object
const obstacle = {
    width: 25,
    height: 25,
    x: Math.random() * (CANVAS_WIDTH - 25),
    y: -25, // Start slightly off-screen
    speed: 3
};

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

/**
 * Sets up event listeners for keyboard input to update the keys state object.
 */
function setupInput() {
    window.addEventListener('keydown', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = true;
        }
    });

    window.addEventListener('keyup', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = false;
        }
    });
}


// --- Game Loop Methods ---

/**
 * Calculates new positions and applies game logic for the current frame.
 */
function update() {
    // Reset velocity
    player.dx = 0;
    player.dy = 0;

    // Apply movement based on active input
    if (keys.ArrowUp || keys.w) player.dy = -player.speed;
    if (keys.ArrowDown || keys.s) player.dy = player.speed;
    if (keys.ArrowLeft || keys.a) player.dx = -player.speed;
    if (keys.ArrowRight || keys.d) player.dx = player.speed;

    // Update player position
    player.x += player.dx;
    player.y += player.dy;

    // Clamp player position to ensure they don't leave the canvas bounds
    if (player.x < 0) {
        player.x = 0;
    }
    if (player.x + player.width > CANVAS_WIDTH) {
        player.x = CANVAS_WIDTH - player.width;
    }
    if (player.y < 0) {
        player.y = 0;
    }
    if (player.y + player.height > CANVAS_HEIGHT) {
        player.y = CANVAS_HEIGHT - player.height;
    }

    // Update obstacle position
    obstacle.y += obstacle.speed;

    // Respawn obstacle if it goes past the bottom
    if (obstacle.y > CANVAS_HEIGHT) {
        obstacle.y = -obstacle.height;
        obstacle.x = Math.random() * (CANVAS_WIDTH - obstacle.width);
    }
}

/**
 * Clears the canvas and draws all game elements for the current frame.
 */
function draw() {
    // 1. Draw the background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Draw the player
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // 3. Draw the obstacle
    ctx.fillStyle = COLORS.obstacle;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
}

/**
 * The main game loop function. Calls update, then draw, then schedules the next frame.
 */
function gameLoop() {
    update();
    draw();
    
    // Request the next frame
    requestAnimationFrame(gameLoop);
}


// --- Start the Game ---
setupInput();
requestAnimationFrame(gameLoop);
