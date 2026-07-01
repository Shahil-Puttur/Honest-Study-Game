/**
 * STUDY FARM SIMULATOR - SENIOR ENGINE
 */

const SAVE_KEY = 'studyFarmSave_v1';

let gameState = {
    money: 0, xp: 0, level: 1, totalStudyHours: 0, dailyStudyMinutes: 0,
    currentDay: 1, consecutiveMissedDays: 0, weather: 'sunny', timeOfDay: 'morning',
    farmProgress: 0, chickens: [], eggs: []
};

const CHICKEN_NAMES = ["Coco", "Rocky", "Snow", "Tiny", "Goldie", "Charlie", "Ruby", "Sunny", "Luna", "Milo"];
const CHICKEN_TYPES = ['white', 'brown', 'black', 'golden'];

let world, playerEl, entitiesLayer, gateEl;
let uiMoney, uiXp, uiLevel, uiChickens, uiEggs, uiDay;
let interactZones;
let currentInteractable = null;
let activeChickens = [];
let joyContainer, joyKnob;

const player = { x: 1000, y: 700, speed: 4, vx: 0, vy: 0, direction: 'front', isMoving: false, frameX: 0, frameY: 0, animTimer: 0 };
const joystick = { active: false, originX: 0, originY: 0 };
const farmBounds = { xMin: 720, xMax: 1080, yMin: 820, yMax: 1180 };
const keys = { w: false, a: false, s: false, d: false };

window.addEventListener('DOMContentLoaded', () => {
    world = document.getElementById('world');
    playerEl = document.getElementById('player');
    entitiesLayer = document.getElementById('entities-layer');
    gateEl = document.getElementById('farm-gate');
    
    uiMoney = document.getElementById('ui-money');
    uiXp = document.getElementById('ui-xp');
    uiLevel = document.getElementById('ui-level');
    uiChickens = document.getElementById('ui-chickens');
    uiEggs = document.getElementById('ui-eggs');
    uiDay = document.getElementById('ui-day');

    interactZones = {
        house: { el: document.getElementById('house-zone'), x: 975, y: 300, radius: 100 },
        atm: { el: document.getElementById('atm-zone'), x: 875, y: 600, radius: 100 },
        farm: { el: document.getElementById('farm-zone'), x: 900, y: 1250, radius: 150 }
    };

    setupControls();
    
    document.getElementById('action-btn').addEventListener('click', triggerAction);
    document.getElementById('deposit-btn').addEventListener('click', processDeposit);
    document.getElementById('buy-chicken-btn').addEventListener('click', buyChicken);
    document.getElementById('sleep-btn').addEventListener('click', advanceDay);
    document.getElementById('save-game-btn').addEventListener('click', saveGame);
    document.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', closeModals));

    window.addEventListener('keydown', e => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', e => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });

    loadGame();
    
    // INSTANTLY center the camera so it doesn't look empty on boot
    updateCamera();
    
    requestAnimationFrame(gameLoop);
});

function saveGame() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    showNotification("Game Saved! 💾");
}

function loadGame() {
    try {
        const saved = localStorage.getItem(SAVE_KEY);
        if (saved) {
            gameState = JSON.parse(saved);
            if (!gameState.chickens) gameState.chickens = [];
            if (!gameState.eggs) gameState.eggs = [];
        } else {
            for (let i = 0; i < 10; i++) spawnNewChicken();
            saveGame();
        }
    } catch(e) { console.error("Save error"); }
    
    updateUI(); applyWeatherAndTime(); rebuildEntities();
}

function updatePlayer() {
    if (!world || !playerEl) return; 

    player.x += player.vx;
    player.y += player.vy;
    player.x = Math.max(24, Math.min(1976, player.x));
    player.y = Math.max(24, Math.min(1976, player.y));
    
    player.isMoving = Math.abs(player.vx) > 0.1 || Math.abs(player.vy) > 0.1;

    if (player.isMoving) {
        player.animTimer++;
        if (player.animTimer > 10) { player.frameX = (player.frameX + 1) % 3; player.animTimer = 0; }
        player.frameY = 1; 
        
        if (Math.abs(player.vx) > Math.abs(player.vy)) {
            player.direction = player.vx < 0 ? 'left' : 'right';
        } else {
            player.direction = player.vy < 0 ? 'back' : 'front';
        }
        playerEl.classList.remove('breathing');
    } else {
        player.frameX = 1; player.frameY = 0; 
        playerEl.classList.add('breathing');
    }

    playerEl.style.left = `${player.x - 24}px`; 
    playerEl.style.top = `${player.y - 48}px`; 
    
    let spriteDir = player.direction;
    if (spriteDir === 'right') { spriteDir = 'left'; playerEl.classList.add('facing-right'); } 
    else { playerEl.classList.remove('facing-right'); }
    
    playerEl.style.backgroundImage = `url('assets/${spriteDir}.png')`;
    playerEl.style.backgroundPosition = `${player.frameX * 50}% ${player.frameY * 50}%`;

    updateCamera(); checkInteractions();
}

function updateCamera() {
    if(!world) return;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    let camX = -player.x + screenW / 2;
    let camY = -player.y + screenH / 2;
    camX = Math.min(0, Math.max(camX, screenW - 2000));
    camY = Math.min(0, Math.max(camY, screenH - 2000));
    world.style.transform = `translate(${camX}px, ${camY}px)`;
}

function setupControls() {
    joyContainer = document.getElementById('joystick-container');
    joyKnob = document.getElementById('joystick-knob');
    if(!joyContainer) return;

    joyContainer.addEventListener('touchstart', handleJoyStart, {passive: false});
    joyContainer.addEventListener('touchmove', handleJoyMove, {passive: false});
    joyContainer.addEventListener('touchend', handleJoyEnd);
}

function handleJoyStart(e) {
    e.preventDefault();
    joystick.active = true;
    const clientX = e.touches[0].clientX;
    const clientY = e.touches[0].clientY;
    const rect = joyContainer.getBoundingClientRect();
    joystick.originX = rect.left + rect.width / 2;
    joystick.originY = rect.top + rect.height / 2;
    updateJoyPosition(clientX, clientY);
}

function handleJoyMove(e) {
    if (!joystick.active) return;
    e.preventDefault();
    updateJoyPosition(e.touches[0].clientX, e.touches[0].clientY);
}

function handleJoyEnd(e) {
    e.preventDefault();
    joystick.active = false;
    joyKnob.style.transform = `translate(0px, 0px)`;
    player.vx = 0; player.vy = 0;
}

function updateJoyPosition(clientX, clientY) {
    let dx = clientX - joystick.originX;
    let dy = clientY - joystick.originY;
    const distance = Math.min(Math.sqrt(dx * dx + dy * dy), 40); 
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * distance;
    const knobY = Math.sin(angle) * distance;
    
    joyKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
    player.vx = (knobX / 40) * player.speed;
    player.vy = (knobY / 40) * player.speed;
}

function checkInteractions() {
    let closestDist = Infinity;
    let closestZone = null;
    for (let key in interactZones) {
        const zone = interactZones[key];
        const dist = Math.hypot(player.x - zone.x, player.y - zone.y);
        if (dist < zone.radius && dist < closestDist) { closestDist = dist; closestZone = key; }
        if (zone.el) zone.el.style.display = 'none'; 
    }
    currentInteractable = closestZone;
    if (currentInteractable && interactZones[currentInteractable].el) { interactZones[currentInteractable].el.style.display = 'block'; }
}

function triggerAction() {
    if (!currentInteractable) return;
    if (currentInteractable === 'atm') openModal('atm-modal');
    if (currentInteractable === 'house') openModal('house-modal');
    if (currentInteractable === 'farm') feedChickens();
}

function processDeposit() {
    const hours = parseInt(document.getElementById('atm-hours').value) || 0;
    const minutes = parseInt(document.getElementById('atm-minutes').value) || 0;
    const totalMinutes = (hours * 60) + minutes;

    if (totalMinutes === 0) return showNotification("Enter study time first!");
    const earned = Math.floor(totalMinutes / 30) * 1000;
    if (earned <= 0) return showNotification("Study at least 30 mins to earn!");

    document.getElementById('receipt-amount').innerText = earned;
    const paper = document.getElementById('receipt-paper');
    paper.classList.remove('hidden');
    paper.style.animation = 'none';
    paper.offsetHeight; 
    paper.style.animation = null;

    setTimeout(() => {
        gameState.money += earned; gameState.dailyStudyMinutes += totalMinutes;
        gameState.totalStudyHours += (totalMinutes / 60); gameState.xp += earned / 10;
        
        if (gameState.xp >= gameState.level * 1000) {
            gameState.xp = 0; gameState.level++;
            showNotification(`Level Up! You are now Level ${gameState.level} 🎉`);
        }
        
        saveGame(); updateUI();
        document.getElementById('atm-hours').value = ""; document.getElementById('atm-minutes').value = "";
        closeModals(); showNotification(`Deposited ₹${earned} for studying!`);
    }, 2000);
}

function spawnNewChicken(forceBaby = false) {
    const type = forceBaby ? 'baby' : CHICKEN_TYPES[Math.floor(Math.random() * CHICKEN_TYPES.length)];
    gameState.chickens.push({
        id: Date.now() + Math.random(), name: CHICKEN_NAMES[Math.floor(Math.random() * CHICKEN_NAMES.length)],
        type: type, x: farmBounds.xMin + Math.random() * 300, y: farmBounds.yMin + Math.random() * 300,
        vx: 0, vy: 0, hunger: 100, happiness: 100, age: 0,
        isWeak: false, state: 'idle', timer: 0, frameX: 0
    });
}

function rebuildEntities() {
    if(!entitiesLayer) return;
    document.querySelectorAll('.chicken-sprite, .egg-sprite').forEach(el => el.remove());
    activeChickens = [];

    gameState.chickens.forEach(data => {
        const el = document.createElement('div'); el.className = 'sprite chicken-sprite';
        el.style.backgroundImage = `url('assets/${data.type}.png')`; 
        entitiesLayer.appendChild(el); activeChickens.push({ data, el });
    });

    gameState.eggs.forEach(egg => {
        const el = document.createElement('div'); el.className = 'sprite egg-sprite';
        el.style.backgroundImage = `url('assets/egg.png')`; 
        el.style.left = `${egg.x - 12}px`; el.style.top = `${egg.y - 12}px`;
        el.style.width = '24px'; el.style.height = '24px';
        entitiesLayer.appendChild(el);
    });
}

function updateChickens() {
    activeChickens.forEach(chickenObj => {
        const c = chickenObj.data; const el = chickenObj.el; c.timer--;
        if (c.timer <= 0 && c.state !== 'eat') {
            if (c.state === 'tired') { c.vx = 0; c.vy = 0; c.timer = 120; } 
            else if (Math.random() < 0.5) {
                c.state = 'roam'; const angle = Math.random() * Math.PI * 2;
                const speed = c.isWeak ? 0.2 : 0.8; 
                c.vx = Math.cos(angle) * speed; c.vy = Math.sin(angle) * speed;
                c.timer = 60 + Math.random() * 60;
            } else { c.state = 'idle'; c.vx = 0; c.vy = 0; c.timer = 40 + Math.random() * 60; }
        }
        c.x += c.vx; c.y += c.vy;
        if (c.x < farmBounds.xMin) { c.x = farmBounds.xMin; c.vx *= -1; }
        if (c.x > farmBounds.xMax) { c.x = farmBounds.xMax; c.vx *= -1; }
        if (c.y < farmBounds.yMin) { c.y = farmBounds.yMin; c.vy *= -1; }
        if (c.y > farmBounds.yMax) { c.y = farmBounds.yMax; c.vy *= -1; }
        const isMoving = Math.abs(c.vx) > 0.1 || Math.abs(c.vy) > 0.1;
        if (isMoving || c.state === 'eat') {
            if (Date.now() % 300 < 100) c.frameX = 0; else if (Date.now() % 300 < 200) c.frameX = 1; else c.frameX = 2;
        } else { c.frameX = 1; }
        const row = c.state === 'eat' ? 2 : (isMoving ? 1 : 0);
        if (c.vx < 0) el.classList.add('facing-right'); else el.classList.remove('facing-right');
        el.style.left = `${c.x - 24}px`; el.style.top = `${c.y - 48}px`;
        el.style.backgroundPosition = `${c.frameX * 50}% ${row * 50}%`;
        el.style.filter = c.isWeak ? 'grayscale(0.5) opacity(0.8)' : 'none';
    });
}

function feedChickens() {
    if (gameState.money < 200) return showNotification("Not enough money! (₹200)");
    gameState.money -= 200; updateUI();
    if(gateEl) { gateEl.classList.add('open'); setTimeout(() => gateEl.classList.remove('open'), 3000); }
    activeChickens.forEach(obj => {
        const c = obj.data; c.state = 'eat';
        c.vx = (900 + (Math.random()*40-20) - c.x) / 60; c.vy = (1000 + (Math.random()*40-20) - c.y) / 60; c.timer = 180; 
        setTimeout(() => { showNotification(`❤️ ${c.name} is happy!`); c.happiness = 100; c.hunger = 100; }, 1000 + Math.random() * 1000);
    });
}

function buyChicken() {
    if (gameState.money >= 4000) { gameState.money -= 4000; spawnNewChicken(); saveGame(); rebuildEntities(); closeModals(); showNotification("Bought a new Chicken! 🐔"); } 
    else { showNotification("Not enough money! Study more! 📚"); }
}

function advanceDay() {
    closeModals();
    const screenOverlay = document.createElement('div');
    screenOverlay.style = `position:fixed;top:0;left:0;width:100%;height:100%;background:black;z-index:999;opacity:0;transition:opacity 2s;`;
    document.body.appendChild(screenOverlay);
    setTimeout(() => screenOverlay.style.opacity = '1', 50);

    setTimeout(() => {
        if (gameState.dailyStudyMinutes < 30) {
            gameState.consecutiveMissedDays++;
            let weakChickenIdx = gameState.chickens.findIndex(c => c.isWeak);
            if (gameState.consecutiveMissedDays >= 2 && weakChickenIdx !== -1) {
                const dead = gameState.chickens.splice(weakChickenIdx, 1)[0]; showNotification(`🪶 ${dead.name} waited for you today.`); gameState.consecutiveMissedDays = 1; 
            } else if (gameState.chickens.length > 0) {
                gameState.chickens[Math.floor(Math.random() * gameState.chickens.length)].isWeak = true; showNotification(`A chicken is weak because you didn't study.`);
            }
        } else {
            gameState.consecutiveMissedDays = 0;
            gameState.chickens.forEach(c => { c.isWeak = false; c.age++; if (c.type === 'baby' && c.age > 3) c.type = 'white'; });
        }
        if (gameState.eggs.length > 0) {
            const numHatched = gameState.eggs.length; gameState.eggs = [];
            for(let i=0; i<numHatched; i++) spawnNewChicken(true); showNotification(`🥚 ${numHatched} egg(s) hatched!`);
        }
        gameState.chickens.forEach(c => {
            if (!c.isWeak && c.type !== 'baby' && Math.random() < 0.2) { gameState.eggs.push({ x: c.x, y: c.y }); c.state = 'tired'; c.timer = 9999; }
        });
        gameState.dailyStudyMinutes = 0; gameState.currentDay++;
        const weathers = ['sunny', 'sunny', 'cloudy', 'rain']; gameState.weather = weathers[Math.floor(Math.random() * weathers.length)]; gameState.timeOfDay = 'morning';
        saveGame(); rebuildEntities(); applyWeatherAndTime(); updateUI();
        screenOverlay.style.opacity = '0'; setTimeout(() => screenOverlay.remove(), 2000);
    }, 2000);
}

function applyWeatherAndTime() {
    const timeOverlay = document.getElementById('time-overlay');
    const weatherLayer = document.getElementById('weather-layer');
    if (timeOverlay) timeOverlay.className = gameState.timeOfDay;
    if (weatherLayer) weatherLayer.className = gameState.weather === 'rain' ? 'rain' : '';
}

function updateUI() {
    if(!uiMoney) return;
    uiMoney.innerText = gameState.money; uiXp.innerText = Math.floor(gameState.xp);
    uiLevel.innerText = gameState.level; uiChickens.innerText = gameState.chickens.length;
    uiEggs.innerText = gameState.eggs.length; uiDay.innerText = gameState.currentDay;
}

function showNotification(msg) {
    const box = document.getElementById('notification-box');
    if(!box) return;
    box.innerText = msg; box.classList.remove('hidden'); box.style.opacity = '1';
    setTimeout(() => { box.style.opacity = '0'; setTimeout(() => box.classList.add('hidden'), 500); }, 3000);
}

function openModal(id) {
    document.getElementById('modal-overlay').classList.remove('hidden');
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
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    document.getElementById('receipt-paper').classList.add('hidden'); 
}

function gameLoop() {
    if (!joystick.active) {
        player.vx = 0; player.vy = 0;
        if (keys.w) player.vy = -player.speed;
        if (keys.s) player.vy = player.speed;
        if (keys.a) player.vx = -player.speed;
        if (keys.d) player.vx = player.speed;
    }
    updatePlayer(); updateChickens(); requestAnimationFrame(gameLoop);
                         }
