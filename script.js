const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const timerElement = document.getElementById('timer');

const img = new Image();
img.src = 'image1.png';

const targetDate = new Date("March 1, 2026 00:00:00 GMT-0600").getTime();
const startDate = new Date("February 1, 2026 00:00:00 GMT-0600").getTime();

let w, h, buildings = [], stars = [];

function init() {
    resize(); // Set initial sizes and create dimension-dependent assets
    animate();

    // Start a smooth fade-out for the splash screen.
    // This is better than just hiding it, as it ensures the animation is ready.
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) {
            splash.style.opacity = '0';
            // After the fade-out transition ends, remove the element completely.
            splash.addEventListener('transitionend', () => splash.remove());
        }
    }, 4000);
}

function drawCinematicEnvironment(progress) {
    // 1. Sky
    const skyGrd = ctx.createLinearGradient(0, 0, 0, h);
    skyGrd.addColorStop(0, '#1a1a2e');
    skyGrd.addColorStop(0.5, '#4a1e4d');
    skyGrd.addColorStop(1, '#ff85a2');
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, w, h);

    // 2. Stars
    ctx.fillStyle = "white";
    stars.forEach(s => {
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.001 + s.x) * 0.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        s.x -= s.speed;
        if (s.x < 0) s.x = w;
    });
    ctx.globalAlpha = 1;

    const dividerX = w / 2;
    const groundLevel = h - 100;

    // 4. Moving City (Left Side)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, dividerX, h);
    ctx.clip();
    buildings.forEach(b => {
        ctx.fillStyle = "#08080a";
        ctx.fillRect(b.x, h - b.h, b.w, b.h);
        // Draw Windows
        ctx.fillStyle = "rgba(255, 255, 200, 0.1)"; // Faint yellow light
        b.windows.forEach(win => ctx.fillRect(b.x + win.x, h - b.h + win.y, 6, 8));
        b.x -= 0.5; // Parallax speed
        if (b.x + b.w < 0) b.x = w;
    });
    ctx.restore();

    // 5. Ground Gradient
    const groundGrd = ctx.createLinearGradient(0, groundLevel, 0, h);
    groundGrd.addColorStop(0, '#050508');
    groundGrd.addColorStop(1, '#000');
    ctx.fillStyle = groundGrd;
    ctx.fillRect(0, groundLevel, w, h);

    // 6. Divider Line
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(dividerX, 0); ctx.lineTo(dividerX, h); ctx.stroke();

    // 7. Characters
    const walkCycle = Date.now() * 0.006; // Slightly faster for better rhythm
    const startGap = w * 0.4, endGap = 80;
    const currentGap = startGap - (startGap - endGap) * progress;
    drawCharacterSilhouette(dividerX - currentGap / 2, groundLevel, 1.6, true, walkCycle);
    drawCharacterSilhouette(dividerX + currentGap / 2, groundLevel, 1.6, false, walkCycle);
}

function animate() {
    const now = Date.now();
    const timeLeft = targetDate - now;

    // Safeguard: Always clear the canvas to black first.
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, w, h);

    if (timeLeft > 0) {
        // --- PHASE 1: CINEMATIC SCENE ---
        const totalDuration = targetDate - startDate;
        const progress = Math.min(1, Math.max(0, 1 - (timeLeft / totalDuration)));
        drawCinematicEnvironment(progress);

        const d = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const h_ = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((timeLeft % (1000 * 60)) / 1000);
        const pad = (num) => String(num).padStart(2, '0');
        timerElement.innerText = `${d} : ${pad(h_)} : ${pad(m)} : ${pad(s)}`;

    } else {
        // --- PHASE 2: PHOTO REVEAL ---
        if (timerElement.style.opacity !== "0") {
            timerElement.style.opacity = "0";
        }
        ctx.drawImage(img, 0, 0, w, h);
    }
    requestAnimationFrame(animate);
}

function drawCharacterSilhouette(x, y, scale, isMale, walkCycle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * (isMale ? 1 : -1), scale);

    // Animation Math
    const legSwing = Math.sin(walkCycle) * 0.5;
    const armSwing = Math.sin(walkCycle + Math.PI) * 0.5;
    const bob = Math.abs(Math.sin(walkCycle * 2)) * 2;

    ctx.translate(0, -bob);
    ctx.fillStyle = 'black';

    // Helper to draw a simple limb
    const drawLimb = (angle, w, h, x, y) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillRect(-w / 2, 0, w, h);
        ctx.restore();
    };

    // Back Limbs
    drawLimb(-legSwing, 8, 45, 0, -45); // Back Leg
    drawLimb(-armSwing, 7, 38, 0, -85); // Back Arm

    // Torso
    if (isMale) {
        ctx.fillRect(-12, -90, 24, 50);
    } else {
        ctx.beginPath();
        ctx.moveTo(-10, -90); ctx.lineTo(10, -90);
        ctx.lineTo(15, -45); ctx.lineTo(-15, -45);
        ctx.fill();
    }

    // Head
    ctx.beginPath();
    ctx.arc(0, -100, 12, 0, Math.PI * 2);
    ctx.fill();

    // Front Limbs
    drawLimb(legSwing, 8, 45, 0, -45); // Front Leg
    drawLimb(armSwing, 7, 38, 0, -85); // Front Arm

    ctx.restore();
}

img.onload = init;
window.addEventListener('resize', resize);
function resize() { 
    w = canvas.width = window.innerWidth; 
    h = canvas.height = window.innerHeight; 

    // Re-create dimension-dependent assets
    stars = Array.from({ length: 200 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h * 0.7,
        size: Math.random() * 1.5,
        speed: 0.1 + Math.random() * 0.2
    }));
    buildings = Array.from({ length: 100 }, () => {
        const bH = 100 + Math.random() * (h * 0.4);
        const bW = 40 + Math.random() * 80;
        const wins = [];
        // Generate windows
        for(let y = 20; y < bH - 20; y += 20) {
            for(let x = 10; x < bW - 10; x += 15) {
                if(Math.random() > 0.7) wins.push({x, y});
            }
        }
        return { x: Math.random() * w, h: bH, w: bW, windows: wins };
    });
}