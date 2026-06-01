/**
 * Naughty Number Steps - High Fidelity Swapping Game Engine
 * Implements Section 1, Section 2, and Section 3
 */

const CONFIG = {
    width: 1920,
    height: 1080
};

/**
 * Helper to dynamically measure the target slot offset relative to the parent game container.
 * This ensures mathematically perfect centering based on CSS flexbox layout!
 */
function getSlotPos(idx) {
    const containerRect = document.getElementById("gameContainer").getBoundingClientRect();
    const targetEl = document.getElementById(`target_${idx}`);
    if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        return {
            x: (rect.left - containerRect.left) / gameState.scale,
            y: (rect.top - containerRect.top) / gameState.scale
        };
    }
    // Fallback layout just in case
    return { x: 320 + idx * 480, y: 450 };
}

const gameState = {
    scale: 1,
    currentLevelIdx: 0,
    currentStepIdx: 0,
    slots: [null, null, null],
    slotsLocked: [false, false, false],
    activeDrag: null,
    dragOffset: { x: 0, y: 0 },
    dragOriginSlotIdx: -1,
    previewSwapSlot: -1,
    isWaitingForClick: false,
    targetDigitClick: null,
    audioCtx: null,
    consecutiveErrors: 0,
    idleTimer: null,
    nudgeTimer: null,
    levelComplete: false
};

// --- LEVEL REGISTRY ---
const LEVELS = [
    // SECTION 1: LBD 1 Tutorial (31,13,29)
    {
        id: "section_1", initialOrder: [31, 13, 29], correctSorted: [13, 29, 31],
        orderType: "ascending", symbol: "<", mode: "tutorial",
        steps: [
            { type: "msg", text: "Arrange the numbers from the smallest to the largest." },
            { type: "show_slots", text: "Let us put the steps in order from smallest to largest." },
            { type: "instruction", text: "Look at the tens digit.", highlight: "tens", highlightStones: true },
            { type: "tap", text: "Tap the smallest tens digit.", targetNum: 13, digitType: "tens", highlight: "tens", highlightStones: true },
            { type: "msg", text: "So, 13 is the smallest number!", glowNum: 13 },
            { type: "swap_step", text: "Drag 13 to the first place.", dragNum: 13, targetSlot: 0, successMsg: "Well done!", lockTarget: true },
            { type: "instruction", text: "Compare the tens digits of the remaining numbers.", highlight: "tens", highlightStones: "remaining" },
            { type: "tap", text: "Tap the smaller tens digit.", targetNum: 29, digitType: "tens", highlight: "tens", highlightStones: "remaining" },
            { type: "msg", text: "So, 29 is smaller than 31.", glowNum: 29 },
            { type: "swap_step", text: "Drag 29 to the second place.", dragNum: 29, targetSlot: 1, successMsg: "Well done!", lockTarget: true },
            { type: "final_confirm", text: "31 is the largest number." }
        ]
    },
    // SECTION 2: LBD 2 Tutorial (37,30,32 — same tens)
    {
        id: "section_2", initialOrder: [37, 30, 32], correctSorted: [30, 32, 37],
        orderType: "ascending", symbol: "<", mode: "tutorial",
        steps: [
            { type: "msg", text: "Arrange the numbers from the smallest to the largest." },
            { type: "show_slots", text: "Let us put the steps in order from smallest to largest." },
            { type: "instruction", text: "Look at the tens digit.", highlight: "tens", highlightStones: true },
            { type: "msg", text: "All the numbers have the same tens digit." },
            { type: "instruction", text: "Now look at the ones digits.", highlight: "ones", highlightStones: true },
            { type: "tap", text: "Tap the smallest ones digit.", targetNum: 30, digitType: "ones", highlight: "ones", highlightStones: true },
            { type: "msg", text: "So, 30 is the smallest number!", glowNum: 30 },
            { type: "swap_step", text: "Drag 30 to the first place.", dragNum: 30, targetSlot: 0, successMsg: "Well done!", lockTarget: true },
            { type: "instruction", text: "Compare the ones digit of the remaining numbers.", highlight: "ones", highlightStones: "remaining" },
            { type: "tap", text: "Tap the smaller ones digit.", targetNum: 32, digitType: "ones", highlight: "ones", highlightStones: "remaining" },
            { type: "msg", text: "So, 32 is smaller than 37.", glowNum: 32 },
            { type: "swap_step", text: "Drag 32 to the second place.", dragNum: 32, targetSlot: 1, successMsg: "Well done!", lockTarget: true },
            { type: "final_confirm", text: "37 is the largest number." }
        ]
    },
    // SECTION 3: LBD 3 IP Practice (31,35,13)
    {
        id: "section_3", initialOrder: [31, 35, 13], correctSorted: [13, 31, 35],
        orderType: "ascending", symbol: "<", mode: "ip",
        steps: [
            { type: "msg", text: "Put the steps in order." },
            { type: "show_slots", text: "Put the steps in order from smallest to largest." }
        ]
    },
    // SECTION 4: LBD 4 IP Practice (58,35,53)
    {
        id: "section_4", initialOrder: [58, 35, 53], correctSorted: [35, 53, 58],
        orderType: "ascending", symbol: "<", mode: "ip",
        steps: [
            { type: "msg", text: "Drag the steps into order." },
            { type: "show_slots", text: "Put the steps in order from smallest to largest." }
        ]
    },
    // SECTION 5: LBD 5 IP Practice (76,71,73)
    {
        id: "section_5", initialOrder: [76, 71, 73], correctSorted: [71, 73, 76],
        orderType: "ascending", symbol: "<", mode: "ip",
        steps: [
            { type: "msg", text: "Drag the steps into order." },
            { type: "show_slots", text: "From smallest to largest." }
        ]
    },
    // SECTION 6: LBD 6 IP Practice (64,59,60)
    {
        id: "section_6", initialOrder: [64, 59, 60], correctSorted: [59, 60, 64],
        orderType: "ascending", symbol: "<", mode: "ip",
        steps: [
            { type: "msg", text: "Drag the steps into order." },
            { type: "show_slots", text: "From smallest to largest." }
        ]
    },
];

// --- INITIALIZATION ---
const batSpriteURL = 'image/Bat Sprite Sheet.png';

function initBatSprite() { /* original PNG already has transparency */ }

let wizardFlying = false;
let flyingWizardURL      = 'image/Flying wizard.png';
let flyingWizardDownURL  = 'image/Flying wizard down thumb.png';

// Track last character shown so Agni/Neel never appear back-to-back together
let lastFlyingChar = ''; // 'wizard' | 'agni-neel'

const CORRECT_CHARS = [
    'image/Flying wizard.png',
    'image/agni and neel thumb up.png'
];
const WRONG_CHARS = [
    null, // will use flyingWizardDownURL
    'image/agni and neel thumb down.png'
];

function stripBg(src, callback) {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = data.data;
        const bgR = px[0], bgG = px[1], bgB = px[2];
        for (let i = 0; i < px.length; i += 4) {
            const diff = Math.abs(px[i]-bgR) + Math.abs(px[i+1]-bgG) + Math.abs(px[i+2]-bgB);
            if (diff < 60) px[i+3] = 0;
        }
        ctx.putImageData(data, 0, 0);
        callback(canvas.toDataURL('image/png'));
    };
    img.src = src;
}

function initFlyingWizard() {
    stripBg('image/Flying wizard.png',              url => { flyingWizardURL     = url; CORRECT_CHARS[0] = url; });
    stripBg('image/Flying wizard down thumb.png',   url => { flyingWizardDownURL = url; WRONG_CHARS[0]   = url; });
    stripBg('image/agni and neel thumb up.png',     url => { CORRECT_CHARS[1] = url; });
    stripBg('image/agni and neel thumb down.png',   url => { WRONG_CHARS[1]   = url; });
}

function showFlyingWizard(correct = true) {
    if (wizardFlying) return;
    wizardFlying = true;

    // Pick character — alternate so Agni+Neel and wizard don't repeat consecutively
    const chars = correct ? CORRECT_CHARS : WRONG_CHARS;
    let idx;
    if (lastFlyingChar === 'agni-neel') {
        idx = 0; // use wizard this time
    } else if (lastFlyingChar === 'wizard') {
        idx = 1; // use agni-neel this time
    } else {
        idx = Math.random() < 0.5 ? 0 : 1; // random on first call
    }
    lastFlyingChar = idx === 0 ? 'wizard' : 'agni-neel';
    const charURL = chars[idx] || (correct ? flyingWizardURL : flyingWizardDownURL);

    const gameContainer = document.getElementById("gameContainer");
    const cr = gameContainer.getBoundingClientRect();

    const wh = Math.round(320 * gameState.scale);
    const screenY = cr.top + cr.height * 0.82 - wh / 2;

    const wiz = document.createElement("img");
    wiz.src = charURL;
    wiz.className = "flying-wizard";
    wiz.style.height = `${wh}px`;
    wiz.style.width  = "auto";
    wiz.style.top    = `${screenY}px`;
    wiz.style.left   = `${cr.left - 250}px`;

    document.body.appendChild(wiz);

    // Calculate travel after image loads (to get natural width)
    const travel = cr.width + 500;
    wiz.style.setProperty("--travel", `${travel}px`);

    const isAgniNeel = (lastFlyingChar === 'agni-neel');

    // Spawn smoke particles while flying
    let smokeInterval = setInterval(() => {
        const wizRect = wiz.getBoundingClientRect();
        if (!wizRect.width) return;
        if (isAgniNeel) {
            // Orange smoke from Neel's feet (bottom-left of the combined image)
            spawnWizardSmoke(
                wizRect.left + wizRect.width  * 0.08,
                wizRect.top  + wizRect.height * 0.85,
                'orange'
            );
        } else {
            // Blue smoke from wizard wand tip
            spawnWizardSmoke(
                wizRect.left + wizRect.width  * 0.25,
                wizRect.top  + wizRect.height * 0.72,
                'blue'
            );
        }
    }, 60);

    const duration = 4500;
    setTimeout(() => {
        clearInterval(smokeInterval);
        wiz.remove();
        wizardFlying = false;
    }, duration + 200);
}

function spawnWizardSmoke(x, y, color = 'blue') {
    const s = document.createElement("div");
    s.className = color === 'orange' ? "wiz-smoke wiz-smoke-orange" : "wiz-smoke";
    s.style.left = `${x}px`;
    s.style.top  = `${y}px`;
    s.style.width = s.style.height = `${12 + Math.random() * 14}px`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 800);
}

document.addEventListener("DOMContentLoaded", () => {
    setupLayout();
    setupAudio();
    startBackgroundMusic();
    initBatSprite();
    initFlyingWizard();
    setupFXCanvas();
    
    loadLevel(0);

    window.addEventListener("resize", handleResize);
    
    document.getElementById("checkBtn").addEventListener("click", () => {
        const level = LEVELS[gameState.currentLevelIdx];
        if (level.mode !== "ip" || gameState.levelComplete) return;

        const current = gameState.slots.map(el => parseInt(el.dataset.num));
        const correct = current.every((n, i) => n === level.correctSorted[i]);

        if (correct) {
            document.getElementById("checkBtn").style.display = "none";
            clearIdleTimer();
            gameState.slotsLocked = [true, true, true];
            document.getElementById("sep_0").classList.add("arrow-glow-yellow");
            document.getElementById("sep_1").classList.add("arrow-glow-yellow");
            triggerVictory();
        } else {
            playSynth('wrong');
            setInstruction("Not quite! Try a different order.");
            speakText("Not quite! Try a different order.");
            gameState.slots.forEach((el, idx) => {
                if (parseInt(el.dataset.num) !== level.correctSorted[idx]) {
                    el.classList.add("stone-glow-red");
                    setTimeout(() => el.classList.remove("stone-glow-red"), 700);
                }
            });
        }
    });

    // Transition video: play between levels
    const transitionVideo = document.getElementById("transitionVideo");
    transitionVideo.addEventListener("ended", () => {
        const overlay = document.getElementById("transitionOverlay");
        overlay.classList.remove("active");
        transitionVideo.pause();
        transitionVideo.currentTime = 0;
        // Resume background music when next LBD starts
        const bgMusic = document.getElementById("bgMusic");
        if (bgMusic) bgMusic.play().catch(() => {});
        const nextLvlIdx = gameState.currentLevelIdx + 1;
        loadLevel(nextLvlIdx < LEVELS.length ? nextLvlIdx : 0);
    });
});

function setupLayout() {
    handleResize();
}

function handleResize() {
    const container = document.getElementById("gameContainer");
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    
    // Fit content fully within viewport — body background fills the rest
    const scale = Math.min(ww / 1920, wh / 1080);
    gameState.scale = scale;

    container.style.transform = `scale(${scale})`;
}

function setupAudio() {
    if (!gameState.audioCtx) {
        gameState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    startBackgroundMusic();
}

function startBackgroundMusic() {
    const music = document.getElementById("bgMusic");
    if (!music) return;
    music.volume = 0.12;
    music.muted = true;
    music.play().then(() => {
        // Browser allowed muted autoplay — unmute immediately
        music.muted = false;
    }).catch(() => {});
}

function playSynth(type) {
    if (!gameState.audioCtx) return;
    const ctx = gameState.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'pop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.2); // C6
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'wrong') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(140, now + 0.2);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
    } else if (type === 'victory') {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);
            o.type = 'triangle';
            o.frequency.setValueAtTime(freq, now + (i * 0.15));
            g.gain.setValueAtTime(0, now + (i * 0.15));
            g.gain.linearRampToValueAtTime(0.2, now + (i * 0.15) + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, now + (i * 0.15) + 0.5);
            o.start(now + (i * 0.15));
            o.stop(now + (i * 0.15) + 0.5);
        });
    }
}

// --- LEVEL MANAGEMENT ---
function loadLevel(idx) {
    gameState.currentLevelIdx = idx;
    gameState.currentStepIdx = 0;
    gameState.slotsLocked = [false, false, false];
    gameState.consecutiveErrors = 0;
    gameState.isWaitingForClick = false;
    gameState.levelComplete = false;
    clearIdleTimer();
    clearNudgeTimer();
    document.getElementById("transitionOverlay").classList.remove("active");
    document.getElementById("checkBtn").style.display = "none";
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    
    const level = LEVELS[idx];
    
    // Pre-clear playground
    const playground = document.getElementById("playground");
    playground.innerHTML = "";
    
    // Reset separators HTML
    const container = document.getElementById("slotsContainer");
    // Rebuild slots HTML structure cleanly
    container.innerHTML = `
        <div class="slot-wrapper">
            <div class="slot-target" id="target_0" data-slot="0">
                <div class="slot-glow"></div>
                <div class="slot-dash-outline"></div>
            </div>
        </div>
        <div class="slot-separator" id="sep_0"><img src="image/arrow.png" class="sep-arrow" /></div>
        <div class="slot-wrapper">
            <div class="slot-target" id="target_1" data-slot="1">
                <div class="slot-glow"></div>
                <div class="slot-dash-outline"></div>
            </div>
        </div>
        <div class="slot-separator" id="sep_1"><img src="image/arrow.png" class="sep-arrow" /></div>
        <div class="slot-wrapper">
            <div class="slot-target" id="target_2" data-slot="2">
                <div class="slot-glow"></div>
                <div class="slot-dash-outline"></div>
            </div>
        </div>
    `;
    
    // Hide slots and separators initially for intro feeling
    document.getElementById("slotsContainer").style.opacity = "0";
    
    // Create step objects & populate initial shuffled slots
    gameState.slots = [];
    
    level.initialOrder.forEach((num, i) => {
        const el = createStepElement(num);
        playground.appendChild(el);
        gameState.slots[i] = el;
    });
    
    // Render immediate snap to positions
    renderSlots(false);
    
    runStep();
}

function createStepElement(num) {
    const el = document.createElement("div");
    el.className = "number-step drifting";
    el.id = `step_${num}`;
    el.dataset.num = num;
    
    const content = document.createElement("div");
    content.className = "step-content";
    
    const stoneImg = document.createElement("img");
    stoneImg.src = "image/Stone.png";
    stoneImg.className = "step-image";
    content.appendChild(stoneImg);

    const eyesContainer = document.createElement("div");
    eyesContainer.className = "naughty-eyes-container";

    const eyesOpen = document.createElement("img");
    eyesOpen.src = "image/eye.png";
    eyesOpen.className = "eyes-open";

    const eyesClosed = document.createElement("img");
    eyesClosed.src = "image/closed eye.png";
    eyesClosed.className = "eyes-closed";

    eyesContainer.appendChild(eyesOpen);
    eyesContainer.appendChild(eyesClosed);
    content.appendChild(eyesContainer);

    const zzz = document.createElement("div");
    zzz.className = "sleeping-zzz";
    zzz.innerHTML = `<span>z</span><span>z</span><span>Z</span>`;
    content.appendChild(zzz);
    
    // Digits structure
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    
    const holder = document.createElement("div");
    holder.className = "digit-holder";
    
    const tensSpan = document.createElement("span");
    tensSpan.className = "digit tens";
    tensSpan.textContent = tens;
    tensSpan.dataset.type = "tens";
    
    const onesSpan = document.createElement("span");
    onesSpan.className = "digit ones";
    onesSpan.textContent = ones;
    onesSpan.dataset.type = "ones";
    
    holder.appendChild(tensSpan);
    holder.appendChild(onesSpan);
    content.appendChild(holder);
    
    el.appendChild(content);
    
    // Interactions setup
    setupInteractions(el);
    
    return el;
}

function setupInteractions(el) {
    // Click digit handler
    const digits = el.querySelectorAll(".digit");
    digits.forEach(d => {
        d.addEventListener("click", (e) => {
            if (gameState.isWaitingForClick) {
                e.stopPropagation(); // Stop bubbling so general stone tap doesn't duplicate
                handleDigitClick(el, d);
            }
        });
    });
    
    // Click anywhere on the stone handler - fulfills user request
    el.addEventListener("click", (e) => {
        if (gameState.isWaitingForClick) {
            const target = gameState.targetDigitClick;
            // Find the correct active comparison digit (tens or ones) on this stone
            const activeDigitEl = el.querySelector(`.digit.${target.type}`);
            if (activeDigitEl) {
                handleDigitClick(el, activeDigitEl);
            }
        }
    });
    
    // Drag logic
    el.addEventListener("pointerdown", (e) => {
        if (gameState.levelComplete) return;
        if (gameState.isWaitingForClick) return;
        
        const slotIdx = gameState.slots.indexOf(el);
        if (gameState.slotsLocked[slotIdx]) return; // Cannot drag confirmed locked steps
        
        // If in Tutorial, make sure user can only drag the designated step
        const currentLevel = LEVELS[gameState.currentLevelIdx];
        if (currentLevel.mode === "tutorial") {
            const step = currentLevel.steps[gameState.currentStepIdx];
            if (step && step.type === "swap_step") {
                if (parseInt(el.dataset.num) !== step.dragNum) {
                    triggerLockWobble(el);
                    return;
                }
            } else {
                // Non-drag step in tutorial
                return;
            }
        }
        
        startDragging(el, e);
    });
}

function renderSlots(animate = true) {
    gameState.slots.forEach((el, idx) => {
        if (!el || el === gameState.activeDrag) return;
        
        const pos = getSlotPos(idx);
        
        if (animate) {
            // Snappy spring ease gives a distinct 'magnetic' attraction feel!
            el.style.transition = "left 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)";
        } else {
            el.style.transition = "none";
        }
        
        el.style.left = `${pos.x}px`;
        el.style.top = `${pos.y}px`;
        
        // Keep reference of current slot
        el.dataset.currentSlot = idx;
    });
}

// --- DRAGGING LOGIC FOR SWAPPING ---
function startDragging(el, e) {
    e.preventDefault();
    
    gameState.activeDrag = el;
    gameState.dragOriginSlotIdx = gameState.slots.indexOf(el);
    clearIdleTimer();
    
    el.classList.remove("drifting");
    el.classList.add("dragging");
    el.style.transition = "none";
    
    const container = document.getElementById("gameContainer");
    const rect = container.getBoundingClientRect();
    
    const gameX = (e.clientX - rect.left) / gameState.scale;
    const gameY = (e.clientY - rect.top) / gameState.scale;
    
    const currentL = parseFloat(el.style.left);
    const currentT = parseFloat(el.style.top);
    const lockedY = currentT; // lock vertical position for horizontal-only drag

    gameState.dragOffset.x = gameX - currentL;

    el.setPointerCapture(e.pointerId);

    const onMove = (evt) => {
        if (gameState.activeDrag !== el) return;

        const moveX = (evt.clientX - rect.left) / gameState.scale;

        el.style.left = `${moveX - gameState.dragOffset.x}px`;
        el.style.top = `${lockedY}px`;

        checkForVisualSwap(el);
    };
    
    const onUp = (evt) => {
        el.releasePointerCapture(evt.pointerId);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        
        stopDragging(el);
    };
    
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
}

function checkForVisualSwap(el) {
    const elRect = el.getBoundingClientRect();
    const centerX = elRect.left + elRect.width / 2;
    const centerY = elRect.top + elRect.height / 2;

    let nearestSlotIdx = -1;
    let minDist = 999999;
    document.querySelectorAll(".slot-target").forEach(target => {
        const tRect = target.getBoundingClientRect();
        const d = Math.hypot(centerX - (tRect.left + tRect.width / 2), centerY - (tRect.top + tRect.height / 2));
        if (d < 260 * gameState.scale && d < minDist) {
            minDist = d;
            nearestSlotIdx = parseInt(target.dataset.slot);
        }
    });

    const originIdx = gameState.dragOriginSlotIdx;

    // Reset all non-dragged stones to their real positions first
    gameState.slots.forEach((stone, idx) => {
        if (stone && stone !== el && !gameState.slotsLocked[idx]) {
            const p = getSlotPos(idx);
            stone.style.transition = "left 0.15s ease, top 0.15s ease";
            stone.style.left = `${p.x}px`;
            stone.style.top = `${p.y}px`;
        }
    });

    if (nearestSlotIdx !== -1 && nearestSlotIdx !== originIdx && !gameState.slotsLocked[nearestSlotIdx]) {
        gameState.previewSwapSlot = nearestSlotIdx;
        // Shift preview: move all stones between origin and target by one slot
        const step = nearestSlotIdx > originIdx ? 1 : -1;
        for (let i = originIdx + step; i !== nearestSlotIdx + step; i += step) {
            const stone = gameState.slots[i];
            if (stone && !gameState.slotsLocked[i]) {
                const shiftedPos = getSlotPos(i - step);
                stone.style.transition = "left 0.15s ease, top 0.15s ease";
                stone.style.left = `${shiftedPos.x}px`;
                stone.style.top = `${shiftedPos.y}px`;
            }
        }
    } else {
        gameState.previewSwapSlot = -1;
    }
}

function stopDragging(el) {
    el.classList.remove("dragging");
    
    const level = LEVELS[gameState.currentLevelIdx];
    const step = level.steps[gameState.currentStepIdx];
    
    const elNum = parseInt(el.dataset.num);
    
    const elRect = el.getBoundingClientRect();
    const centerX = elRect.left + elRect.width/2;
    const centerY = elRect.top + elRect.height/2;
    
    let nearestSlotIdx = -1;
    let minDist = 999999;
    
    // Find closest slot center
    const targets = document.querySelectorAll(".slot-target");
    targets.forEach(target => {
        const tRect = target.getBoundingClientRect();
        const tCenterX = tRect.left + tRect.width/2;
        const tCenterY = tRect.top + tRect.height/2;
        const d = Math.hypot(centerX - tCenterX, centerY - tCenterY);
        
        // Increase threshold from 180 to 250 for a larger visual "magnetic pull" range
        if (d < 260 * gameState.scale && d < minDist) {
            minDist = d;
            nearestSlotIdx = parseInt(target.dataset.slot);
        }
    });
    
    // Validate Swap
    let success = false;
    
    if (nearestSlotIdx !== -1 && nearestSlotIdx !== gameState.dragOriginSlotIdx) {
        // Target is a real slot different from where we started
        if (gameState.slotsLocked[nearestSlotIdx]) {
            // Cannot swap with an already confirmed locked slot
            success = false;
        }
        else if (level.mode === "tutorial" && step.type === "swap_step") {
            // Must swap exactly to requested tutorial slot
            if (nearestSlotIdx === step.targetSlot && elNum === step.dragNum) {
                success = true;
            }
        }
        else if (level.mode === "practice" || level.mode === "ip") {
            success = true;
        }
    }
    
    gameState.activeDrag = null;
    gameState.previewSwapSlot = -1;

    if (success) {
        clearNudgeTimer(); // clear on success — next step sets its own nudge
        performSwap(gameState.dragOriginSlotIdx, nearestSlotIdx);
        playSynth('pop');

        if (level.mode === "tutorial") {
            handleTutorialSwapSuccess(nearestSlotIdx, step);
        } else {
            checkPracticeCompletion();
        }
    } else {
        // Keep nudge timer running on failure so hint stays active
        renderSlots(true);
        bounceStep(el, gameState.dragOriginSlotIdx);
        playSynth('wrong');
        el.classList.add("stone-glow-red");
        setTimeout(() => el.classList.remove("stone-glow-red"), 700);
        const wr = el.getBoundingClientRect();
        showFlyingWizard(false);


    }

    const currentLevel = LEVELS[gameState.currentLevelIdx];
    if (currentLevel.mode === "practice") startIdleTimer();
}

function performSwap(fromIdx, toIdx) {
    const el = gameState.slots[fromIdx];

    if (fromIdx > toIdx) {
        // Dragging left: shift elements right to fill the gap
        for (let i = fromIdx; i > toIdx; i--) {
            gameState.slots[i] = gameState.slots[i - 1];
        }
    } else {
        // Dragging right: shift elements left to fill the gap
        for (let i = fromIdx; i < toIdx; i++) {
            gameState.slots[i] = gameState.slots[i + 1];
        }
    }

    gameState.slots[toIdx] = el;
    renderSlots(true);
}

function bounceStep(el, slotIdx) {
    const pos = getSlotPos(slotIdx);
    el.style.transition = "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
    
    setTimeout(() => {
        el.classList.add("drifting");
    }, 400);
}

function triggerLockWobble(el) {
    playSynth('wrong');
    el.classList.add("stone-glow-red");
    setTimeout(() => el.classList.remove("stone-glow-red"), 700);
    const r = el.getBoundingClientRect();
    showFlyingWizard(false);
}

function spawnBats(cx, cy) {
    const count = 6;
    for (let i = 0; i < count; i++) {
        const bat = document.createElement("div");
        bat.className = "wrong-bat";
        const angle = (i / count) * Math.PI * 2 + (Math.random() * 0.4);
        const dist  = 140 + Math.random() * 120;
        const delay = Math.random() * 0.15;
        const size  = 42 + Math.random() * 18;
        bat.style.left = `${cx}px`;
        bat.style.top  = `${cy}px`;
        bat.style.width  = `${size}px`;
        bat.style.height = `${size}px`;
        bat.style.setProperty("--dx",  `${Math.cos(angle) * dist}px`);
        bat.style.setProperty("--dy",  `${Math.sin(angle) * dist}px`);
        bat.style.setProperty("--wy",  `${(Math.random() - 0.5) * 80}px`);
        bat.style.setProperty("--rot", `${(Math.random() - 0.5) * 45}deg`);
        // Sprite sheet: ~1440×820px, 10 cols × 5 rows, each cell ~144×144px
        // FLY CYCLE is row 1. Skip the label (~22px) by offsetting background-position-y.
        const scale = size / 144;
        const sheetW = Math.round(1440 * scale);
        const sheetH = Math.round(820 * scale);
        const yOffset = Math.round(22 * scale); // skip row label
        bat.style.backgroundImage = `url('${batSpriteURL}')`;
        bat.style.backgroundSize = `${sheetW}px ${sheetH}px`;
        bat.style.backgroundPosition = `0 -${yOffset}px`;
        bat.style.setProperty("--sprite-w", `${Math.round(size * (1440/144))}px`);
        bat.style.setProperty("--yo", `-${yOffset}px`);
        bat.style.animationDelay    = `${delay}s`;
        bat.style.animationDuration = `${1.1 + Math.random() * 0.6}s`;
        document.body.appendChild(bat);
        setTimeout(() => bat.remove(), 2000);
    }
}



function pickSpookyVoice() {
    return window.speechSynthesis.getVoices().find(v =>
        v.lang.startsWith('en') && (
            v.name.toLowerCase().includes('david') ||
            v.name.toLowerCase().includes('james') ||
            v.name.toLowerCase().includes('mark')  ||
            v.name.toLowerCase().includes('male')  ||
            v.name.toLowerCase().includes('google uk english male')
        )
    ) || null;
}

function speakText(text, callback) {
    if (!('speechSynthesis' in window)) {
        if (callback) setTimeout(callback, 3000);
        return;
    }

    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.pitch  = 0.5;
    utter.rate   = 0.78;
    utter.volume = 1.0;

    if (callback) {
        let done = false;
        const advance = () => {
            if (done) return;
            done = true;
            setTimeout(callback, 900);
        };
        utter.onend = advance;
        const words = text.split(' ').length;
        setTimeout(advance, Math.max(4500, words * 820));
    }

    const doSpeak = () => {
        const voice = pickSpookyVoice();
        if (voice) utter.voice = voice;
        window.speechSynthesis.speak(utter);
    };

    // If voices already loaded speak immediately, otherwise wait
    if (window.speechSynthesis.getVoices().length > 0) {
        doSpeak();
    } else {
        window.speechSynthesis.addEventListener('voiceschanged', function onVoices() {
            window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
            doSpeak();
        });
    }
}

// Pre-load voices as early as possible
if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

// --- STEP SYSTEM / TUTORIAL SEQUENCER ---
function setInstruction(txt) {
    document.getElementById("instructionText").textContent = txt;
}

function runStep() {
    
    const level = LEVELS[gameState.currentLevelIdx];
    const step = level.steps[gameState.currentStepIdx];
    
    if (!step) {
        triggerVictory();
        return;
    }
    
    setInstruction(step.text);
    
    // Clear temporary glows and highlights
    document.querySelectorAll(".digit").forEach(d => d.classList.remove("highlight"));
    document.querySelectorAll(".number-step").forEach(s => {
        s.classList.remove("stone-glow-white", "stone-glow-green", "stone-glow-red");
    });
    document.querySelectorAll(".slot-target").forEach(t => t.classList.remove("glow-active"));
    
    // Glow only the individual stone on swap steps
    if (step.type === "swap_step") {
        const swapEl = document.getElementById(`step_${step.dragNum}`);
        if (swapEl) swapEl.classList.add("stone-glow-white");
    }
    
    // Voice-driven orchestration
    if (step.type === "msg") {
        speakText(step.text, () => nextStep());
    }
    else if (step.type === "show_slots") {
        document.getElementById("slotsContainer").style.transition = "opacity 0.8s ease";
        document.getElementById("slotsContainer").style.opacity = "1";

        if (level.mode === "practice") {
            speakText(step.text);
            setTimeout(() => startIdleTimer(), 3500);
        } else if (level.mode === "ip") {
            speakText(step.text);
            setTimeout(() => {
                document.getElementById("checkBtn").style.display = "block";
                startIdleTimer();
            }, 3200);
        } else {
            speakText(step.text, () => nextStep());
        }
    }
    else if (step.type === "instruction") {
        if (step.highlight) {
            applyDigitHighlights(step.highlight, step.highlightStones);
        }
        speakText(step.text, () => nextStep());
    }
    else if (step.type === "tap") {
        gameState.isWaitingForClick = true;
        gameState.targetDigitClick = { num: step.targetNum, type: step.digitType };
        applyDigitHighlights(step.highlight, step.highlightStones);
        speakText(step.text);
        const tapTarget = document.getElementById(`step_${step.targetNum}`);
        if (tapTarget) startNudgeTimer("tap", tapTarget, null);
    }
    else if (step.type === "swap_step") {
        gameState.isWaitingForClick = false;
        const slot = document.getElementById(`target_${step.targetSlot}`);
        if (slot) slot.classList.add("glow-active");
        speakText(step.text);
        const dragTarget = document.getElementById(`step_${step.dragNum}`);
        if (dragTarget) startNudgeTimer("drag", dragTarget, step.targetSlot);
    }
    else if (step.type === "final_confirm") {
        // step.text IS the final confirmation message (e.g. "31 is the largest number.")
        const remainingEl = gameState.slots.find((el, idx) => !gameState.slotsLocked[idx]);
        if (remainingEl) {
            const remainingIdx = gameState.slots.indexOf(remainingEl);
            gameState.slotsLocked[remainingIdx] = true;
            remainingEl.classList.add("stone-glow-white");
            remainingEl.querySelectorAll(".digit").forEach(d => d.classList.add("highlight"));
        }
        speakText(step.text, () => nextStep());
    }
}

function nextStep() {
    gameState.currentStepIdx++;
    runStep();
}

function applyDigitHighlights(digitType, stonesScope) {
    gameState.slots.forEach((el, idx) => {
        if (gameState.slotsLocked[idx]) return;

        // Highlight only the relevant digit span — no stone glow here
        const digit = el.querySelector(`.digit.${digitType}`);
        if (digit) digit.classList.add("highlight");
    });
}

function handleDigitClick(stepEl, digitEl) {
    const num = parseInt(stepEl.dataset.num);
    const type = digitEl.dataset.type;
    
    const target = gameState.targetDigitClick;
    
    if (num === target.num && type === target.type) {
        gameState.isWaitingForClick = false;
        gameState.consecutiveErrors = 0;
        clearNudgeTimer();
        
        playSynth('correct');
        
        document.querySelectorAll(".number-step").forEach(s => s.classList.remove("stone-glow-white"));
        stepEl.classList.add("stone-glow-green");
        stepEl.querySelectorAll(".digit").forEach(d => d.classList.add("highlight"));
        showFlyingWizard(true);
        
        // Starburst fx
        const rect = stepEl.getBoundingClientRect();
        const cont = document.getElementById("gameContainer").getBoundingClientRect();
        const fxX = (rect.left + rect.width/2 - cont.left) / gameState.scale;
        const fxY = (rect.top + rect.height/2 - cont.top) / gameState.scale;
        spawnStars(fxX, fxY, "#00e676", 25);
        
        // Render visual feedback text change
        const currentStep = LEVELS[gameState.currentLevelIdx].steps[gameState.currentStepIdx];
        let correctPrompt = `Yes! ${digitEl.textContent} is the smallest ${type} digit!`;
        if (currentStep.targetNum === 29) correctPrompt = "Yes! 2 is smaller than 3!";
        if (currentStep.targetNum === 30) correctPrompt = "Yes! 0 is the smallest ones digit!";
        if (currentStep.targetNum === 32) correctPrompt = "Yes! 2 is smaller than 7!";
        if (currentStep.targetNum === 53) correctPrompt = "Yes! 3 is smaller than 8!";
        
        setInstruction(correctPrompt);
        
        // Trigger callback driven voice progression
        speakText(correctPrompt, () => {
            nextStep();
        });
        
    } else {
        // Incorrect click
        playSynth('wrong');
        gameState.consecutiveErrors++;
        
        stepEl.classList.add("stone-glow-red");
        setTimeout(() => stepEl.classList.remove("stone-glow-red"), 600);
        const sr = stepEl.getBoundingClientRect();
        showFlyingWizard(false);
        setInstruction("Oops! Try Again.");
        speakText("Oops! Try Again.");
        
        if (gameState.consecutiveErrors >= 2) {
            // Show hint - pulse target digit
            const correctEl = document.getElementById(`step_${target.num}`);
            const corrDigit = correctEl.querySelector(`.digit.${target.type}`);
            corrDigit.animate([
                { opacity: 1.0 },
                { opacity: 0.3 },
                { opacity: 1.0 }
            ], { duration: 400, iterations: 3 });
        }
    }
}

function handleTutorialSwapSuccess(slotIdx, stepData) {
    const stepEl = gameState.slots[slotIdx];
    
    // Highlight successful placement
    playSynth('correct');
    stepEl.classList.add("stone-glow-green");
    
    // Lock target
    if (stepData.lockTarget) {
        gameState.slotsLocked[slotIdx] = true;
        stepEl.classList.add("faded"); // 50% transparent fade
        stepEl.classList.remove("drifting");
    }
    
    const cont = document.getElementById("gameContainer").getBoundingClientRect();
    const elRect = stepEl.getBoundingClientRect();
    spawnStars((elRect.left + elRect.width/2 - cont.left)/gameState.scale, (elRect.top + elRect.height/2 - cont.top)/gameState.scale, "#ffeb3b", 25);
    showFlyingWizard();
    
    setInstruction(stepData.successMsg);
    
    // Trigger callback driven voice progression
    speakText(stepData.successMsg, () => {
        nextStep();
    });
}

// --- IDLE / NUDGE TIMERS ---
function startIdleTimer() {
    clearIdleTimer();
    gameState.idleTimer = setTimeout(() => showPracticeNudge(), 6000);
}

function clearIdleTimer() {
    if (gameState.idleTimer) { clearTimeout(gameState.idleTimer); gameState.idleTimer = null; }
}

function startNudgeTimer(type, targetEl, targetSlotIdx) {
    if (gameState.nudgeTimer) { clearTimeout(gameState.nudgeTimer); gameState.nudgeTimer = null; }
    // Capture current level + step so the nudge only fires if still on the same step
    const lvl  = gameState.currentLevelIdx;
    const step = gameState.currentStepIdx;
    gameState.nudgeTimer = setTimeout(() => {
        // Bail if level or step has changed
        if (gameState.currentLevelIdx !== lvl || gameState.currentStepIdx !== step) return;
        if (!targetEl || !targetEl.parentNode) return;
        if (type === "tap") showTapNudge(targetEl);
        else if (type === "drag") showDragNudge(targetEl, targetSlotIdx);
        if (gameState.nudgeTimer) { clearTimeout(gameState.nudgeTimer); gameState.nudgeTimer = null; }
        gameState.nudgeTimer = setTimeout(() => startNudgeTimer(type, targetEl, targetSlotIdx), 8000);
    }, 8000);
}

function clearNudgeTimer() {
    if (gameState.nudgeTimer) { clearTimeout(gameState.nudgeTimer); gameState.nudgeTimer = null; }
    clearNudgeElements();
}

// Stone center in game coords (stones are 440×280, positioned via style.left/top)
function stoneCenter(el) {
    return {
        x: parseFloat(el.style.left) + 220,
        y: parseFloat(el.style.top)  + 140
    };
}

function clearNudgeElements() {
    document.querySelectorAll(".tap-nudge, .tap-nudge-hand, .drag-nudge, .drag-path-svg").forEach(el => el.remove());
}

function showTapNudge(stoneEl) {
    clearNudgeElements();
    const gc = document.getElementById("gameContainer");
    const { x: cx, y: cy } = stoneCenter(stoneEl);

    // Ripple rings centred on the stone
    for (let i = 0; i < 3; i++) {
        const ring = document.createElement("div");
        ring.className = "tap-nudge";
        ring.style.left = `${cx}px`;
        ring.style.top  = `${cy}px`;
        ring.style.animationDelay = `${i * 0.38}s`;
        gc.appendChild(ring);
    }

    // Hand pointing at the stone digit area
    const hand = document.createElement("img");
    hand.src = "image/nudge.png";
    hand.className = "tap-nudge-hand";
    hand.style.left = `${cx}px`;
    hand.style.top  = `${cy + 30}px`;
    gc.appendChild(hand);

    setTimeout(clearNudgeElements, 2800);
}

function showDragNudge(stoneEl, targetSlotIdx) {
    clearNudgeElements();
    const gc = document.getElementById("gameContainer");

    // Use getSlotPos for the target slot (already game coords)
    const slotPos = getSlotPos(targetSlotIdx);
    const { x: fromX, y: fromY } = stoneCenter(stoneEl);
    const toX   = slotPos.x + 220; // slot center x
    const lineY = fromY;            // same horizontal row

    // Dashed horizontal line
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("drag-path-svg");
    svg.style.cssText = "position:absolute;top:0;left:0;width:1920px;height:1080px;pointer-events:none;z-index:9998;overflow:visible;";

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", fromX); line.setAttribute("y1", lineY);
    line.setAttribute("x2", toX);   line.setAttribute("y2", lineY);
    line.setAttribute("stroke", "rgba(255,230,80,0.9)");
    line.setAttribute("stroke-width", "5");
    line.setAttribute("stroke-dasharray", "18 10");
    line.setAttribute("stroke-linecap", "round");
    line.classList.add("drag-dash-line");
    svg.appendChild(line);

    const dir = toX > fromX ? 0 : 180;
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    arrow.setAttribute("points", "0,-10 20,0 0,10");
    arrow.setAttribute("fill", "rgba(255,230,80,0.95)");
    arrow.setAttribute("transform", `translate(${toX},${lineY}) rotate(${dir})`);
    svg.appendChild(arrow);
    gc.appendChild(svg);

    // Hand sliding from stone to target
    const hand = document.createElement("img");
    hand.src = "image/nudge.png";
    hand.className = "drag-nudge";
    hand.style.left = `${fromX}px`;
    hand.style.top  = `${fromY + 30}px`;
    hand.style.setProperty("--ndx", `${toX - fromX}px`);
    hand.style.setProperty("--ndy", "0px");
    hand.style.setProperty("--arc", "0px");
    gc.appendChild(hand);

    setTimeout(clearNudgeElements, 2800);
}

function showPracticeNudge() {
    const level = LEVELS[gameState.currentLevelIdx];
    if (!level || (level.mode !== "practice" && level.mode !== "ip")) return;

    const currentValues = gameState.slots.map(el => parseInt(el.dataset.num));
    for (let i = 0; i < currentValues.length; i++) {
        if (currentValues[i] !== level.correctSorted[i]) {
            // Find which stone should go to slot i
            const correctNum = level.correctSorted[i];
            const stoneEl = document.getElementById(`step_${correctNum}`);
            if (stoneEl) showDragNudge(stoneEl, i);
            break;
        }
    }
    startIdleTimer();
}

function checkPracticeCompletion() {
    const level = LEVELS[gameState.currentLevelIdx];

    const currentValues = gameState.slots.map(el => parseInt(el.dataset.num));

    let isCorrect = true;
    for (let i = 0; i < currentValues.length; i++) {
        if (currentValues[i] !== level.correctSorted[i]) { isCorrect = false; break; }
    }

    if (isCorrect) {
        clearIdleTimer();
        gameState.slotsLocked = [true, true, true];

        // Glow the math symbols yellow on correct completion
        document.getElementById("sep_0").classList.add("arrow-glow-yellow");
        document.getElementById("sep_1").classList.add("arrow-glow-yellow");

        triggerVictory();
    }
}

const BOOM_WORDS = ["BOOM!", "POW!", "BAM!", "POP!"];
const BALLOON_BOOM_COLORS = {
    "image/Group 2587.png": { color: "#4caf50",  outline: "#ffffff" },
    "image/Group 2588.png": { color: "#b039e0",  outline: "#ffffff" },
    "image/Group 2589.png": { color: "#dddddd",  outline: "#111111" },
    "image/Group 2594.png": { color: "#ff9800",  outline: "#ffffff" },
    "image/Group 2595.png": { color: "#546e7a",  outline: "#ffffff" },
    "image/Group 2597.png": { color: "#fdd835",  outline: "#ffffff" },
    "image/Group 2598.png": { color: "#eeeeee",  outline: "#111111" },
};

const BALLOON_IMAGES = [
    "image/Group 2587.png",
    "image/Group 2588.png",
    "image/Group 2589.png",
    "image/Group 2594.png",
    "image/Group 2595.png",
    "image/Group 2597.png",
    "image/Group 2598.png",
];

// CSS filter to tint the grey pop burst image to match each balloon color
const BALLOON_POP_FILTERS = {
    "image/Group 2587.png": "sepia(1) saturate(15) hue-rotate(100deg) brightness(0.9)",   // green
    "image/Group 2588.png": "sepia(1) saturate(15) hue-rotate(265deg) brightness(0.9)",   // purple
    "image/Group 2589.png": "brightness(0.85) saturate(0)",                               // white/grey
    "image/Group 2594.png": "sepia(1) saturate(15) hue-rotate(20deg) brightness(1.0)",    // orange
    "image/Group 2595.png": "brightness(0.15) saturate(0)",                               // black
    "image/Group 2597.png": "sepia(1) saturate(8) hue-rotate(50deg) brightness(1.3)",     // yellow
    "image/Group 2598.png": "brightness(0.85) saturate(0)",                               // ghost white
};

function spawnBalloons() {
    const container = document.getElementById("gameContainer");
    const totalBalloons = 14;
    let poppedOrGone = 0;
    let overlayShown = false;

    function showOverlay() {
        if (overlayShown) return;
        overlayShown = true;
        const overlay = document.getElementById("transitionOverlay");
        const video  = document.getElementById("transitionVideo");
        overlay.classList.add("active");
        video.currentTime = 0;
        video.play().catch(() => {});
        // Pause background music while video plays
        const bgMusic = document.getElementById("bgMusic");
        if (bgMusic) bgMusic.pause();
    }

    function checkAllDone() {
        poppedOrGone++;
        if (poppedOrGone >= totalBalloons) showOverlay();
    }

    // Fallback: show overlay after 7s if user ignores balloons
    setTimeout(showOverlay, 7000);

    // Tutorial hint: auto-pop one balloon as demonstration after 2.2s
    let hintShown = false;
    setTimeout(() => {
        if (hintShown || overlayShown) return;
        hintShown = true;

        const demoBalloon = document.querySelector(".celebration-balloon:not(.balloon-popped)");
        if (!demoBalloon) return;
        const br = demoBalloon.getBoundingClientRect();
        if (br.width === 0) return;

        // Show nudge hand pressing down on the balloon
        const cx = br.left + br.width / 2;
        const cy = br.top  + br.height / 2;

        const hand = document.createElement("img");
        hand.src = "image/nudge.png";
        hand.className = "tap-nudge-hand balloon-hint-el";
        hand.style.left = `${cx}px`;
        hand.style.top  = `${cy - 20}px`;
        hand.style.animationIterationCount = "1";
        hand.style.animationDuration = "0.4s";
        document.body.appendChild(hand);

        // After hand animation, pop the balloon
        setTimeout(() => {
            document.querySelectorAll(".balloon-hint-el").forEach(el => el.remove());
            if (!demoBalloon.classList.contains("balloon-popped") && demoBalloon.parentNode) {
                demoBalloon.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
            }
        }, 500);
    }, 2200);

    for (let i = 0; i < totalBalloons; i++) {
        const src = BALLOON_IMAGES[i % BALLOON_IMAGES.length];
        const balloon = document.createElement("img");
        balloon.src = src;
        balloon.className = "celebration-balloon";

        const colWidth = 1760 / totalBalloons;
        const xPos = 80 + colWidth * i + (Math.random() * colWidth * 0.5);
        const delay = i * 0.25;
        const duration = 4.5 + Math.random() * 1.5;
        const swayDir = i % 2 === 0 ? 1 : -1;

        balloon.style.left = `${xPos}px`;
        balloon.style.animationDelay = `${delay}s`;
        balloon.style.animationDuration = `${duration}s`;
        balloon.style.setProperty("--sway", `${swayDir * (40 + Math.random() * 30)}px`);
        balloon.dataset.popFilter = BALLOON_POP_FILTERS[src] || "";

        // Pop on tap
        balloon.addEventListener("pointerdown", () => {
            if (balloon.classList.contains("balloon-popped")) return;

            // Capture position BEFORE animation changes
            const br2 = balloon.getBoundingClientRect();

            balloon.classList.add("balloon-popped");
            playSynth('pop');
            const boomEl = document.createElement("div");
            boomEl.className = "balloon-boom";
            boomEl.textContent = BOOM_WORDS[Math.floor(Math.random() * BOOM_WORDS.length)];
            boomEl.style.left = `${br2.left + br2.width / 2}px`;
            boomEl.style.top = `${br2.top + br2.height / 2}px`;
            const boomStyle = BALLOON_BOOM_COLORS[src] || { color: "#ff9800", outline: "#ffffff" };
            boomEl.style.color = boomStyle.color;
            boomEl.style.setProperty("-webkit-text-stroke", `3px ${boomStyle.outline}`);
            boomEl.style.textShadow = `2px 2px 0 ${boomStyle.outline}, -2px -2px 0 ${boomStyle.outline}, 2px -2px 0 ${boomStyle.outline}, -2px 2px 0 ${boomStyle.outline}`;
            boomEl.style.fontSize = `${Math.round(72 * gameState.scale)}px`;
            document.body.appendChild(boomEl);
            setTimeout(() => boomEl.remove(), 900);


            setTimeout(() => {
                balloon.remove();
                checkAllDone();
            }, 300);
        });

        container.appendChild(balloon);

        // Auto-remove when floated off screen
        const autoRemoveMs = (delay + duration + 0.5) * 1000;
        setTimeout(() => {
            if (balloon.parentNode) {
                balloon.remove();
                checkAllDone();
            }
        }, autoRemoveMs);
    }
}

// --- VICTORY / CELEBRATION ---
function triggerVictory() {
    gameState.levelComplete = true;
    clearNudgeTimer();
    clearIdleTimer();
    setInstruction("Yayy! You fixed the steps!");
    speakText("Yayy! You fixed the steps!");
    playSynth('victory');

    // Close ALL stones' eyes at this moment (last stone wasn't faded yet)
    gameState.slots.forEach(el => {
        if (el && !el.classList.contains("faded")) {
            el.classList.add("faded");
            el.classList.remove("drifting");
        }
    });

    spawnBalloons();
}


// --- FX ENGINE (2D CANVAS) ---
let fxCtx;
let particles = [];
function setupFXCanvas() {
    const canvas = document.getElementById("fxCanvas");
    canvas.width = 1920;
    canvas.height = 1080;
    fxCtx = canvas.getContext("2d");
    
    requestAnimationFrame(updateFX);
}

function spawnStars(x, y, color = "#00ff88", count = 20) {
    for(let i=0; i<count; i++){
        const ang = Math.random()*Math.PI*2;
        const sp = 3 + Math.random()*10;
        particles.push({
            x, y,
            vx: Math.cos(ang)*sp,
            vy: Math.sin(ang)*sp,
            size: 6 + Math.random()*12,
            color,
            life: 1, decay: 0.03 + Math.random()*0.02,
            rot: Math.random()*Math.PI,
            rotSp: -0.1 + Math.random()*0.2,
            type: 'star'
        });
    }
}

function spawnConfetti() {
    const colors = ["#ff0066", "#00ffcc", "#ffea00", "#ff33ff", "#00b8ff"];
    for(let i=0; i<80; i++){
        particles.push({
            x: 1920 * Math.random(),
            y: 1100,
            vx: -4 + Math.random()*8,
            vy: -12 - Math.random()*18,
            gravity: 0.25,
            size: 8 + Math.random()*15,
            color: colors[Math.floor(Math.random()*colors.length)],
            life: 1, decay: 0.006 + Math.random()*0.008,
            rot: Math.random()*Math.PI,
            rotSp: -0.05 + Math.random()*0.1,
            type: 'rect'
        });
    }
}

function updateFX() {
    fxCtx.clearRect(0,0,1920,1080);
    for(let i=particles.length-1; i>=0; i--){
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if(p.gravity) p.vy += p.gravity;
        p.life -= p.decay;
        p.rot += p.rotSp;
        
        if(p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }
        
        fxCtx.save();
        fxCtx.translate(p.x, p.y);
        fxCtx.rotate(p.rot);
        fxCtx.globalAlpha = p.life;
        fxCtx.fillStyle = p.color;
        
        if(p.type === 'star') {
            fxCtx.beginPath();
            for(let s=0; s<5; s++){
                fxCtx.lineTo(0, -p.size);
                fxCtx.rotate(Math.PI/5);
                fxCtx.lineTo(0, -p.size*0.4);
                fxCtx.rotate(Math.PI/5);
            }
            fxCtx.closePath();
            fxCtx.fill();
        } else {
            fxCtx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6);
        }
        fxCtx.restore();
    }
    requestAnimationFrame(updateFX);
}
