const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const timerElement = document.getElementById('timer');

const img = new Image();
img.src = 'image1.png';

const targetDate = new Date("March 1, 2026 00:00:00 GMT-0600").getTime();
const startDate = new Date("February 1, 2026 00:00:00 GMT-0600").getTime();

let w, h, buildings = [], stars = [], clouds = [], animStartTime, fireflies = [], smokeParticles = [], timeOfDay, rainParticles = [], snowParticles = [], weatherCode = 0;

function getSkyColors() {
    // Get time specifically for Valparaiso, Indiana (America/Chicago)
    let hour = new Date().getHours();
    try {
        const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false });
        hour = parseInt(formatter.format(new Date()));
    } catch (e) { console.error("Timezone error", e); }

    // Default to Night
    let colors = { sky: ['#000033', '#0c0c4a', '#1a1a2e'], showCelestial: true };

    if (hour >= 5 && hour < 10) { // Morning
        colors = { sky: ['#87CEEB', '#f0e68c', '#FFFFFF'], showCelestial: false };
    } else if (hour >= 10 && hour < 17) { // Afternoon
        colors = { sky: ['#00BFFF', '#87CEFA', '#FFFFFF'], showCelestial: false };
    } else if (hour >= 17 && hour < 21) { // Evening/Sunset
        colors = { sky: ['#1a1a2e', '#4a1e4d', '#ff85a2'], showCelestial: true };
    }
    return colors;
}

async function fetchWeather() {
    try {
        // Fetch weather for Valparaiso, IN (Lat: 41.4731, Long: -87.0611)
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=41.4731&longitude=-87.0611&current=weather_code&timezone=America%2FChicago');
        const data = await res.json();
        if (data.current) {
            weatherCode = data.current.weather_code;
        }
    } catch (e) {
        console.log("Weather fetch error", e);
    }
}

function init() {
    animStartTime = Date.now();
    timeOfDay = getSkyColors();
    fetchWeather();
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
    skyGrd.addColorStop(0, timeOfDay.sky[0]);
    skyGrd.addColorStop(0.5, timeOfDay.sky[1]);
    skyGrd.addColorStop(1, timeOfDay.sky[2]);
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, w, h);

    // 1.5 Clouds (Daytime only)
    if (!timeOfDay.showCelestial) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        clouds.forEach(c => {
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
            ctx.arc(c.x + c.size * 0.7, c.y - c.size * 0.4, c.size * 0.8, 0, Math.PI * 2);
            ctx.arc(c.x + c.size * 1.4, c.y, c.size * 0.6, 0, Math.PI * 2);
            ctx.fill();
            c.x += c.speed;
            if (c.x > w + 100) c.x = -100;
        });
    }

    // 2. Stars
    if (timeOfDay.showCelestial) {
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
    }

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
        if (timeOfDay.showCelestial) {
            ctx.fillStyle = "rgba(255, 255, 200, 0.1)"; // Faint yellow light
            b.windows.forEach(win => ctx.fillRect(b.x + win.x, h - b.h + win.y, 6, 8));
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

    // Draw House
    const houseX = w * 0.65;
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
    if (timeOfDay.showCelestial) {
        ctx.fillStyle = "rgba(255, 235, 59, 0.5)"; 
        ctx.fillRect(houseX + 40, houseY - 70, 25, 25); // Bigger, repositioned window
    }

    // Draw Tree
    const treeX = w * 0.85;
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
    if (timeOfDay.showCelestial) {
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
    }

    // Rain Effect (Only on Female Side / Right Side)
    // WMO Weather Codes for Rain: 51-67, 80-82, 95-99
    const isRaining = (weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82) || (weatherCode >= 95 && weatherCode <= 99);
    
    if (isRaining) {
        ctx.strokeStyle = "rgba(174, 194, 224, 0.6)";
        ctx.lineWidth = 1.5;
        
        // Maintain rain particles
        if (rainParticles.length < 150) {
            rainParticles.push({
                x: dividerX + Math.random() * (w - dividerX), // Constrain to right side
                y: Math.random() * h,
                speed: 15 + Math.random() * 10,
                len: 10 + Math.random() * 15
            });
        }

        rainParticles.forEach(p => {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + p.len); ctx.stroke();
            p.y += p.speed;
            // Reset to top if it falls off screen
            if (p.y > h) {
                p.y = -p.len;
                p.x = dividerX + Math.random() * (w - dividerX);
            }
        });
    }

    // Snow Effect (Only on Female Side / Right Side)
    // WMO Weather Codes for Snow: 71, 73, 75, 77, 85, 86
    const isSnowing = (weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86);

    if (isSnowing) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        
        if (snowParticles.length < 100) {
            snowParticles.push({
                x: dividerX + Math.random() * (w - dividerX),
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 1,
                vy: 1 + Math.random() * 2,
                size: 1 + Math.random() * 2
            });
        }

        snowParticles.forEach(p => {
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            p.x += p.vx; p.y += p.vy;
            if (p.y > h) { p.y = -5; p.x = dividerX + Math.random() * (w - dividerX); }
            if (p.x > w) p.x = dividerX; if (p.x < dividerX) p.x = w;
        });
    }

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

    const startGap = w * 0.4, endGap = 80;
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

    // Fireflies
    fireflies = Array.from({ length: 15 }, () => ({
        offsetX: (Math.random() - 0.5) * 100,
        offsetY: -100 + (Math.random() - 0.5) * 50,
        phase: Math.random() * Math.PI * 2,
        speed: 0.002 + Math.random() * 0.002
    }));

    // Clouds
    clouds = Array.from({ length: 8 }, () => ({
        x: Math.random() * w,
        y: Math.random() * (h * 0.3),
        size: 20 + Math.random() * 30,
        speed: 0.2 + Math.random() * 0.3
    }));
}