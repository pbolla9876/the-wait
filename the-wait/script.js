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

// Phase 1: Text Reveal
const introLines = [
    "Miles apart, but heart to heart...",
    "Two souls, two cities, one journey.",
    "A countdown to the moment we meet."
];
let introState = { lineIndex: 0, alpha: 0, phase: 'in', lastUpdate: 0 };

// Phase 2: Scene Buildup
let sceneBuildupState = { sky: 0, ground: 0, chars: 0 };

// Phase 4: Puzzle Reveal
let pieces = [], revealProgress = 0;

// Weather API Key
const API_KEY = 'YOUR_API_KEY_GOES_HERE';

async function fetchWeather() {
    // If GitHub is running this, it won't have the API_KEY
    if (!API_KEY) {
        console.warn("GitHub Environment: API Key missing. Switching to Fallback Mode.");
        // ALTERNATIVE: Hardcode 'Clouds' or 'Clear' for the public version
        weatherData.left = { main: 'Clear', sunrise: 0, sunset: 0 }; 
        weatherData.right = { main: 'Clear', sunrise: 0, sunset: 0 };
        return;
    }
    try {
        // Left: Atlanta, GA | Right: Valparaiso, IN
        const [resLeft, resRight] = await Promise.all([
            fetch(`https://api.openweathermap.org/data/2.5/weather?lat=33.7490&lon=-84.3880&appid=${API_KEY}`),
            fetch(`https://api.openweathermap.org/data/2.5/weather?lat=41.4731&lon=-87.0611&appid=${API_KEY}`)
        ]);
        
        const dataLeft = await resLeft.json();
        const dataRight = await resRight.json();

        weatherData.left = processWeatherData(dataLeft);
        weatherData.right = processWeatherData(dataRight);
    } catch (e) {
        console.log("Weather fetch error:", e);
    }
}

function processWeatherData(data) {
    if (!data || !data.sys) return null;
    return {
        main: data.weather[0].main,
        sunrise: data.sys.sunrise * 1000,
        sunset: data.sys.sunset * 1000,
        dt: Date.now()
    };
}

function init() {
    gameState = 'INTRO_TEXT';
    animStartTime = Date.now();
    introState.lastUpdate = animStartTime;
    fetchWeather();
    
    const grid = 10;
    pieces = Array.from({ length: grid * grid }, (_, i) => i);
    for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }

    resize();
    animate();

    setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) {
            splash.style.opacity = '0';
            splash.addEventListener('transitionend', () => splash.remove());
        }
    }, 4000);
}

function drawSideEnvironment(side, x, y, width, height) {
    const data = weatherData[side];
    const pSystem = particles[side];
    const now = Date.now();
    
    // This uses your computer's clock if the API fails
    const currentHour = new Date().getHours(); 
    const isDay = data 
        ? (now > data.sunrise && now < data.sunset) 
        : (currentHour >= 6 && currentHour < 18); // 6 AM to 6 PM
    
    // 1. Sky Gradient
    const skyGrd = ctx.createLinearGradient(x, y, x, y + height);
    if (isDay) {
        skyGrd.addColorStop(0, '#87CEEB'); 
        skyGrd.addColorStop(1, '#FFD700'); 
    } else {
        skyGrd.addColorStop(0, '#020205'); 
        skyGrd.addColorStop(1, '#000000'); 
    }
    ctx.fillStyle = skyGrd;
    ctx.fillRect(x, y, width, height);

    // 2. Celestial Body
    const celestialY = y + height * 0.2;
    if (isDay) {
        let sunX = x + width * 0.5;
        if (data) {
            const progress = (now - data.sunrise) / (data.sunset - data.sunrise);
            sunX = x + (width * 0.1) + (width * 0.8 * progress);
        }
        ctx.fillStyle = "#FDB813";
        ctx.shadowBlur = 20; ctx.shadowColor = "#FDB813";
        ctx.beginPath(); ctx.arc(sunX, celestialY, 30, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    } else {
        // Moon (Static fallback if no data)
        const moonX = x + width * 0.8;
        ctx.fillStyle = "#FEFCD7";
        ctx.shadowBlur = 15; ctx.shadowColor = "#FEFCD7";
        ctx.beginPath(); ctx.arc(moonX, celestialY, 25, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }

    // 3. Weather Effects (Requires API Data)
    if (data) {
        if (data.main === 'Clouds' || data.main === 'Rain' || data.main === 'Snow') {
            if (pSystem.clouds.length < 4) {
                pSystem.clouds.push({ x: x - 100, y: y + Math.random() * 100, w: 80 + Math.random()*50, speed: 0.1 + Math.random() * 0.2 });
            }
            ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
            pSystem.clouds.forEach(c => {
                c.x += c.speed;
                if (c.x - c.w > x + width) c.x = x - c.w;
                ctx.beginPath(); ctx.arc(c.x, c.y, c.w * 0.4, 0, Math.PI * 2); ctx.fill();
            });
        }
        if (data.main === 'Rain') {
            if (pSystem.rain.length < 60) pSystem.rain.push({ x: x + Math.random()*width, y: y + Math.random()*height, l: 10, v: 8 });
            ctx.strokeStyle = "rgba(174, 194, 224, 0.5)";
            pSystem.rain.forEach(r => {
                r.y += r.v; if (r.y > y + height) r.y = y - 20;
                ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x, r.y + r.l); ctx.stroke();
            });
        }
    }
}

function drawSky() {
    const dividerX = w / 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, dividerX, h); ctx.clip();
    drawSideEnvironment('left', 0, 0, dividerX, h);
    ctx.restore();

    ctx.save();
    ctx.beginPath(); ctx.rect(dividerX, 0, w - dividerX, h); ctx.clip();
    drawSideEnvironment('right', dividerX, 0, w - dividerX, h);
    ctx.restore();
}

function drawGroundElements() {
    const dividerX = w / 2;
    const groundLevel = h - 100;
    const isNight = new Date().getHours() < 6 || new Date().getHours() >= 18;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, dividerX, h); ctx.clip();
    buildings.forEach(b => {
        ctx.fillStyle = b.color;
        const groundY = h - b.h;
        ctx.fillRect(b.x, groundY, b.w, b.h);
        if (isNight) {
            ctx.fillStyle = "rgba(255, 220, 150, 0.6)";
            b.windows.forEach(win => ctx.fillRect(b.x + win.x, groundY + win.y, 4, 6));
        }
        b.x -= 0.3; if (b.x + b.w < 0) b.x = w;
    });
    ctx.restore();

    // House and Tree on Right Side
    const houseX = w * 0.7;
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(houseX, groundLevel - 80, 100, 80); // Simple House
    ctx.beginPath(); ctx.moveTo(houseX-10, groundLevel-80); ctx.lineTo(houseX+50, groundLevel-120); ctx.lineTo(houseX+110, groundLevel-80); ctx.fill();

    // Ground
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, groundLevel, w, 100);
    
    // Divider
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath(); ctx.moveTo(dividerX, 0); ctx.lineTo(dividerX, h); ctx.stroke();
}

function drawCharacters(progress) {
    const dividerX = w / 2;
    const groundLevel = h - 100;
    const startGap = w * 0.6, endGap = 60;
    const currentGap = startGap - (startGap - endGap) * progress;
    
    // Male (Left)
    drawCharacterSilhouette(dividerX - currentGap / 2, groundLevel, 0.8, true);
    // Female (Right)
    drawCharacterSilhouette(dividerX + currentGap / 2, groundLevel, 0.8, false);
}

function drawCharacterSilhouette(x, y, scale, isMale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(isMale ? scale : -scale, scale);
    ctx.fillStyle = 'black';
    ctx.fillRect(-10, -80, 20, 45); // Body
    ctx.beginPath(); ctx.arc(0, -90, 10, 0, Math.PI*2); ctx.fill(); // Head
    ctx.fillRect(-8, -35, 6, 35); ctx.fillRect(2, -35, 6, 35); // Legs
    ctx.restore();
}

function drawLockAndTimer(progress) {
    const lockX = w / 2, lockY = 60;
    ctx.fillStyle = 'white'; ctx.strokeStyle = 'white';
    ctx.beginPath(); 
    if(progress < 1) ctx.arc(lockX, lockY, 12, Math.PI, 0); 
    else { ctx.save(); ctx.translate(lockX-10, lockY); ctx.rotate(-0.5); ctx.arc(10, 0, 12, Math.PI, 0); ctx.restore(); }
    ctx.stroke();
    ctx.fillRect(lockX - 18, lockY, 36, 25);
}

function handleIntroText() {
    const now = Date.now();
    const elapsed = now - introState.lastUpdate;
    ctx.fillStyle = 'black'; ctx.fillRect(0, 0, w, h);

    if (introState.phase === 'in') {
        introState.alpha += 0.01;
        if (introState.alpha >= 1) { introState.phase = 'pause'; introState.lastUpdate = now; }
    } else if (introState.phase === 'pause' && elapsed > 2000) {
        if (introState.lineIndex < introLines.length - 1) {
            introState.lineIndex++; introState.alpha = 0; introState.phase = 'in';
        } else { gameState = 'SCENE_BUILDUP'; animStartTime = now; }
    }

    ctx.font = "italic 22px Georgia"; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,255,255,${introState.alpha})`;
    ctx.fillText(introLines[introState.lineIndex], w/2, h/2);
}

function handleSceneBuildup() {
    const elapsed = Date.now() - animStartTime;
    sceneBuildupState.sky = Math.min(1, elapsed / 2000);
    sceneBuildupState.ground = Math.min(1, Math.max(0, (elapsed - 1000) / 2000));
    if (elapsed > 4000) { gameState = 'JOURNEY'; animStartTime = Date.now(); }

    ctx.globalAlpha = sceneBuildupState.sky; drawSky();
    ctx.globalAlpha = sceneBuildupState.ground; drawGroundElements();
    ctx.globalAlpha = 1;
}

function animate() {
    const now = Date.now(), timeLeft = targetDate - now;
    ctx.clearRect(0, 0, w, h);

    if (gameState === 'INTRO_TEXT') handleIntroText();
    else if (gameState === 'SCENE_BUILDUP') handleSceneBuildup();
    else if (gameState === 'JOURNEY' || gameState === 'REVEAL') {
        const progress = Math.min(1, 1 - (timeLeft / (targetDate - startDate)));
        drawSky(); drawGroundElements(); drawCharacters(progress); drawLockAndTimer(progress);

        const d = Math.floor(timeLeft / 86400000);
        const h_ = Math.floor((timeLeft % 86400000) / 3600000);
        const m = Math.floor((timeLeft % 3600000) / 60000);
        const s = Math.floor((timeLeft % 60000) / 1000);
        timerElement.innerText = `${d} : ${String(h_).padStart(2,'0')} : ${String(m).padStart(2,'0')} : ${String(s).padStart(2,'0')}`;
    }
    requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);
function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    buildings = Array.from({ length: 40 }, () => ({
        x: Math.random() * w, h: 100 + Math.random() * 200, w: 50 + Math.random() * 50,
        color: `hsl(220, 10%, ${10 + Math.random() * 10}%)`,
        windows: Array.from({length: 10}, () => ({x: Math.random()*40, y: Math.random()*150}))
    }));
}

init();