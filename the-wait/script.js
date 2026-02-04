const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const timerElement = document.getElementById('timer');

const img = new Image();
img.src = 'image1.png';

const targetDate = new Date("March 1, 2026 00:00:00 GMT-0600").getTime();
const startDate = new Date("February 1, 2026 00:00:00 GMT-0600").getTime();

let w, h, buildings = [], fireflies = [], smokeParticles = [];
let weatherData = { left: null, right: null };
let particles = {
    left: { rain: [], snow: [], clouds: [] },
    right: { rain: [], snow: [], clouds: [] }
};

// --- State Machine Variables ---
let gameState = 'INTRO_TEXT';
let animStartTime;

const introLines = [
    "I'm tired of saying goodnight to a screen.",
    "I miss the small things... like just being in the same room as you.",
    "Every day feels like a placeholder until I can finally see you again.",
    "This timer isn't just counting down days...",
    "It’s counting down until I can finally hold your hand for real."
];
let introState = { lineIndex: 0, alpha: 0, phase: 'in', lastUpdate: 0 };
let sceneBuildupState = { sky: 0, ground: 0, chars: 0 };
let pieces = [], revealProgress = 0;

const API_KEY = typeof CONFIG !== 'undefined' ? CONFIG.WEATHER_API_KEY : '';

// --- Color Interpolation Helper ---
function interpolateColor(c1, c2, factor) {
    const r1 = parseInt(c1.slice(1, 3), 16);
    const g1 = parseInt(c1.slice(3, 5), 16);
    const b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16);
    const g2 = parseInt(c2.slice(3, 5), 16);
    const b2 = parseInt(c2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);
    return `rgb(${r},${g},${b})`;
}

async function fetchWeather() {
    if (!API_KEY) return;
    try {
        const resLeft = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=33.7490&lon=-84.3880&appid=${API_KEY}`);
        weatherData.left = processWeatherData(await resLeft.json());
        const resRight = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=41.4731&lon=-87.0611&appid=${API_KEY}`);
        weatherData.right = processWeatherData(await resRight.json());
    } catch (e) { console.log("Weather fetch error", e); }
}

function processWeatherData(data) {
    if (!data || !data.sys) return null;
    return {
        main: data.weather[0].main,
        sunrise: data.sys.sunrise * 1000,
        sunset: data.sys.sunset * 1000
    };
}

function drawSideEnvironment(side, x, y, width, height) {
    const data = weatherData[side];
    const pSystem = particles[side];
    const now = Date.now();
    
    // 1. Calculate Sun/Moon Timing
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    let sunrise = data && data.sunrise ? data.sunrise : todayStart.getTime() + 6 * 3600 * 1000;
    let sunset = data && data.sunset ? data.sunset : todayStart.getTime() + 18 * 3600 * 1000;

    // 2. Day Factor Calculation (0=Night, 1=Day)
    const transitionDuration = 3600000 * 1.5; 
    let dayFactor = 0;
    if (now >= sunrise - transitionDuration/2 && now <= sunrise + transitionDuration/2) {
        dayFactor = (now - (sunrise - transitionDuration/2)) / transitionDuration;
    } else if (now > sunrise + transitionDuration/2 && now < sunset - transitionDuration/2) {
        dayFactor = 1;
    } else if (now >= sunset - transitionDuration/2 && now <= sunset + transitionDuration/2) {
        dayFactor = 1 - (now - (sunset - transitionDuration/2)) / transitionDuration;
    } else if (now > sunrise && now < sunset) {
        dayFactor = 1;
    }
    dayFactor = Math.max(0, Math.min(1, dayFactor));

    // 3. Sky Rendering
    const cTop = interpolateColor("#020205", "#87CEEB", dayFactor);
    const cBot = interpolateColor("#000000", "#FFD700", dayFactor);
    const skyGrd = ctx.createLinearGradient(x, y, x, y + height);
    skyGrd.addColorStop(0, cTop);
    skyGrd.addColorStop(1, cBot);
    ctx.fillStyle = skyGrd;
    ctx.fillRect(x, y, width, height);

    const celestialY = y + height * 0.2;

    // 4. Night Elements (Stars/Moon) - Fade out as dayFactor increases
    if (dayFactor < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - dayFactor;
        ctx.fillStyle = "white";
        for(let i=0; i<30; i++) {
            const sx = x + (Math.sin(i*10) * 0.5 + 0.5) * width;
            const sy = y + (Math.cos(i*10) * 0.5 + 0.5) * (height * 0.5);
            ctx.beginPath(); ctx.arc(sx, sy, 1, 0, Math.PI*2); ctx.fill();
        }
        const moonX = x + width * 0.8; 
        ctx.fillStyle = "#FEFCD7";
        ctx.shadowBlur = 15; ctx.shadowColor = "#FEFCD7";
        ctx.beginPath(); ctx.arc(moonX, celestialY, 25, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    // 5. Day Elements (Sun) - Fade in and Arc
    if (dayFactor > 0) {
        ctx.save();
        ctx.globalAlpha = dayFactor;
        const progress = Math.max(0, Math.min(1, (now - sunrise) / (sunset - sunrise)));
        const sunX = x + (width * 0.1) + (width * 0.8 * progress);
        const sunY = celestialY + Math.sin(progress * Math.PI) * -80;
        ctx.fillStyle = "#FDB813";
        ctx.shadowBlur = 20; ctx.shadowColor = "#FDB813";
        ctx.beginPath(); ctx.arc(sunX, sunY, 30, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // 6. Weather Overlays
    if (data) {
        if (data.main === 'Clouds' || data.main === 'Rain' || data.main === 'Snow') {
            if (pSystem.clouds.length < 4) {
                pSystem.clouds.push({ x: x - 100, y: y + Math.random() * 100, w: 80, speed: 0.2 });
            }
            ctx.fillStyle = "rgba(200, 200, 200, 0.4)";
            pSystem.clouds.forEach(c => {
                c.x += c.speed;
                if (c.x - c.w > x + width) c.x = x - c.w;
                ctx.beginPath(); ctx.arc(c.x, c.y, 30, 0, Math.PI*2); ctx.fill();
            });
        }
        if (data.main === 'Rain') {
            if (pSystem.rain.length < 60) pSystem.rain.push({ x: x + Math.random()*width, y: Math.random()*h, v: 8 });
            ctx.strokeStyle = "rgba(174, 194, 224, 0.5)";
            pSystem.rain.forEach(r => {
                r.y += r.v; if (r.y > h) r.y = -20;
                ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x, r.y+10); ctx.stroke();
            });
        }
    }
}

function drawSky() {
    const dividerX = w/2;
    ctx.save(); ctx.beginPath(); ctx.rect(0,0,dividerX,h); ctx.clip();
    drawSideEnvironment('left', 0, 0, dividerX, h); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(dividerX,0,w-dividerX,h); ctx.clip();
    drawSideEnvironment('right', dividerX, 0, w - dividerX, h); ctx.restore();
}

function updateSmoke(x, y) {
    if (Math.random() < 0.03) {
        smokeParticles.push({ x: x, y: y, vx: (Math.random()-0.5)*0.5, vy: -1.2, life: 1, size: 3 });
    }
    for(let i = smokeParticles.length - 1; i >= 0; i--) {
        let p = smokeParticles[i];
        p.x += p.vx + 0.2; p.y += p.vy; p.size += 0.05; p.life -= 0.005;
        if(p.life <= 0) smokeParticles.splice(i, 1);
        else {
            ctx.fillStyle = `rgba(200, 200, 200, ${p.life*0.4})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        }
    }
}

function updateFireflies(baseX, baseY) {
    const time = Date.now();
    fireflies.forEach(f => {
        const fx = baseX + f.offsetX + Math.sin(time * f.speed + f.phase) * 20;
        const fy = baseY + f.offsetY + Math.cos(time * f.speed + f.phase) * 10;
        ctx.fillStyle = `rgba(255, 235, 59, ${0.5 + Math.sin(time*0.005+f.phase)*0.5})`;
        ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI*2); ctx.fill();
    });
}

function drawGroundElements() {
    const dividerX = w / 2;
    const groundLevel = h - 100;
    const now = Date.now();
    
    // Determine if building lights should be on (only during transition/night)
    const currentHour = new Date().getHours();
    let isNight = (currentHour < 6 || currentHour >= 18);

    // Draw Buildings
    ctx.save(); ctx.beginPath(); ctx.rect(0,0,dividerX,h); ctx.clip();
    buildings.forEach(b => {
        ctx.fillStyle = b.color;
        const groundY = h - b.h;
        ctx.fillRect(b.x, groundY, b.w, b.h);
        if (isNight) {
            ctx.fillStyle = "rgba(255, 220, 150, 0.7)";
            b.windows.forEach(win => ctx.fillRect(b.x + win.x, groundY + win.y, 4, 6));
        }
        b.x -= 0.5; if (b.x + b.w < 0) b.x = w;
    });
    ctx.restore();

    // Draw House & Tree (Right Side)
    const houseX = w * 0.75;
    ctx.fillStyle = "#263238"; ctx.fillRect(houseX, groundLevel - 120, 120, 120);
    
    // Street Lamp
    const lampX = houseX - 50;
    ctx.fillStyle = "#1c2327"; ctx.fillRect(lampX, groundLevel - 140, 4, 140); // Pole
    ctx.beginPath(); ctx.moveTo(lampX-10, groundLevel-140); ctx.lineTo(lampX+14, groundLevel-140); 
    ctx.lineTo(lampX+18, groundLevel-130); ctx.lineTo(lampX-6, groundLevel-130); ctx.fill(); // Lamp head
    
    if (isNight) {
        ctx.save();
        ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 20; ctx.fillStyle = "#FFFFE0";
        ctx.beginPath(); ctx.arc(lampX+4, groundLevel-132, 6, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        const grad = ctx.createRadialGradient(lampX+4, groundLevel-132, 0, lampX+4, groundLevel, 120);
        grad.addColorStop(0, "rgba(255, 215, 0, 0.2)"); grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.moveTo(lampX+4, groundLevel-132); ctx.lineTo(lampX-40, groundLevel); ctx.lineTo(lampX+50, groundLevel); ctx.fill();
    } else {
        ctx.fillStyle = "#CCCCCC"; ctx.beginPath(); ctx.arc(lampX+4, groundLevel-132, 5, 0, Math.PI*2); ctx.fill();
    }

    ctx.fillStyle = "#1c2327"; ctx.fillRect(houseX + 85, groundLevel - 160, 15, 40);
    updateSmoke(houseX + 92, groundLevel - 160);
    ctx.beginPath(); ctx.moveTo(houseX-10, groundLevel-120); ctx.lineTo(houseX+60, groundLevel-170); ctx.lineTo(houseX+130, groundLevel-120);
    ctx.fillStyle = "#37474f"; ctx.fill();

    const treeX = w * 0.9;
    ctx.fillStyle = "#3e2723"; ctx.fillRect(treeX, groundLevel - 150, 25, 150);
    ctx.fillStyle = "#1b5e20"; ctx.beginPath(); ctx.arc(treeX+12, groundLevel-160, 60, 0, Math.PI*2); ctx.fill();
    updateFireflies(treeX, groundLevel);

    // Ground
    ctx.fillStyle = "#050508"; ctx.fillRect(0, groundLevel, w, 100);
    ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.beginPath(); ctx.moveTo(dividerX, 0); ctx.lineTo(dividerX, h); ctx.stroke();
}

function drawCharacterSilhouette(x, y, scale, isMale, walkCycle) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale * (isMale ? 1 : -1), scale);
    const legSwing = Math.sin(walkCycle) * 0.5;
    const bob = Math.abs(Math.sin(walkCycle * 2)) * 2;
    ctx.translate(0, -bob); 
    
    const currentHour = new Date().getHours();
    const isNight = (currentHour < 6 || currentHour >= 18);
    if (isNight && !isMale) {
        ctx.fillStyle = "#333"; 
        ctx.shadowColor = "rgba(255, 255, 200, 0.5)"; ctx.shadowBlur = 10;
    } else {
        ctx.fillStyle = 'black';
    }
    
    // Draw Legs
    ctx.save(); ctx.translate(0, -45); ctx.rotate(legSwing); ctx.fillRect(-4, 0, 8, 45); ctx.restore();
    ctx.save(); ctx.translate(0, -45); ctx.rotate(-legSwing); ctx.fillRect(-4, 0, 8, 45); ctx.restore();
    
    // Body & Head
    if (isMale) ctx.fillRect(-12, -90, 24, 50);
    else { ctx.beginPath(); ctx.moveTo(-10,-90); ctx.lineTo(10,-90); ctx.lineTo(15,-45); ctx.lineTo(-15,-45); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, -100, 12, 0, Math.PI*2); ctx.fill();
    ctx.restore();
}

function drawCharacters(progress) {
    const dividerX = w / 2;
    const walkCycle = (Date.now() - animStartTime) * 0.006;
    const currentGap = (w * 0.8) - (w * 0.8 - 80) * progress;
    drawCharacterSilhouette(dividerX - currentGap / 2, h - 100, 0.8, true, walkCycle);
    drawCharacterSilhouette(dividerX + currentGap / 2, h - 100, 0.8, false, 0);
}

function drawLockAndTimer(progress) {
    const lockX = w / 2, lockY = 100;
    ctx.save(); ctx.fillStyle = '#FFD700'; ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 4;
    ctx.beginPath(); 
    if (progress < 1) ctx.arc(lockX, lockY, 15, Math.PI, 0); 
    else { ctx.save(); ctx.translate(lockX-15, lockY); ctx.rotate(-Math.PI/4); ctx.arc(15, 0, 15, Math.PI, 0); ctx.restore(); }
    ctx.stroke();
    ctx.beginPath(); const body = new Path2D(); body.roundRect(lockX-22, lockY, 44, 30, 5); ctx.fill(body);
    ctx.restore();
}

function handleIntroText() {
    const now = Date.now();
    ctx.fillStyle = 'black'; ctx.fillRect(0, 0, w, h);
    if (introState.phase === 'in') {
        introState.alpha = Math.min(1, introState.alpha + 0.008);
        if (introState.alpha >= 1) { introState.phase = 'pause'; introState.lastUpdate = now; }
    } else if (introState.phase === 'pause' && now - introState.lastUpdate > 2000) {
        if (introState.lineIndex < introLines.length - 1) {
            introState.lineIndex++; introState.alpha = 0; introState.phase = 'in';
        } else { gameState = 'SCENE_BUILDUP'; animStartTime = now; }
    }
    ctx.font = "italic 24px Georgia"; ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255, 255, 255, ${introState.alpha})`;
    ctx.fillText(introLines[introState.lineIndex], w/2, h/2);
}

function handleSceneBuildup() {
    const elapsed = Date.now() - animStartTime;
    sceneBuildupState.sky = Math.min(1, elapsed / 1000);
    sceneBuildupState.ground = Math.min(1, Math.max(0, (elapsed - 1000) / 1000));
    sceneBuildupState.chars = Math.min(1, Math.max(0, (elapsed - 2000) / 1000));
    if (elapsed > 3500) { gameState = 'JOURNEY'; animStartTime = Date.now(); }
    ctx.globalAlpha = sceneBuildupState.sky; drawSky();
    ctx.globalAlpha = sceneBuildupState.ground; drawGroundElements();
    ctx.globalAlpha = sceneBuildupState.chars; drawCharacters(0);
    ctx.globalAlpha = 1;
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playExplosionSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

function createFirework(x, y) {
    playExplosionSound();
    const particleCount = 30 + Math.random() * 20;
    const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 2;
        fireworks.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: color,
            alpha: 1,
            decay: 0.01 + Math.random() * 0.01
        });
    }
}

function updateFireworks() {
    for (let i = fireworks.length - 1; i >= 0; i--) {
        let p = fireworks[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // Gravity
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
            fireworks.splice(i, 1);
        } else {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
}

function animate() {
    const now = Date.now(), timeLeft = targetDate - now;
    ctx.clearRect(0, 0, w, h);

    // Check if timer has finished
    if (timeLeft <= 0 && gameState !== 'REVEAL') {
        gameState = 'REVEAL';
        timerElement.style.opacity = '0'; // Hide timer
    }

    if (gameState === 'INTRO_TEXT') handleIntroText();
    else if (gameState === 'SCENE_BUILDUP') handleSceneBuildup();
    else if (gameState === 'JOURNEY') {
        const progress = Math.min(1, Math.max(0, 1 - (timeLeft / (targetDate - startDate))));
        drawSky(); drawGroundElements(); drawCharacters(progress); drawLockAndTimer(progress);
        const d = Math.floor(timeLeft / 86400000), h_ = Math.floor((timeLeft % 86400000) / 3600000), m = Math.floor((timeLeft % 3600000) / 60000), s = Math.floor((timeLeft % 60000) / 1000);
        timerElement.innerText = `${d}d : ${String(h_).padStart(2,'0')}h : ${String(m).padStart(2,'0')}m : ${String(s).padStart(2,'0')}s`;
    } else if (gameState === 'REVEAL') {
        const grid = 10;
        revealProgress += 0.5;
        const limit = Math.min(Math.floor(revealProgress), pieces.length);

        for (let i = 0; i < limit; i++) {
            const idx = pieces[i];
            const sx = (idx % grid) * (img.width / grid);
            const sy = Math.floor(idx / grid) * (img.height / grid);
            const dx = (idx % grid) * (w / grid);
            const dy = Math.floor(idx / grid) * (h / grid);
            ctx.drawImage(img, sx, sy, img.width/grid, img.height/grid, dx, dy, w/grid, h/grid);
        }
        if (limit >= pieces.length) {
            drawLockAndTimer(1.1); // Draw unlocked lock on top
        }
    }
    requestAnimationFrame(animate);
}

function resize() {
    w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight;
    buildings = Array.from({ length: 60 }, () => ({
        x: Math.random() * w, h: 100 + Math.random() * 300, w: 50 + Math.random() * 50,
        color: `hsl(230, 15%, ${10 + Math.random() * 10}%)`,
        windows: Array.from({length: 8}, () => ({x: Math.random()*40, y: Math.random()*200}))
    }));
    fireflies = Array.from({ length: 15 }, () => ({
        offsetX: (Math.random()-0.5)*100, offsetY: -100+(Math.random()-0.5)*50,
        phase: Math.random()*Math.PI*2, speed: 0.002
    }));
}

function init() {
    fetchWeather(); resize();
    
    // Initialize Puzzle Pieces
    const grid = 10; 
    pieces = Array.from({ length: grid * grid }, (_, i) => i);
    for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }

    const splash = document.getElementById('splash');
    if (splash) { 
        splash.style.transition = 'opacity 1s'; 
        setTimeout(() => { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 1000); }, 3000);
    }
    animate();
}

init();
window.addEventListener('resize', resize);