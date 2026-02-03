const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const timerElement = document.getElementById('timer');

// 1. IMAGE SETUP
const img = new Image();
// This MUST match the filename in your VS Code sidebar exactly
img.src = 'image1.png'; 

// 2. TIME CALCULATIONS
const targetDate = new Date("March 1, 2026 00:00:00").getTime();
// Start Date set to January 1st to ensure many pieces are already visible
const startDate = new Date("January 1, 2026 00:00:00").getTime(); 

const totalSecondsInPuzzle = Math.floor((targetDate - startDate) / 1000);

let w, h;
let pieces = [];
let isReady = false;

// 3. INITIALIZATION
function init() {
    resize();
    
    // Create an array of piece indices
    pieces = Array.from({ length: totalSecondsInPuzzle }, (_, i) => i);
    
    // Shuffle the array so pieces pop up in random locations
    for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    
    isReady = true;
    animate();
}

// 4. THE ANIMATION LOOP
function animate() {
    if (!isReady) return;

    // IMPORTANT: Clear with a solid dark color to prevent white flicker
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);
    
    const now = Date.now();
    const timeLeft = targetDate - now;

    // Seconds elapsed since our January 1st "Start"
    const secondsElapsed = Math.floor((now - startDate) / 1000);

    // Update the visual Countdown Timer
    if (timeLeft > 0) {
        const d = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const h_ = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((timeLeft % (1000 * 60)) / 1000);
        timerElement.innerText = `${d}D ${h_}H ${m}M ${s}S`;
    } else {
        timerElement.innerText = "0D 0H 0M 0S - HAPPY MARCH 1ST!";
    }

    // GRID MATH
    const cols = Math.ceil(Math.sqrt(totalSecondsInPuzzle * (w / h)));
    const rows = Math.ceil(totalSecondsInPuzzle / cols);
    
    const pieceWidth = w / cols;
    const pieceHeight = h / rows;

    // Draw pieces that have "unlocked"
    const limit = Math.min(secondsElapsed, pieces.length);
    
    // Draw unlocked pieces with full color
    for (let i = 0; i < limit; i++) {
        const idx = pieces[i];
        
        const screenX = (idx % cols) * pieceWidth;
        const screenY = Math.floor(idx / cols) * pieceHeight;

        const sourceX = (idx % cols) * (img.width / cols);
        const sourceY = Math.floor(idx / cols) * (img.height / rows);
        const sourceW = img.width / cols;
        const sourceH = img.height / rows;

        ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, screenX, screenY, pieceWidth, pieceHeight);
    }

    // GHOST EFFECT: Faint background image
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();

    requestAnimationFrame(render);
}

// 5. EVENT LISTENERS
img.onload = init;

function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);