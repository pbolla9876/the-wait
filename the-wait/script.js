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

let gameState = 'INTRO_TEXT';
let animStartTime;

const introLines = [
    "Miles apart, but heart to heart...",
    "Two souls, two cities, one journey.",
    "A countdown to the moment we meet."
];
let introState = { lineIndex: 0, alpha: 0, phase: 'in', lastUpdate: 0 };
let sceneBuildupState = { sky: 0, ground: 0, chars: 0 };
let pieces = [], revealProgress = 0;

// Checks if CONFIG exists (local) or not (GitHub)
const API_KEY = typeof CONFIG !== 'undefined' ? CONFIG.WEATHER_API_KEY : '';

async function fetchWeather() {
    if (!API_KEY) return;
    try {
        const [resLeft, resRight] = await Promise.all([
            fetch(`https://api.openweathermap.org/data/2.5/weather?lat=33.7490&lon=-84.3880&appid=${API_KEY}`),
            fetch(`https://api.openweathermap.org/data/2.5/weather?lat=41.4731&lon=-87.0611&appid=${API_KEY}`)
        ]);
        weatherData.left = processWeatherData(await resLeft.json());
        weatherData.right = processWeatherData(await resRight.json());
    } catch (e) { console.log("Weather error", e); }
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
    const currentHour = new Date().getHours();

    // FALLBACK LOGIC: If no API data, use local time (6AM to 6PM is Day)
    let isDay = (currentHour >= 6 && currentHour < 18);
    if (data && data.sunrise && data.sunset) {
        isDay = (now > data.sunrise && now < data.sunset);
    }
    
    // Sky Colors
    const skyGrd = ctx.createLinearGradient(x, y, x, y + height);
    if (isDay) {
        skyGrd.addColorStop(0, '#87CEEB'); // Sky Blue
        skyGrd.addColorStop(1, '#E0F7FA'); // Horizon Light
    } else {
        skyGrd.addColorStop(0, '#050508'); // Deep Night
        skyGrd.addColorStop(1, '#000000'); // Black
    }
    ctx.fillStyle = skyGrd;
    ctx.fillRect(x, y, width, height);

    // Sun / Moon Logic
    const cy = y + height * 0.2;
    if (isDay) {
        ctx.fillStyle = "#FDB813";
        ctx.shadowBlur = 20; ctx.shadowColor = "#FDB813";
        ctx.beginPath(); ctx.arc(x + width*0.5, cy, 30, 0, Math.PI*2); ctx.fill();
    } else {
        ctx.fillStyle = "#FEFCD7";
        ctx.shadowBlur = 15; ctx.shadowColor = "#FEFCD7";
        ctx.beginPath(); ctx.arc(x + width*0.8, cy, 25, 0, Math.PI*2); ctx.fill();
    }
    ctx.shadowBlur = 0;
}

function drawSky() {
    const divX = w / 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, divX, h); ctx.clip();
    drawSideEnvironment('left', 0, 0, divX, h);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.rect(divX, 0, w - divX, h); ctx.clip();
    drawSideEnvironment('right', divX, 0, w - divX, h);
    ctx.restore();
}

function drawGroundElements() {
    const divX = w / 2;
    const groundY = h - 100;
    const isNight = (new Date().getHours() < 6 || new Date().getHours() >= 18);

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, divX, h); ctx.clip();
    buildings.forEach(b => {
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, h - b.h, b.w, b.h);
        if (isNight) {
            ctx.fillStyle = "rgba(255, 220, 150, 0.6)";
            b.windows.forEach(win => ctx.fillRect(b.x + win.x, (h - b.h) + win.y, 4, 6));
        }
        b.x -= 0.5; if (b.x + b.w < 0) b.x = w;
    });
    ctx.restore();

    ctx.fillStyle = "#050508";
    ctx.fillRect(0, groundY, w, 100);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath(); ctx.moveTo(divX, 0); ctx.lineTo(divX, h); ctx.stroke();
}

function drawCharacters(progress) {
    const divX = w / 2;
    const groundY = h - 100;
    const gap = (w * 0.8) - (w * 0.8 - 80) * progress;
    drawChar(divX - gap / 2, groundY, true);
    drawChar(divX + gap / 2, groundY, false);
}

function drawChar(x, y, isMale) {
    ctx.fillStyle = 'black';
    ctx.fillRect(x - 10, y - 85, 20, 45);
    ctx.beginPath(); ctx.arc(x, y - 95, 12, 0, Math.PI*2); ctx.fill();
}

function handleIntroText() {
    const now = Date.now();
    ctx.fillStyle = 'black'; ctx.fillRect(0, 0, w, h);
    if (introState.phase === 'in') {
        introState.alpha += 0.01;
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
    if (elapsed > 3000) { gameState = 'JOURNEY'; animStartTime = Date.now(); }
    ctx.globalAlpha = sceneBuildupState.sky; drawSky();
    ctx.globalAlpha = sceneBuildupState.ground; drawGroundElements();
    ctx.globalAlpha = 1;
}

function animate() {
    const now = Date.now(), timeLeft = targetDate - now;
    ctx.clearRect(0, 0, w, h);
    if (gameState === 'INTRO_TEXT') handleIntroText();
    else if (gameState === 'SCENE_BUILDUP') handleSceneBuildup();
    else {
        const progress = Math.min(1, 1 - (timeLeft / (targetDate - startDate)));
        drawSky(); drawGroundElements(); drawCharacters(progress);
        const d = Math.floor(timeLeft / 86400000);
        const h_ = Math.floor((timeLeft % 86400000) / 3600000);
        const m = Math.floor((timeLeft % 3600000) / 60000);
        const s = Math.floor((timeLeft % 60000) / 1000);
        timerElement.innerText = `${d} : ${String(h_).padStart(2,'0')} : ${String(m).padStart(2,'0')} : ${String(s).padStart(2,'0')}`;
    }
    requestAnimationFrame(animate);
}

function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    buildings = Array.from({ length: 40 }, () => ({
        x: Math.random() * w, h: 100 + Math.random() * 200, w: 50 + Math.random() * 50,
        color: `hsl(230, 10%, ${10 + Math.random() * 10}%)`,
        windows: Array.from({length: 5}, () => ({x: Math.random()*40, y: Math.random()*150}))
    }));
}

function init() {
    animStartTime = Date.now();
    fetchWeather();
    resize();

    // Hide splash screen
    const splash = document.getElementById('splash');
    if (splash) {
        splash.style.transition = "opacity 1s ease";
        splash.style.opacity = 0;
        setTimeout(() => splash.style.display = "none", 1000);
    }

    animate();
}

init();
window.addEventListener('resize', resize);