/**
 * STUDY FARM SIMULATOR - GAME ENGINE
 * 1. Configuration & Global State
 */

const SAVE_KEY = 'studyFarmSave_v1';

// Default Game State
let gameState = {
    money: 0,
    xp: 0,
    level: 1,
    totalStudyHours: 0,
    dailyStudyMinutes: 0,
    currentDay: 1,
    consecutiveMissedDays: 0,
    weather: 'sunny', // sunny, rain, cloudy
    timeOfDay: 'morning', // morning, afternoon, evening, night
    farmProgress: 0,
    chickens: [],
    eggs: []
};

// Available Chicken Names
const CHICKEN_NAMES = ["Coco", "Rocky", "Snow", "Tiny", "Goldie", "Charlie", "Ruby", "Sunny", "Luna", "Milo"];
const CHICKEN_TYPES = ['white', 'brown', 'black', 'golden'];

// World & DOM Elements
const world = document.getElementById('world');
const playerEl = document.getElementById('player');
const entitiesLayer = document.getElementById('entities-layer');
const gateEl = document.getElementById('farm-gate');

// UI Elements
const uiMoney = document.getElementById('ui-money');
const uiXp = document.getElementById('ui-xp');
const uiLevel = document.getElementById('ui-level');
const uiChickens = document.getElementById('ui-chickens');
const uiEggs = document.getElementById('ui-eggs');
const uiDay = document.getElementById('ui-day');

// Interaction Zones
const interactZones = {
    house: { el: document.getElementById('house-zone'), x: 975, y: 300, radius: 100 },
    atm: { el: document.getElementById('atm-zone'), x: 875, y: 600, radius: 100 },
    farm: { el: document.getElementById('farm-zone'), x: 900, y: 1250, radius: 150 }
};

let currentInteractable = null;

/**
 * 2. Save & Load System
 */
function saveGame() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    showNotification("Game Saved! 💾");
}

function loadGame() {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
        gameState = JSON.parse(saved);
        // Fallback for new updates
        if (!gameState.chickens) gameState.chickens = [];
        if (!gameState.eggs) gameState.eggs = [];
    } else {
        // First time playing: Spawn initial 10 chickens
        for (let i = 0; i < 10; i++) {
            spawnNewChicken();
        }
        saveGame();
    }
    updateUI();
    applyWeatherAndTime();
    rebuildEntities();
}

/**
 * 3. Player & Camera System
 */
const player = {
    x: 1000,
    y: 700,
    speed: 4,
    vx: 0,
    vy: 0,
    direction: 'front',
    isMoving: false,
    frameX: 0,
    frameY: 0, // 0: Idle, 1: Walk, 2: Run
    animTimer: 0
};

// Joystick State
const joystick = { active: false, x: 0, y: 0, originX: 0, originY: 0 };
const joyContainer = document.getElementById('joystick-container');
const joyKnob = document.getElementById('joystick-knob');

joyContainer.addEventListener('touchstart', handleJoyStart, {passive: false});
joyContainer.addEventListener('touchmove', handleJoyMove, {passive: false});
joyContainer.addEventListener('touchend', handleJoyEnd);

// Mouse fallback for PC testing
joyContainer.addEventListener('mousedown', handleJoyStart);
window.addEventListener('mousemove', (e) => { if (joystick.active) handleJoyMove(e); });
window.addEventListener('mouseup', handleJoyEnd);

function handleJoyStart(e) {
    e.preventDefault();
    joystick.active = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = joyContainer.getBoundingClientRect();
    joystick.originX = rect.left + rect.width / 2;
    joystick.originY = rect.top + rect.height / 2;
    updateJoyPosition(clientX, clientY);
}

function handleJoyMove(e) {
    if (!joystick.active) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    updateJoyPosition(clientX, clientY);
}

function handleJoyEnd() {
    joystick.active = false;
    joystick.x = 0;
    joystick.y = 0;
    joyKnob.style.transform = `translate(0px, 0px)`;
    player.vx = 0;
    player.vy = 0;
}

function updateJoyPosition(clientX, clientY) {
    let dx = clientX - joystick.originX;
    let dy = clientY - joystick.originY;
    const distance = Math.min(Math.sqrt(dx * dx + dy * dy), 40); // Max radius
    const angle = Math.atan2(dy, dx);
    
    const knobX = Math.cos(angle) * distance;
    const knobY = Math.sin(angle) * distance;
    
    joyKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
    
    // Normalize velocity
    player.vx = (knobX / 40) * player.speed;
    player.vy = (knobY / 40) * player.speed;
}

function updatePlayer() {
    // Move
    player.x += player.vx;
    player.y += player.vy;
    
    // Boundaries (2000x2000 world)
    player.x = Math.max(24, Math.min(1976, player.x));
    player.y = Math.max(24, Math.min(1976, player.y));
    
    player.isMoving = Math.abs(player.vx) > 0.1 || Math.abs(player.vy) > 0.1;

    // Direction & Animation
    if (player.isMoving) {
        player.animTimer++;
        if (player.animTimer > 10) { // Frame speed
            player.frameX = (player.frameX + 1) % 3;
            player.animTimer = 0;
        }
        player.frameY = 1; // Walk row
        
        if (Math.abs(player.vx) > Math.abs(player.vy)) {
            player.direction = player.vx < 0 ? 'left' : 'right';
        } else {
            player.direction = player.vy < 0 ? 'back' : 'front';
        }
        playerEl.classList.remove('breathing');
    } else {
        player.frameX = 1; // Idle column usually center
        player.frameY = 0; // Idle row
        playerEl.classList.add('breathing');
    }

    // Apply Styles
    playerEl.style.left = `${player.x - 24}px`; // Center anchor
    playerEl.style.top = `${player.y - 48}px`; // Bottom anchor
    
    let spriteDir = player.direction;
    if (spriteDir === 'right') {
        spriteDir = 'left';
        playerEl.classList.add('facing-right');
    } else {
        playerEl.classList.remove('facing-right');
    }
    
    // CORRECTED PATH: Look directly in assets/ folder
    playerEl.style.backgroundImage = `url('assets/${spriteDir}.png')`;
    playerEl.style.backgroundPosition = `${player.frameX * 50}% ${player.frameY * 50}%`;

    updateCamera();
    checkInteractions();
}

function updateCamera() {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    let camX = -player.x + screenW / 2;
    let camY = -player.y + screenH / 2;
    
    // Optional: Clamp camera to world edges
    camX = Math.min(0, Math.max(camX, screenW - 2000));
    camY = Math.min(0, Math.max(camY, screenH - 2000));

    world.style.transform = `translate(${camX}px, ${camY}px)`;
}

/**
 * 4. Interaction System
 */
function checkInteractions() {
    let closestDist = Infinity;
    let closestZone = null;

    for (let key in interactZones) {
        const zone = interactZones[key];
        const dist = Math.hypot(player.x - zone.x, player.y - zone.y);
        
        if (dist < zone.radius) {
            if (dist < closestDist) {
                closestDist = dist;
                closestZone = key;
            }
        }
        zone.el.style.display = 'none'; // Hide all initially
    }

    currentInteractable = closestZone;
    if (currentInteractable) {
        interactZones[currentInteractable].el.style.display = 'block';
    }
}

// Action Button / Zones
document.getElementById('action-btn').addEventListener('click', triggerAction);

function triggerAction() {
    if (!currentInteractable) return;
    playSound('button');
    
    if (currentInteractable === 'atm') openModal('atm-modal');
    if (currentInteractable === 'house') openModal('house-modal');
    if (currentInteractable === 'farm') feedChickens();
}

/**
 * 5. ATM & Money System
 */
const depositBtn = document.getElementById('deposit-btn');
depositBtn.addEventListener('click', processDeposit);

function processDeposit() {
    const hours = parseInt(document.getElementById('atm-hours').value) || 0;
    const minutes = parseInt(document.getElementById('atm-minutes').value) || 0;
    const totalMinutes = (hours * 60) + minutes;

    if (totalMinutes === 0) {
        showNotification("Enter study time first!");
        return;
    }

    // Formula: 30 Min = ₹1000
    const earned = Math.floor(totalMinutes / 30) * 1000;
    
    if (earned <= 0) {
        showNotification("Study at least 30 minutes to earn money!");
        return;
    }

    playSound('atm');
    
    // Animations
    document.getElementById('receipt-amount').innerText = earned;
    const paper = document.getElementById('receipt-paper');
    paper.classList.remove('hidden');
    
    // Re-trigger animation
    paper.style.animation = 'none';
    paper.offsetHeight; /* trigger reflow */
    paper.style.animation = null;

    setTimeout(() => {
        playSound('coin');
        gameState.money += earned;
        gameState.dailyStudyMinutes += totalMinutes;
        
        // XP System
        gameState.totalStudyHours += (totalMinutes / 60);
        gameState.xp += earned / 10;
        if (gameState.xp >= gameState.level * 1000) {
            gameState.xp = 0;
            gameState.level++;
            showNotification(`Level Up! You are now Level ${gameState.level} 🎉`);
        }
        
        saveGame();
        updateUI();
        
        document.getElementById('atm-hours').value = "";
        document.getElementById('atm-minutes').value = "";
        closeModals();
        showNotification(`Deposited ₹${earned} for studying!`);
    }, 2000);
}

/**
 * 6. Chicken AI & Farm System
 */
const farmBounds = { xMin: 720, xMax: 1080, yMin: 820, yMax: 1180 };
let activeChickens = [];

function spawnNewChicken(forceBaby = false) {
    const type = forceBaby ? 'baby' : CHICKEN_TYPES[Math.floor(Math.random() * CHICKEN_TYPES.length)];
    const chicken = {
        id: Date.now() + Math.random(),
        name: CHICKEN_NAMES[Math.floor(Math.random() * CHICKEN_NAMES.length)],
        type: type,
        x: farmBounds.xMin + Math.random() * 300,
        y: farmBounds.yMin + Math.random() * 300,
        vx: 0,
        vy: 0,
        hunger: 100,
        happiness: 100,
        age: 0,
        isWeak: false,
        state: 'idle', // idle, roam, eat, tired
        timer: 0,
        frameX: 0
    };
    gameState.chickens.push(chicken);
}

function rebuildEntities() {
    // Clear old elements except player
    document.querySelectorAll('.chicken-sprite, .egg-sprite').forEach(el => el.remove());
    activeChickens = [];

    // Rebuild chickens
    gameState.chickens.forEach(data => {
        const el = document.createElement('div');
        el.className = 'sprite chicken-sprite';
        // CORRECTED PATH: Look directly in assets/ folder
        el.style.backgroundImage = `url('assets/${data.type}.png')`;
        entitiesLayer.appendChild(el);
        
        activeChickens.push({ data, el });
    });

    // Rebuild eggs
    gameState.eggs.forEach(egg => {
        const el = document.createElement('div');
        el.className = 'sprite egg-sprite';
        // CORRECTED PATH: Look directly in assets/ folder
        el.style.backgroundImage = `url('assets/egg.png')`;
        el.style.left = `${egg.x - 12}px`;
        el.style.top = `${egg.y - 12}px`;
        el.style.width = '24px';
        el.style.height = '24px';
        entitiesLayer.appendChild(el);
    });
}

function updateChickens() {
    activeChickens.forEach(chickenObj => {
        const c = chickenObj.data;
        const el = chickenObj.el;

        c.timer--;

        // State Machine
        if (c.timer <= 0 && c.state !== 'eat') {
            if (c.state === 'tired') {
                c.vx = 0; c.vy = 0;
                c.timer = 120; // Stays still longer
            }
            else if (Math.random() < 0.5) {
                // Roam
                c.state = 'roam';
                const angle = Math.random() * Math.PI * 2;
                const speed = c.isWeak ? 0.2 : 0.8; // Weak chicken walks slowly
                c.vx = Math.cos(angle) * speed;
                c.vy = Math.sin(angle) * speed;
                c.timer = 60 + Math.random() * 60;
            } else {
                // Idle
                c.state = 'idle';
                c.vx = 0;
                c.vy = 0;
                c.timer = 40 + Math.random() * 60;
            }
        }

        // Apply Movement
        c.x += c.vx;
        c.y += c.vy;

        // Constrain to farm
        if (c.x < farmBounds.xMin) { c.x = farmBounds.xMin; c.vx *= -1; }
        if (c.x > farmBounds.xMax) { c.x = farmBounds.xMax; c.vx *= -1; }
        if (c.y < farmBounds.yMin) { c.y = farmBounds.yMin; c.vy *= -1; }
        if (c.y > farmBounds.yMax) { c.y = farmBounds.yMax; c.vy *= -1; }

        // Animation
        const isMoving = Math.abs(c.vx) > 0.1 || Math.abs(c.vy) > 0.1;
        
        // Simple 3-frame animation
        if (isMoving || c.state === 'eat') {
            if (Date.now() % 300 < 100) c.frameX = 0;
            else if (Date.now() % 300 < 200) c.frameX = 1;
            else c.frameX = 2;
        } else {
            c.frameX = 1; // Idle frame
        }

        const row = c.state === 'eat' ? 2 : (isMoving ? 1 : 0);
        
        if (c.vx < 0) el.classList.add('facing-right'); // Flip logic depends on base sprite
        else el.classList.remove('facing-right');

        el.style.left = `${c.x - 24}px`;
        el.style.top = `${c.y - 48}px`;
        el.style.backgroundPosition = `${c.frameX * 50}% ${row * 50}%`;
        
        // Weak Visuals
        el.style.filter = c.isWeak ? 'grayscale(0.5) opacity(0.8)' : 'none';
    });
}

function feedChickens() {
    if (gameState.money < 200) {
        showNotification("Not enough money to feed! (₹200)");
        return;
    }
    
    gameState.money -= 200;
    updateUI();
    playSound('coin');
    
    // Open Gate Animation
    gateEl.classList.add('open');
    setTimeout(() => gateEl.classList.remove('open'), 3000);

    // Call all chickens to center
    activeChickens.forEach(obj => {
        const c = obj.data;
        c.state = 'eat';
        const targetX = 900 + (Math.random() * 40 - 20);
        const targetY = 1000 + (Math.random() * 40 - 20);
        
        c.vx = (targetX - c.x) / 60;
        c.vy = (targetY - c.y) / 60;
        c.timer = 180; // Eat for 3 seconds
        
        // Hearts
        setTimeout(() => {
            playSound('chicken');
            showNotification(`❤️ ${c.name} is happy!`);
            c.happiness = 100;
            c.hunger = 100;
        }, 1000 + Math.random() * 1000);
    });
}

document.getElementById('buy-chicken-btn').addEventListener('click', () => {
    if (gameState.money >= 4000) {
        gameState.money -= 4000;
        spawnNewChicken();
        saveGame();
        rebuildEntities();
        closeModals();
        showNotification("Bought a new Chicken! 🐔");
    } else {
        showNotification("Not enough money! Study more! 📚");
    }
});

/**
 * 7. Day & Penalty System
 */
document.getElementById('sleep-btn').addEventListener('click', () => {
    closeModals();
    advanceDay();
});

function advanceDay() {
    const screenOverlay = document.createElement('div');
    screenOverlay.style = `position:fixed;top:0;left:0;width:100%;height:100%;background:black;z-index:999;opacity:0;transition:opacity 2s;`;
    document.body.appendChild(screenOverlay);
    
    setTimeout(() => screenOverlay.style.opacity = '1', 50);

    setTimeout(() => {
        // PENALTY LOGIC
        if (gameState.dailyStudyMinutes < 30) {
            gameState.consecutiveMissedDays++;
            
            // Find currently weak chicken
            let weakChickenIdx = gameState.chickens.findIndex(c => c.isWeak);
            
            if (gameState.consecutiveMissedDays >= 2 && weakChickenIdx !== -1) {
                // Chicken dies
                const deadChicken = gameState.chickens.splice(weakChickenIdx, 1)[0];
                showNotification(`🪶 ${deadChicken.name} waited for you today.`);
                // Reset consecutive logic, maybe pick new weak one next time
                gameState.consecutiveMissedDays = 1; 
            } else if (gameState.chickens.length > 0) {
                // Make random chicken weak
                const rand = Math.floor(Math.random() * gameState.chickens.length);
                gameState.chickens[rand].isWeak = true;
                showNotification(`A chicken looks sad because you didn't study much...`);
            }
        } else {
            // Studied well! Heal all chickens.
            gameState.consecutiveMissedDays = 0;
            gameState.chickens.forEach(c => {
                c.isWeak = false;
                c.age++; 
                if (c.type === 'baby' && c.age > 3) c.type = 'white'; // Grows up
            });
        }

        // Egg Hatching Logic
        if (gameState.eggs.length > 0) {
            const numHatched = gameState.eggs.length;
            gameState.eggs = [];
            for(let i=0; i<numHatched; i++) spawnNewChicken(true); // Spawn baby chick
            if(numHatched > 0) showNotification(`🥚 ${numHatched} egg(s) hatched!`);
        }

        // Egg Laying Logic (Random healthy chicken lays egg)
        gameState.chickens.forEach(c => {
            if (!c.isWeak && c.type !== 'baby' && Math.random() < 0.2) { 
                // 20% chance
                gameState.eggs.push({ x: c.x, y: c.y });
                c.state = 'tired'; // Specific chicken is less active today
                c.timer = 9999; // stays tired for long
            }
        });

        // Reset Daily Stats & Advance
        gameState.dailyStudyMinutes = 0;
        gameState.currentDay++;
        
        // Random Weather
        const weathers = ['sunny', 'sunny', 'cloudy', 'rain'];
        gameState.weather = weathers[Math.floor(Math.random() * weathers.length)];
        gameState.timeOfDay = 'morning';

        saveGame();
        rebuildEntities();
        applyWeatherAndTime();
        updateUI();

        // Fade back in
        screenOverlay.style.opacity = '0';
        setTimeout(() => screenOverlay.remove(), 2000);
    }, 2000);
}

function applyWeatherAndTime() {
    const timeOverlay = document.getElementById('time-overlay');
    const weatherLayer = document.getElementById('weather-layer');
    
    timeOverlay.className = gameState.timeOfDay;
    weatherLayer.className = gameState.weather === 'rain' ? 'rain' : '';
    
    if (gameState.weather === 'rain') {
        playSound('rain');
    }
}

/**
 * 8. UI & Utilities
 */
function updateUI() {
    uiMoney.innerText = gameState.money;
    uiXp.innerText = Math.floor(gameState.xp);
    uiLevel.innerText = gameState.level;
    uiChickens.innerText = gameState.chickens.length;
    uiEggs.innerText = gameState.eggs.length;
    uiDay.innerText = gameState.currentDay;
}

function showNotification(msg) {
    const box = document.getElementById('notification-box');
    box.innerText = msg;
    box.classList.remove('hidden');
    box.style.opacity = '1';
    
    setTimeout(() => {
        box.style.opacity = '0';
        setTimeout(() => box.classList.add('hidden'), 500);
    }, 3000);
}

// Modals
const modalOverlay = document.getElementById('modal-overlay');
document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', closeModals);
});

function openModal(id) {
    modalOverlay.classList.remove('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    
    if (id === 'house-modal') {
        document.getElementById('house-money').innerText = gameState.money;
        document.getElementById('house-xp').innerText = Math.floor(gameState.xp);
        document.getElementById('house-day').innerText = gameState.currentDay;
        document.getElementById('house-study-hours').innerText = gameState.totalStudyHours.toFixed(1);
    }
}

function closeModals() {
    modalOverlay.classList.add('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    document.getElementById('receipt-paper').classList.add('hidden'); // Reset receipt
}

// Sound System (Placeholders for HTML5 Audio)
const sounds = {
    button: new Audio(), // Assign source later
    coin: new Audio(),
    atm: new Audio(),
    chicken: new Audio(),
    rain: new Audio()
};
function playSound(type) {
    // In production, populate the src and call .play()
    // sounds[type].play().catch(e => {}); 
    console.log(`Playing sound: ${type}`);
}

// Keyboard Fallback (PC Testing)
const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', e => {
    if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', e => {
    if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
});

/**
 * 9. Main Game Loop
 */
function gameLoop() {
    // Desktop keyboard handling (overrides joystick if active)
    if (!joystick.active) {
        player.vx = 0; player.vy = 0;
        if (keys.w) player.vy = -player.speed;
        if (keys.s) player.vy = player.speed;
        if (keys.a) player.vx = -player.speed;
        if (keys.d) player.vx = player.speed;
    }

    updatePlayer();
    updateChickens();

    // Time cycle simulation (very slow transition based on frames or real time)
    // For this prototype, we rely on Sleep button to change days, 
    // but you could add a timer to change timeOfDay (morning -> afternoon -> evening)

    requestAnimationFrame(gameLoop);
}

// Initialize Game
document.getElementById('save-game-btn').addEventListener('click', saveGame);
loadGame();
gameLoop();
