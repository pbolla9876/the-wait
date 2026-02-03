const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d', { alpha: false }); // Optimized for performance
const timerElement = document.getElementById('timer');

const img = new Image();
img.src = 'image1.png'; // Make sure your image is named exactly this

// --- CONFIGURATION ---
// Set target to March 1st, 2026 00:00:00 CST
const targetDate = new Date("March 1, 2026 00:00:00 GMT-0600").getTime();
// The "Now" moment when the puzzle logic begins
const startTime = Date.now();
const totalSecondsInPuzzle = Math.floor((targetDate - startTime) / 1000);

let w, h;
let pieces = [];
let isReady = false;

function init() {
    resize();
    
    // Create an array representing every second as a unique piece index
    pieces = Array.from({ length: totalSecondsInPuzzle }, (_, i) => i);
    
    // Shuffle the pieces array so they appear randomly across the photo
    for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    
    isReady = true;
    animate();
}

function animate() {
    if (!isReady) return;

    // Background stays black
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    
    const now = Date.now();
    const timeLeft = targetDate - now;
    const secondsPassed = Math.floor((now - startTime) / 1000);

    // Update Countdown Text
    if (timeLeft > 0) {
        const d = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const h_ = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((timeLeft % (1000 * 60)) / 1000);
        timerElement.innerText = `${d}D ${h_}H ${m}M ${s}S`;
    } else {
        timerElement.innerText = "0D 0H 0M 0S";
    }

    // Puzzle Grid Math
    // We create a grid where the number of cells = totalSecondsInPuzzle
    const aspectRatio = w / h;
    const cols = Math.ceil(Math.sqrt(totalSecondsInPuzzle * aspectRatio));
    const rows = Math.ceil(totalSecondsInPuzzle / cols);
    
    const pW = w / cols;
    const pH = h / rows;

    // Draw pieces that have been "earned" by passing seconds
    const piecesToDraw = Math.min(secondsPassed, pieces.length);
    
    for (let i = 0; i < piecesToDraw; i++) {
        const idx = pieces[i];
        
        // Target coordinates on screen
        const dx = (idx % cols) * pW;
        const dy = Math.floor(idx / cols) * pH;

        // Source coordinates from the image
        const sx = (idx % cols) * (img.width / cols);
        const sy = Math.floor(idx / cols) * (img.height / rows);
        const sW = img.width / cols;
        const sH = img.height / rows;

        ctx.drawImage(img, sx, sy, sW, sH, dx, dy, pW, pH);
    }

    // Optional: Extremely faint "ghost" image (3% opacity) 
    // This helps visualize the framing before it fills in
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();

    requestAnimationFrame(animate);
}

// Ensure image loads before starting
img.onload = init;
img.onerror = () => {
    timerElement.innerText = "Error: File Not Found";
};

window.addEventListener('resize', () => {
    resize();
});

function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
}