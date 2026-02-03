const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const timerElement = document.getElementById('timer');

const img = new Image();
img.src = 'image1.png';

const targetDate = new Date("March 1, 2026 00:00:00 GMT-0600").getTime();
const startDate = new Date("February 1, 2026 00:00:00 GMT-0600").getTime();

let w, h, buildings = [], animStartTime, fireflies = [], smokeParticles = [];
let weatherData = { left: null, right: null };
let particles = {
    left: { rain: [], snow: [], clouds: [] },
    right: { rain: [], snow: [], clouds: [] }
};
// Puzzle variables
let pieces = [], revealProgress = 0;

const API_KEY = '1c95ffb7528eb9b09fb1d559e5d8465d';

async function fetchWeather() {
    try {
        // Left: Atlanta, GA
        const resLeft = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=33.7490&lon=-84.3880&appid=${API_KEY}`);
        const dataLeft = await resLeft.json();
        weatherData.left = processWeatherData(dataLeft);

        // Right: Valparaiso, IN
        const resRight = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=41.4731&lon=-87.0611&appid=${API_KEY}`);
        const dataRight = await resRight.json();
        weatherData.right = processWeatherData(dataRight);

    } catch (e) {
        console.log("Weather fetch error", e);
    }
}

function processWeatherData(data) {
    if (!data || !data.sys) return null;
    return {
        main: data.weather[0].main, // 'Rain', 'Snow', 'Clouds', 'Clear'
        sunrise: data.sys.sunrise * 1000,
        sunset: data.sys.sunset * 1000,
        dt: Date.now() // Current time for animation sync
    };
}

function init() {
    animStartTime = Date.now();
    fetchWeather();
    
    // Initialize Puzzle Pieces
    const grid = 10; // 10x10 grid for puzzle
    pieces = Array.from({ length: grid * grid }, (_, i) => i);
    // Shuffle pieces
    for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }

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

function drawSideEnvironment(side, x, y, width, height) {
    const data = weatherData[side];
    const pSystem = particles[side];
    
    // Default to night if no data yet
    const now = Date.now();
    const isDay = data ? (now > data.sunrise && now < data.sunset) : false;
    
    // 1. Sky Gradient
    const skyGrd = ctx.createLinearGradient(x, y, x, y + height);
    if (isDay) {
        skyGrd.addColorStop(0, '#87CEEB'); // Light Blue
        skyGrd.addColorStop(1, '#FFD700'); // Golden
    } else {
        skyGrd.addColorStop(0, '#000033'); // Navy
        skyGrd.addColorStop(1, '#000000'); // Black
    }
    ctx.fillStyle = skyGrd;
    ctx.fillRect(x, y, width, height);

    // 2. Celestial Body (Sun/Moon)
    if (data) {
        const celestialY = y + height * 0.2;
        let progress = 0;
        
        if (isDay) {
            // Sun Arc
            progress = (now - data.sunrise) / (data.sunset - data.sunrise);
            const sunX = x + (width * 0.1) + (width * 0.8 * progress);
            const sunY = celestialY + Math.sin(progress * Math.PI) * -50; // Arc up
            
            ctx.fillStyle = "#FDB813";
            ctx.shadowBlur = 20; ctx.shadowColor = "#FDB813";
            ctx.beginPath();
            ctx.arc(sunX, sunY, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            // Moon & Stars
            // Draw Stars
            ctx.fillStyle = "white";
            for(let i=0; i<50; i++) {
                const sx = x + Math.random() * width;
                const sy = y + Math.random() * (height * 0.6);
                ctx.globalAlpha = Math.random();
                ctx.beginPath(); ctx.arc(sx, sy, Math.random() * 1.5, 0, Math.PI*2); ctx.fill();
            }
            ctx.globalAlpha = 1;

            // Moon
            const moonX = x + width * 0.8;
            ctx.fillStyle = "#FEFCD7";
            ctx.shadowBlur = 15; ctx.shadowColor = "#FEFCD7";
            ctx.beginPath(); ctx.arc(moonX, celestialY, 25, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
        }

        // 3. Weather Effects
        // Clouds
        if (data.main === 'Clouds' || data.main === 'Rain' || data.main === 'Snow') {
            if (pSystem.clouds.length < 5) {
                pSystem.clouds.push({ x: x - 50, y: y + Math.random() * 100, w: 60 + Math.random()*40, speed: 0.5 + Math.random() });
            }
            ctx.fillStyle = "rgba(200, 200, 200, 0.4)";
            pSystem.clouds.forEach((c, i) => {
                c.x += c.speed;
                if (c.x > x + width) c.x = x - 100;
                ctx.beginPath(); ctx.arc(c.x, c.y, c.w/2, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(c.x + 20, c.y - 10, c.w/2, 0, Math.PI*2); ctx.fill();
            });
        }

        // Rain
        if (data.main === 'Rain') {
            if (pSystem.rain.length < 100) pSystem.rain.push({ x: x + Math.random()*width, y: y + Math.random()*height, l: 10+Math.random()*10, v: 10+Math.random()*5 });
            ctx.strokeStyle = "rgba(174, 194, 224, 0.6)"; ctx.lineWidth = 1;
            pSystem.rain.forEach(r => {
                r.y += r.v; if (r.y > y + height) r.y = y - 20;
                ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x, r.y + r.l); ctx.stroke();
            });
        }

        // Snow
        if (data.main === 'Snow') {
            if (pSystem.snow.length < 50) pSystem.snow.push({ x: x + Math.random()*width, y: y + Math.random()*height, r: 2+Math.random()*2, v: 1+Math.random() });
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            pSystem.snow.forEach(s => {
                s.y += s.v; s.x += Math.sin(Date.now()*0.001)*0.5;
                if (s.y > y + height) s.y = y - 10;
                ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
            });
        }
    }
}

function drawCinematicEnvironment(progress) {
    const dividerX = w / 2;
    const groundLevel = h - 100;

    // 4. Moving City (Left Side)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, dividerX, h);
    ctx.clip();
    
    // Draw Left Environment (Atlanta)
    drawSideEnvironment('left', 0, 0, dividerX, h);

    const dataLeft = weatherData.left;
    const isNightLeft = dataLeft ? (Date.now() < dataLeft.sunrise || Date.now() > dataLeft.sunset) : true;

    buildings.forEach(b => {
        ctx.fillStyle = b.color;
        const groundY = h - b.h;

        // Draw building based on its type
        switch (b.type) {
            case 'stepped':
                ctx.fillRect(b.x, groundY, b.w, b.h);
                const topHeight = b.h * 0.4;
                const topWidth = b.w * 0.6;
                ctx.fillRect(b.x + (b.w - topWidth) / 2, groundY - topHeight, topWidth, topHeight);
                break;
            case 'spire':
                ctx.fillRect(b.x, groundY, b.w, b.h);
                ctx.beginPath();
                ctx.moveTo(b.x, groundY);
                ctx.lineTo(b.x + b.w / 2, groundY - 50);
                ctx.lineTo(b.x + b.w, groundY);
                ctx.closePath();
                ctx.fill();
                break;
            default: // 'rect'
                ctx.fillRect(b.x, groundY, b.w, b.h);
                break;
        }
        
        // Draw Windows if it's night
        if (isNightLeft) {
            ctx.fillStyle = "rgba(255, 220, 150, 0.7)"; // Warm yellow glow
            b.windows.forEach(win => {
                ctx.fillRect(b.x + win.x, groundY + win.y, 4, 6);
            });
        }

        b.x -= 0.5; // Parallax speed
        if (b.x + b.w < 0) b.x = w;
    });
    ctx.restore();

    // 4.5 Static Countryside (Right Side)
    ctx.save();
    ctx.beginPath();
    ctx.rect(dividerX, 0, w - dividerX, h);
    ctx.clip();

    // Draw Right Environment (Valparaiso)
    drawSideEnvironment('right', dividerX, 0, w - dividerX, h);

    // Draw House
    const houseX = w * 0.75;
    const houseY = groundLevel;
    
    // House Body
    ctx.fillStyle = "#263238";
    ctx.fillRect(houseX, houseY - 120, 120, 120); // Bigger body
    
    // Chimney & Smoke
    ctx.fillStyle = "#1c2327";
    ctx.fillRect(houseX + 85, houseY - 160, 15, 40);
    if (Math.random() < 0.03) {
        smokeParticles.push({ x: houseX + 92, y: houseY - 160, vx: (Math.random() - 0.5) * 0.5, vy: -1 - Math.random(), life: 1, size: 3 });
    }
    ctx.fillStyle = "rgba(200, 200, 200, 0.4)";
    for(let i = smokeParticles.length - 1; i >= 0; i--) {
        let p = smokeParticles[i];
        p.x += p.vx + 0.2; p.y += p.vy; p.size += 0.05; p.life -= 0.005;
        if(p.life <= 0) smokeParticles.splice(i, 1);
        else {
            ctx.globalAlpha = p.life;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        }
    }
    ctx.globalAlpha = 1;

    // Roof
    ctx.beginPath(); 
    ctx.moveTo(houseX - 10, houseY - 120); 
    ctx.lineTo(houseX + 60, houseY - 170); // Higher peak for bigger roof
    ctx.lineTo(houseX + 130, houseY - 120); 
    ctx.fillStyle = "#37474f"; 
    ctx.fill();
    // Lit Window
    ctx.fillStyle = "rgba(255, 235, 59, 0.5)"; 
    ctx.fillRect(houseX + 40, houseY - 70, 25, 25);

    // Draw Tree
    const treeX = w * 0.9;
    const treeY = groundLevel;
    
    // Trunk
    ctx.fillStyle = "#3e2723";
    ctx.fillRect(treeX, treeY - 150, 25, 150); // Taller and fatter trunk
    
    // Leaves
    ctx.fillStyle = "#1b5e20";
    ctx.beginPath();
    ctx.arc(treeX + 12, treeY - 160, 60, 0, Math.PI * 2); // Main large canopy
    ctx.arc(treeX - 30, treeY - 140, 40, 0, Math.PI * 2); // Left cluster
    ctx.arc(treeX + 50, treeY - 130, 45, 0, Math.PI * 2); // Right cluster
    ctx.arc(treeX + 15, treeY - 110, 35, 0, Math.PI * 2); // Bottom cluster
    ctx.fill();

    // Tree Flowers
    ctx.fillStyle = "#f48fb1";
    [{x:10,y:-170}, {x:-20,y:-150}, {x:40,y:-140}, {x:20,y:-120}, {x:-5, y:-200}].forEach(p => {
        ctx.beginPath(); ctx.arc(treeX + 12 + p.x, treeY + p.y, 4, 0, Math.PI*2); ctx.fill();
    });

    // Fireflies
    ctx.fillStyle = "#ffeb3b";
    const time = Date.now();
    fireflies.forEach(f => {
        const fx = treeX + f.offsetX + Math.sin(time * f.speed + f.phase) * 20;
        const fy = treeY + f.offsetY + Math.cos(time * f.speed + f.phase) * 10;
        const alpha = 0.5 + Math.sin(time * 0.005 + f.phase) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

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
    const now = Date.now();
    let maleWalkCycle = 0;
    if (now - animStartTime > 2000) {
        maleWalkCycle = (now - (animStartTime + 2000)) * 0.006;
    }

    const startGap = w * 0.8, endGap = 80;
    const currentGap = startGap - (startGap - endGap) * progress;
    drawCharacterSilhouette(dividerX - currentGap / 2, groundLevel, 0.8, true, maleWalkCycle);
    drawCharacterSilhouette(dividerX + currentGap / 2, groundLevel, 0.8, false, 0);
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
        // --- PHASE 2: PUZZLE REVEAL ---
        if (timerElement.style.opacity !== "0") {
            timerElement.style.opacity = "0";
        }
        
        // Random Puzzle Reveal
        const grid = 10;
        revealProgress += 0.5; // Speed of reveal
        const limit = Math.min(Math.floor(revealProgress), pieces.length);

        for (let i = 0; i < limit; i++) {
            const idx = pieces[i];
            const sx = (idx % grid) * (img.width / grid);
            const sy = Math.floor(idx / grid) * (img.height / grid);
            const dx = (idx % grid) * (w / grid);
            const dy = Math.floor(idx / grid) * (h / grid);
            ctx.drawImage(img, sx, sy, img.width/grid, img.height/grid, dx, dy, w/grid, h/grid);
        }
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
        const color = `hsl(230, 20%, ${10 + Math.random() * 15}%)`; // Dark blue/purple/grey tones

        const typeRoll = Math.random();
        let type;
        if (typeRoll < 0.6) {
            type = 'rect'; // 60% chance for a standard rectangle
        } else if (typeRoll < 0.85) {
            type = 'stepped'; // 25% chance for a stepped building
        } else {
            type = 'spire'; // 15% chance for a building with a spire
        }

        return { x: Math.random() * w, h: bH, w: bW, windows: wins, color: color, type: type };
    });

    // Fireflies
    fireflies = Array.from({ length: 15 }, () => ({
        offsetX: (Math.random() - 0.5) * 100,
        offsetY: -100 + (Math.random() - 0.5) * 50,
        phase: Math.random() * Math.PI * 2,
        speed: 0.002 + Math.random() * 0.002
    }));
}