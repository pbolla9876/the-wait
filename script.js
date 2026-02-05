const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const timerElement = document.getElementById('timer');

// Polyfill for roundRect (prevents blank screen in browsers without support)
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        const radius = Math.min(r, w / 2, h / 2);
        this.beginPath();
        this.moveTo(x + radius, y);
        this.lineTo(x + w - radius, y);
        this.quadraticCurveTo(x + w, y, x + w, y + radius);
        this.lineTo(x + w, y + h - radius);
        this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        this.lineTo(x + radius, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        return this;
    };
}

const img = new Image();
img.src = 'image1.png';

const targetDate = new Date("March 1, 2026 00:00:00 GMT-0600").getTime();
const startDate = new Date("February 1, 2026 00:00:00 GMT-0600").getTime();

let w, h, buildings = [], fireflies = [], smokeParticles = [], birds = [], fireworks = [], stars = { left: [], right: [] };
let planes = { left: [], right: [] }; // moving airplanes per side
let lastPlaneTime = { left: 0, right: 0 };
let weatherData = { left: null, right: null };
let particles = {
    left: { rain: [], snow: [], clouds: [] },
    right: { rain: [], snow: [], clouds: [] }
};

// --- State Machine Variables ---
let gameState = 'INTRO_TEXT';
let animStartTime;

const introText = "Hey Jaan, sorry it took almost more than a couple of days to build this... I thought it was easy, but every time I get an idea, it’s getting even more difficult to implement. But yeah, here is the output—hope it works well on your side. Coming to the no communication thing, it’s so tough. More than the timer, I am counting each and every second in my mind, wishing the timer would become zero... For the first time, I am wishing maybe I could be Thanos, so I could snap my fingers and make the timer zero, but in real life, I am not a Marvel character. I'm just a character in real life who is 678 miles away from the person whom I love and admire so much. Previously, only the distance used to affect me, now the time as well... but I am missing you so much... I want to say more, but I will save it for that day—hope we will be back and with lots of affection. Miss you so much.........";
let introState = { charIndex: 0, phase: 'typing', lastUpdate: 0, completeTime: 0 };

// Phase 2: Scene Buildup
let sceneBuildupState = { sky: 0, ground: 0, chars: 0 };

// Phase 4: Puzzle Reveal
let pieces = [], revealProgress = 0;
let characterGap = null; // current gap between characters (for smooth walking)

// This tells the script: Use the key from config.js, but don't crash if it's missing.
const API_KEY = typeof CONFIG !== 'undefined' ? CONFIG.WEATHER_API_KEY : '';

async function fetchWeather() {
    if (!API_KEY) {
        console.warn("Weather API Key missing. Skipping fetch.");
        return;
    }
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
    gameState = 'INTRO_TEXT';
    animStartTime = Date.now();
    introState.lastUpdate = animStartTime;
    introState.charIndex = 0;
    introState.phase = 'typing';
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
    const now = Date.now();
    const currentHour = new Date().getHours();

    // Logic: Use API data if available, otherwise fallback to system time (6am - 6pm is Day)
    let isDay = (currentHour >= 6 && currentHour < 18);
    if (data && data.sunrise && data.sunset) {
        isDay = (now > data.sunrise && now < data.sunset);
    }
    
    // 1. Sky Gradient
    const skyGrd = ctx.createLinearGradient(x, y, x, y + height);
    let dayProgress = 0.5;
    if (data && data.sunrise && data.sunset) {
        dayProgress = (now - data.sunrise) / (data.sunset - data.sunrise);
        dayProgress = Math.max(0, Math.min(1, dayProgress));
    }
    const isSunrise = isDay && dayProgress < 0.2;
    const isSunset = isDay && dayProgress > 0.8;
    if (isDay) {
        if (isSunrise) {
            // Sunrise tones
            skyGrd.addColorStop(0, '#f7b28a');
            skyGrd.addColorStop(0.55, '#f6a96b');
            skyGrd.addColorStop(1, '#9fd3ff');
        } else if (isSunset) {
            // Sunset tones
            skyGrd.addColorStop(0, '#ff9a6a');
            skyGrd.addColorStop(0.6, '#f05a28');
            skyGrd.addColorStop(1, '#7aa2d9');
        } else {
            // Clear morning sky
            skyGrd.addColorStop(0, '#8fd3ff');
            skyGrd.addColorStop(0.7, '#bfe9ff');
            skyGrd.addColorStop(1, '#e7f6ff');
        }
    } else {
        // Rich, attractive night sky
        skyGrd.addColorStop(0, '#0b1130'); // Deep indigo
        skyGrd.addColorStop(0.6, '#050814'); // Near-black blue
        skyGrd.addColorStop(1, '#000000'); // Black
    }
    ctx.fillStyle = skyGrd;
    ctx.fillRect(x, y, width, height);

    // Subtle star haze band
    if (!isDay) {
        const haze = ctx.createLinearGradient(x, y + height * 0.1, x, y + height * 0.5);
        haze.addColorStop(0, "rgba(120, 140, 255, 0.08)");
        haze.addColorStop(1, "rgba(120, 140, 255, 0)");
        ctx.fillStyle = haze;
        ctx.fillRect(x, y, width, height * 0.6);
    }

    // Northern lights (night sky)
    if (!isDay) {
        const aurora = ctx.createLinearGradient(x, y, x + width, y + height * 0.5);
        aurora.addColorStop(0, "rgba(80, 220, 180, 0.0)");
        aurora.addColorStop(0.35, "rgba(80, 220, 180, 0.35)");
        aurora.addColorStop(0.6, "rgba(140, 120, 255, 0.28)");
        aurora.addColorStop(0.85, "rgba(80, 220, 180, 0.22)");
        aurora.addColorStop(1, "rgba(80, 220, 180, 0.0)");
        ctx.fillStyle = aurora;
        ctx.beginPath();
        ctx.moveTo(x, y + height * 0.15);
        ctx.quadraticCurveTo(x + width * 0.3, y + height * 0.05, x + width * 0.6, y + height * 0.18);
        ctx.quadraticCurveTo(x + width * 0.85, y + height * 0.3, x + width, y + height * 0.12);
        ctx.lineTo(x + width, y + height * 0.4);
        ctx.quadraticCurveTo(x + width * 0.6, y + height * 0.5, x + width * 0.2, y + height * 0.35);
        ctx.closePath();
        ctx.fill();

        // second band
        ctx.fillStyle = "rgba(90, 200, 255, 0.2)";
        ctx.beginPath();
        ctx.moveTo(x, y + height * 0.25);
        ctx.quadraticCurveTo(x + width * 0.4, y + height * 0.15, x + width * 0.7, y + height * 0.28);
        ctx.quadraticCurveTo(x + width * 0.9, y + height * 0.38, x + width, y + height * 0.25);
        ctx.lineTo(x + width, y + height * 0.32);
        ctx.quadraticCurveTo(x + width * 0.6, y + height * 0.42, x + width * 0.15, y + height * 0.3);
        ctx.closePath();
        ctx.fill();

        // Milky Way band
        const milky = ctx.createLinearGradient(x, y + height * 0.1, x + width, y + height * 0.6);
        milky.addColorStop(0, "rgba(180, 190, 255, 0.0)");
        milky.addColorStop(0.35, "rgba(180, 190, 255, 0.18)");
        milky.addColorStop(0.6, "rgba(200, 200, 255, 0.12)");
        milky.addColorStop(1, "rgba(180, 190, 255, 0.0)");
        ctx.fillStyle = milky;
        ctx.beginPath();
        ctx.moveTo(x, y + height * 0.12);
        ctx.quadraticCurveTo(x + width * 0.35, y + height * 0.22, x + width * 0.7, y + height * 0.16);
        ctx.quadraticCurveTo(x + width * 0.9, y + height * 0.1, x + width, y + height * 0.18);
        ctx.lineTo(x + width, y + height * 0.28);
        ctx.quadraticCurveTo(x + width * 0.6, y + height * 0.35, x + width * 0.2, y + height * 0.3);
        ctx.closePath();
        ctx.fill();
    }

    // 2. Celestial Body (Sun/Moon)
    const celestialY = y + height * 0.2;

    if (isDay) {
        let sunX = x + width * 0.5;
        let sunY = celestialY;
        let progress = 0.05;
        if (data && data.sunrise && data.sunset) {
            progress = (now - data.sunrise) / (data.sunset - data.sunrise);
            progress = Math.max(0, Math.min(1, progress));
        }

        // Sunrise feel: keep sun low near horizon during early day
        const arc = Math.sin(progress * Math.PI);
        sunX = x + (width * 0.1) + (width * 0.8 * progress);
        sunY = y + height * 0.65 - arc * (height * 0.35);

        // Sunrise / Sunset glow
        const warmCore = isSunset ? "rgba(255, 160, 90, 0.9)" : "rgba(255, 210, 120, 0.9)";
        const warmMid = isSunset ? "rgba(255, 120, 60, 0.55)" : "rgba(255, 180, 80, 0.5)";
        const warmEdge = isSunset ? "rgba(255, 90, 40, 0)" : "rgba(255, 140, 60, 0)";
        const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 90);
        sunGlow.addColorStop(0, warmCore);
        sunGlow.addColorStop(0.4, warmMid);
        sunGlow.addColorStop(1, warmEdge);
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 90, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isSunset ? "#FF8A4C" : "#FDB813";
        ctx.shadowBlur = 18; ctx.shadowColor = isSunset ? "rgba(255, 140, 80, 0.8)" : "rgba(255, 200, 120, 0.8)";
        ctx.beginPath();
        ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Light rays (clear morning)
        ctx.save();
        ctx.translate(sunX, sunY);
        ctx.strokeStyle = "rgba(255, 220, 170, 0.25)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * 35, Math.sin(ang) * 35);
            ctx.lineTo(Math.cos(ang) * 80, Math.sin(ang) * 80);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Night: always draw moon; draw stars when clear or when no API data available
    if (!isDay) {
        const showStars = !data || (data && data.main === 'Clear');
        if (showStars) {
            const starList = stars[side] || [];
            ctx.fillStyle = "white";
            starList.forEach(s => {
                const sx = x + s.x * width;
                const sy = y + s.y * (height * 0.6);
                const tw = 0.6 + 0.4 * Math.sin(now * 0.002 + s.phase);
                ctx.globalAlpha = Math.max(0.05, Math.min(1, s.a * tw));
                ctx.beginPath(); ctx.arc(sx, sy, s.r, 0, Math.PI * 2); ctx.fill();
            });
            ctx.globalAlpha = 1;
        }

        // Moon (draw always during night)
        let moonX = x + width * 0.8;
        let moonY = celestialY;
        if (data && data.sunrise && data.sunset) {
            // place moon opposite to sun progress for a nicer arc
            const progress = (now - data.sunrise) / (data.sunset - data.sunrise);
            moonX = x + (width * 0.9) - (width * 0.8 * progress);
            moonY = celestialY + Math.sin((1 - progress) * Math.PI) * -40;
        }
        // Moon halo (soft radial glow)
        const halo = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 80);
        halo.addColorStop(0, 'rgba(254,252,215,0.9)');
        halo.addColorStop(0.5, 'rgba(254,252,215,0.25)');
        halo.addColorStop(1, 'rgba(254,252,215,0)');
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(moonX, moonY, 80, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = "#FEFCD7";
        ctx.shadowBlur = 12; ctx.shadowColor = "rgba(254,252,215,0.9)";
        ctx.beginPath(); ctx.arc(moonX, moonY, 25, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }

    // 3. Weather Effects
        // Slow day clouds (always during day)
        if (isDay) {
            if (pSystem.clouds.length < 4) {
                pSystem.clouds.push({ x: x - 120, y: y + 30 + Math.random() * 120, w: 90 + Math.random() * 60, speed: 0.05 + Math.random() * 0.08 });
            }
            ctx.fillStyle = "rgba(230, 230, 230, 0.45)";
            pSystem.clouds.forEach((c) => {
                c.x += c.speed;
                if (c.x - c.w > x + width) c.x = x - c.w;
                ctx.beginPath();
                ctx.arc(c.x, c.y, c.w * 0.4, 0, Math.PI * 2);
                ctx.arc(c.x + c.w * 0.3, c.y + c.w * 0.1, c.w * 0.3, 0, Math.PI * 2);
                ctx.arc(c.x - c.w * 0.3, c.y + c.w * 0.1, c.w * 0.3, 0, Math.PI * 2);
                ctx.arc(c.x, c.y - c.w * 0.2, c.w * 0.3, 0, Math.PI * 2);
                ctx.fill();
            });
        } else {
            // Clouds only if weather says clouds/rain/snow at night
            if (data && (data.main === 'Clouds' || data.main === 'Rain' || data.main === 'Snow')) {
                if (pSystem.clouds.length < 4) {
                    pSystem.clouds.push({ x: x - 100, y: y + Math.random() * 100, w: 80 + Math.random()*50, speed: 0.1 + Math.random() * 0.2 });
                }
                ctx.fillStyle = "rgba(200, 200, 200, 0.35)";
                pSystem.clouds.forEach((c) => {
                    c.x += c.speed;
                    if (c.x - c.w > x + width) c.x = x - c.w;
                    ctx.beginPath();
                    ctx.arc(c.x, c.y, c.w * 0.4, 0, Math.PI * 2);
                    ctx.arc(c.x + c.w * 0.3, c.y + c.w * 0.1, c.w * 0.3, 0, Math.PI * 2);
                    ctx.arc(c.x - c.w * 0.3, c.y + c.w * 0.1, c.w * 0.3, 0, Math.PI * 2);
                    ctx.arc(c.x, c.y - c.w * 0.2, c.w * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                });
            }
        }

        // Rain
        if (data && data.main === 'Rain') {
            if (pSystem.rain.length < 100) pSystem.rain.push({ x: x + Math.random()*width, y: y + Math.random()*height, l: 10+Math.random()*10, v: 10+Math.random()*5 });
            ctx.strokeStyle = "rgba(174, 194, 224, 0.6)"; ctx.lineWidth = 1;
            pSystem.rain.forEach(r => {
                r.y += r.v; if (r.y > y + height) r.y = y - 20;
                ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x, r.y + r.l); ctx.stroke();
            });
        }

        // Snow
        if (data && data.main === 'Snow') {
            if (pSystem.snow.length < 50) pSystem.snow.push({ x: x + Math.random()*width, y: y + Math.random()*height, r: 2+Math.random()*2, v: 1+Math.random() });
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            pSystem.snow.forEach(s => {
                s.y += s.v; s.x += Math.sin(Date.now()*0.001)*0.5;
                if (s.y > y + height) s.y = y - 10;
                ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
            });
        }

        // Airplanes (day + night with lights)
        updatePlanes(side, now, x, y, width, height, isDay);
    }

function updatePlanes(side, now, x, y, width, height, isDay) {
    // Spawn a plane roughly every 45 seconds (with randomness)
    if (now - lastPlaneTime[side] > 45000 + Math.random() * 10000) {
        lastPlaneTime[side] = now;
        const fromLeft = Math.random() < 0.5;
        const aboveClouds = Math.random() < 0.5;
        const cloudBandY = y + height * 0.25;
        const yPos = aboveClouds ? cloudBandY - 40 - Math.random() * 40 : cloudBandY + 10 + Math.random() * 40;
        planes[side].push({
            x: fromLeft ? x - 60 : x + width + 60,
            y: yPos,
            vx: (fromLeft ? 1 : -1) * (0.8 + Math.random() * 0.6),
            side: fromLeft ? 1 : -1,
            isDay,
            blink: Math.random() * Math.PI * 2
        });
    }

    // Draw and update planes
    planes[side] = planes[side].filter(p => p.x > x - 120 && p.x < x + width + 120);
    planes[side].forEach(p => {
        p.x += p.vx;
        p.blink += 0.15;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.side, 1);

        // Fuselage
        ctx.fillStyle = p.isDay ? "rgba(230,230,230,0.9)" : "rgba(220,220,220,0.7)";
        ctx.beginPath();
        ctx.roundRect(-16, -3, 32, 6, 3);
        ctx.fill();

        // Wings
        ctx.fillStyle = "rgba(200,200,200,0.8)";
        ctx.beginPath();
        ctx.moveTo(-2, -1);
        ctx.lineTo(10, -7);
        ctx.lineTo(6, -1);
        ctx.closePath();
        ctx.fill();

        // Tail
        ctx.beginPath();
        ctx.moveTo(-12, -1);
        ctx.lineTo(-18, -8);
        ctx.lineTo(-10, -2);
        ctx.closePath();
        ctx.fill();

        // Lights
        const blink = 0.5 + 0.5 * Math.sin(p.blink);
        ctx.fillStyle = p.isDay ? `rgba(255, 80, 80, ${0.4 + blink * 0.4})` : `rgba(255, 230, 140, ${0.5 + blink * 0.5})`;
        ctx.beginPath();
        ctx.arc(14, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    });
}

function drawSky() {
    const dividerX = w/2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, dividerX, h);
    ctx.clip();
    
    // Draw Left Environment (Atlanta)
    drawSideEnvironment('left', 0, 0, dividerX, h);

    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(dividerX, 0, w - dividerX, h);
    ctx.clip();
    // Draw Right Environment (Valparaiso)
    drawSideEnvironment('right', dividerX, 0, w - dividerX, h);
    ctx.restore();
}

function updateSmoke(x, y) {
    if (Math.random() < 0.03) {
        smokeParticles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 0.5, vy: -1 - Math.random(), life: 1, size: 3 });
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
}

function updateBirds() {
    const treeX = w * 0.9;
    const treeY = h - 100;
    // Landing spots relative to tree center
    const spots = [
        {x: 12, y: -160}, {x: -30, y: -140}, {x: 50, y: -130}, {x: 15, y: -110}
    ];

    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'black';

    birds.forEach(b => {
        // Logic
        if (b.state === 'flying') {
            b.x += b.vx;
            b.y += b.vy;

            // Boundaries (Keep mostly to the right side)
            if (b.x < w * 0.5) b.vx += 0.05;
            if (b.x > w) b.vx -= 0.05;
            if (b.y < 0) b.vy += 0.05;
            if (b.y > h - 50) b.vy -= 0.05;

            // Random movement
            b.vx += (Math.random() - 0.5) * 0.1;
            b.vy += (Math.random() - 0.5) * 0.1;

            // Speed limit
            const speed = Math.hypot(b.vx, b.vy);
            if (speed > 3) { b.vx *= 0.95; b.vy *= 0.95; }

            // Decide to land
            if (Math.random() < 0.005) {
                b.state = 'landing';
                const spot = spots[Math.floor(Math.random() * spots.length)];
                b.target = { x: treeX + spot.x, y: treeY + spot.y };
            }
        } else if (b.state === 'landing') {
            const dx = b.target.x - b.x;
            const dy = b.target.y - b.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 5) {
                b.state = 'perched';
                b.timer = 100 + Math.random() * 200;
                b.x = b.target.x;
                b.y = b.target.y;
            } else {
                b.vx = dx * 0.02;
                b.vy = dy * 0.02;
                b.x += b.vx;
                b.y += b.vy;
            }
        } else if (b.state === 'perched') {
            b.timer--;
            if (b.timer <= 0) {
                b.state = 'flying';
                b.vx = (Math.random() - 0.5) * 2;
                b.vy = -2; // Jump up
            }
        }

        // Draw
        if (b.state === 'perched') {
            ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI*2); ctx.fill();
        } else {
            // Flapping Animation
            const flap = Math.sin(Date.now() * 0.015 + b.x);
            ctx.beginPath();
            ctx.moveTo(b.x - 3, b.y - 3 * flap);
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(b.x + 3, b.y - 3 * flap);
            ctx.stroke();
        }
    });
}

function updateFireflies(baseX, baseY) {
    ctx.fillStyle = "#ffeb3b";
    const time = Date.now();
    fireflies.forEach(f => {
        const fx = baseX + f.offsetX + Math.sin(time * f.speed + f.phase) * 20;
        const fy = baseY + f.offsetY + Math.cos(time * f.speed + f.phase) * 10;
        const alpha = 0.5 + Math.sin(time * 0.005 + f.phase) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function drawGroundElements() {
    const dividerX = w / 2;
    const groundLevel = h - 100;
    const now = Date.now();
    const dataLeft = weatherData.left;
    const currentHour = new Date().getHours();
    let isDayLeft = (currentHour >= 6 && currentHour < 18);
    if (dataLeft && dataLeft.sunrise && dataLeft.sunset) {
        isDayLeft = (now > dataLeft.sunrise && now < dataLeft.sunset);
    }
    let isNightLeft = (currentHour < 6 || currentHour >= 18);
    if (dataLeft && dataLeft.sunrise && dataLeft.sunset) {
        isNightLeft = (now < dataLeft.sunrise || now > dataLeft.sunset);
    }

    // Pick a single left-side building to label: tallest, then closest to center divider
    let featuredBuilding = null;
    let bestHeight = -Infinity;
    let bestDist = Infinity;
    buildings.forEach(b => {
        const centerX = b.x + b.w / 2;
        if (centerX >= dividerX) return;
        const distToCenter = Math.abs(dividerX - centerX);
        if (b.h > bestHeight || (b.h === bestHeight && distToCenter < bestDist)) {
            bestHeight = b.h;
            bestDist = distToCenter;
            featuredBuilding = b;
        }
    });

    // Clip building drawing to the left side
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, dividerX, h);
    ctx.clip();

    buildings.forEach(b => {
        ctx.fillStyle = b.color;
        const groundY = h - b.h;
        let signRect = null;

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
        if (featuredBuilding === b) {
            const signW = Math.max(70, Math.min(140, b.w * 0.8));
            const signH = 16;
            const signX = b.x + (b.w - signW) / 2;
            const signY = groundY + Math.max(10, b.h * 0.15);
            const statusW = Math.min(64, signW * 0.7);
            const statusH = 12;
            const statusX = signX + (signW - statusW) / 2;
            const statusY = signY + signH + 6;
            signRect = {
                x1: signX,
                y1: signY,
                x2: signX + signW,
                y2: statusY + statusH
            };
        }
        
            // Draw windows (always). Size scales with building so they don't mix.
            const winW = Math.max(3, Math.floor(b.w / 10));
            const winH = Math.max(3, Math.floor(b.h / 15));
            // Window glow: night windows warm and slightly blurred, day windows faint
            b.windows.forEach(win => {
                const wx = Math.round(b.x + win.x);
                const wy = Math.round(groundY + win.y);
                if (signRect) {
                    const overlaps =
                        wx + winW > signRect.x1 &&
                        wx < signRect.x2 &&
                        wy + winH > signRect.y1 &&
                        wy < signRect.y2;
                    if (overlaps) return;
                }
                ctx.save();
                if (isNightLeft) {
                    ctx.fillStyle = "rgba(255, 220, 150, 0.95)";
                    ctx.shadowBlur = 8; ctx.shadowColor = "rgba(255,200,120,0.7)";
                } else {
                    ctx.fillStyle = "rgba(200, 220, 255, 0.18)";
                    ctx.shadowBlur = 0;
                }
                ctx.fillRect(wx, wy, winW, winH);
                ctx.restore();
            });

            // Starbucks sign on a featured left-side skyscraper
            if (featuredBuilding === b && signRect) {
                const signW = signRect.x2 - signRect.x1;
                const signH = 16;
                const signX = signRect.x1;
                const signY = signRect.y1;
                const statusW = Math.min(64, signW * 0.7);
                const statusH = 12;
                const statusX = signX + (signW - statusW) / 2;
                const statusY = signRect.y2 - statusH;

                ctx.fillStyle = "#f2e9d8";
                ctx.fillRect(signX, signY, signW, signH);
                ctx.fillStyle = "#2a211d";
                ctx.font = "bold 12px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("Starbucks", signX + signW / 2, signY + signH / 2);

                ctx.fillStyle = isDayLeft ? "rgba(90, 200, 90, 0.9)" : "rgba(200, 90, 90, 0.9)";
                ctx.fillRect(statusX, statusY, statusW, statusH);
                ctx.fillStyle = "#111";
                ctx.font = "bold 10px Arial";
                ctx.fillText(isDayLeft ? "OPEN" : "CLOSED", statusX + statusW / 2, statusY + statusH / 2 + 0.5);
            }

            b.x -= 0.5; // Parallax speed
            if (b.x + b.w < 0) {
                // Respawn on the right with fresh size, windows and visible color
                b.x = w + Math.random() * 200;
                b.w = 40 + Math.random() * 80;
                b.h = 100 + Math.random() * (h * 0.4);

                // Regenerate windows based on new dimensions (spacing adapts)
                b.windows = [];
                const yStep = Math.max(18, Math.floor(b.h / 10));
                const xStep = Math.max(12, Math.floor(b.w / 6));
                for (let wy = 20; wy < b.h - 20; wy += yStep) {
                    for (let wx = 10; wx < b.w - 10; wx += xStep) {
                        if (Math.random() > 0.6) b.windows.push({ x: wx, y: wy });
                    }
                }

                // Assign a visible color
                if (b.x + b.w / 2 < w / 2) {
                    const hue = Math.floor(Math.random() * 60);
                    const sat = 60 + Math.floor(Math.random() * 20);
                    const light = 35 + Math.floor(Math.random() * 20);
                    b.color = `hsl(${hue}, ${sat}%, ${light}%)`;
                } else {
                    const light = 20 + Math.floor(Math.random() * 30);
                    b.color = `hsl(230, 20%, ${light}%)`;
                }

                const tRoll = Math.random();
                b.type = tRoll < 0.6 ? 'rect' : (tRoll < 0.85 ? 'stepped' : 'spire');
            }

        b.x -= 0.5; // Parallax speed
        if (b.x + b.w < 0) b.x = w;
    });

    ctx.restore(); // End clipping for buildings

    // 5. Ground Gradient (drawn before foreground elements so legs are visible)
    const groundGrd = ctx.createLinearGradient(0, groundLevel, 0, h);
    groundGrd.addColorStop(0, '#050508');
    groundGrd.addColorStop(1, '#000');
    ctx.fillStyle = groundGrd;
    ctx.fillRect(0, groundLevel, w, h);

    // Realistic road on left side (asphalt with perspective + center dashes)
    // Oriented to the left to match the male's walking direction
    const roadTop = groundLevel - 12;
    const roadLeft = 0;
    const roadRight = w * 0.48;
    const roadHorizon = roadTop + 26;

    // Asphalt base
    const asphaltGrad = ctx.createLinearGradient(0, roadTop, 0, h);
    asphaltGrad.addColorStop(0, "#3a3a3a");
    asphaltGrad.addColorStop(1, "#1e1e1e");
    ctx.fillStyle = asphaltGrad;
    ctx.beginPath();
    ctx.moveTo(roadLeft, h);
    ctx.lineTo(roadLeft, roadHorizon);
    ctx.quadraticCurveTo(w * 0.12, groundLevel - 10, w * 0.24, roadHorizon); // bend left
    ctx.lineTo(w * 0.38, h);
    ctx.closePath();
    ctx.fill();

    // Road shoulder edge
    ctx.strokeStyle = "rgba(220, 220, 220, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(roadLeft, roadHorizon);
    ctx.quadraticCurveTo(w * 0.12, groundLevel - 10, w * 0.24, roadHorizon);
    ctx.stroke();

    // Center dashed line (perspective)
    ctx.strokeStyle = "rgba(245, 214, 97, 0.8)";
    ctx.lineWidth = 2.5;
    const dashCount = 6;
    for (let i = 0; i < dashCount; i++) {
        const t = i / dashCount;
        const y = roadHorizon + t * (h - roadHorizon);
        const x = w * 0.12 + t * (w * 0.05); // drift leftward
        const dashLen = 8 + t * 10;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + dashLen);
        ctx.stroke();
    }

    // Draw Rural House (right side, traditional village vibe)
    const rightX = w * 0.5;
    const rightW = w * 0.5;
    const houseX = rightX + rightW * 0.12;
    const houseY = groundLevel;

    // Distant hills (morning haze)
    ctx.fillStyle = "rgba(120, 170, 150, 0.35)";
    ctx.beginPath();
    ctx.moveTo(rightX, groundLevel - 80);
    ctx.quadraticCurveTo(rightX + rightW * 0.3, groundLevel - 140, rightX + rightW * 0.6, groundLevel - 95);
    ctx.quadraticCurveTo(rightX + rightW * 0.8, groundLevel - 120, rightX + rightW, groundLevel - 70);
    ctx.lineTo(rightX + rightW, groundLevel);
    ctx.lineTo(rightX, groundLevel);
    ctx.closePath();
    ctx.fill();

    // Mud wall texture
    const mudGrad = ctx.createLinearGradient(houseX, houseY - 120, houseX, houseY);
    mudGrad.addColorStop(0, "#9b7b5d");
    mudGrad.addColorStop(1, "#7b5f45");
    ctx.fillStyle = mudGrad;
    ctx.fillRect(houseX, houseY - 120, 160, 120);

    // Wall texture strokes
    ctx.strokeStyle = "rgba(255, 240, 220, 0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(houseX + 10, houseY - 110 + i * 10);
        ctx.lineTo(houseX + 130, houseY - 108 + i * 10);
        ctx.stroke();
    }

    // Thatched roof
    ctx.beginPath();
    ctx.moveTo(houseX - 14, houseY - 120);
    ctx.lineTo(houseX + 80, houseY - 178);
    ctx.lineTo(houseX + 174, houseY - 120);
    ctx.closePath();
    ctx.fillStyle = "#6b4f2f";
    ctx.fill();

    // Straw lines for thatch detail
    ctx.strokeStyle = "rgba(255, 230, 180, 0.25)";
    for (let i = 0; i < 13; i++) {
        ctx.beginPath();
        ctx.moveTo(houseX - 6 + i * 14, houseY - 122);
        ctx.lineTo(houseX + 22 + i * 9, houseY - 150);
        ctx.stroke();
    }

    // Wooden door
    ctx.fillStyle = "#5a3e2a";
    ctx.fillRect(houseX + 15, houseY - 60, 28, 60);
    ctx.fillStyle = "rgba(255, 210, 160, 0.15)";
    ctx.fillRect(houseX + 18, houseY - 55, 22, 50);

    // Small window with warm light
    ctx.fillStyle = "rgba(255, 220, 130, 0.55)";
    ctx.fillRect(houseX + 90, houseY - 75, 34, 26);
    ctx.strokeStyle = "rgba(80, 50, 30, 0.6)";
    ctx.strokeRect(houseX + 90, houseY - 75, 34, 26);

    // Garden with White Flowers
    ctx.fillStyle = "#2e7d32"; // Green bed
    ctx.beginPath();
    ctx.ellipse(houseX + 80, houseY + 5, 90, 10, 0, 0, Math.PI*2);
    ctx.fill();

    for(let i=0; i<12; i++) {
        const fx = houseX + 10 + (i * 9) + Math.sin(i*99)*5;
        const fy = houseY + 2 + Math.cos(i*50)*3;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(fx, fy, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#ffd700"; 
        ctx.beginPath(); ctx.arc(fx, fy, 1, 0, Math.PI*2); ctx.fill();
    }

    // Small plants with white flowers scattered in the garden (behind the character)
    for (let i = 0; i < 8; i++) {
        const rx = houseX + 20 + (Math.sin(i * 78.3) * 0.5 + 0.5) * 90;
        const ry = houseY + 2 + (Math.cos(i * 52.1) * 0.5 + 0.5) * 6;
        ctx.fillStyle = "#2e7d32";
        ctx.beginPath();
        ctx.ellipse(rx, ry, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(rx, ry - 5, 2.2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Female character near the house, facing left, waiting posture
    const houseScale = 0.45; // full-body, smaller than house
    drawWaitingWoman(houseX + 150, houseY - 10, houseScale, true);

    // Male character on left side, walking toward the female
    const maleScale = 0.45;
    drawWalkingMan(w * 0.25, groundLevel - 10, maleScale, true);

    // Draw Rural Tree (full, organic canopy)
    const treeX = rightX + rightW * 0.82;
    const treeY = groundLevel;

    // Trunk
    ctx.fillStyle = "#4b2f1f";
    ctx.fillRect(treeX, treeY - 170, 28, 170);

    // Canopy
    const leafGrad = ctx.createRadialGradient(treeX + 10, treeY - 160, 20, treeX + 10, treeY - 160, 90);
    leafGrad.addColorStop(0, "#2f7a32");
    leafGrad.addColorStop(1, "#1b4d22");
    ctx.fillStyle = leafGrad;
    ctx.beginPath();
    ctx.arc(treeX + 12, treeY - 175, 70, 0, Math.PI * 2);
    ctx.arc(treeX - 35, treeY - 150, 50, 0, Math.PI * 2);
    ctx.arc(treeX + 55, treeY - 150, 55, 0, Math.PI * 2);
    ctx.arc(treeX + 10, treeY - 120, 45, 0, Math.PI * 2);
    ctx.fill();

    // Tree Flowers
    ctx.fillStyle = "#f48fb1";
    [{x:10,y:-170}, {x:-20,y:-150}, {x:40,y:-140}, {x:20,y:-120}, {x:-5, y:-200}].forEach(p => {
        ctx.beginPath(); ctx.arc(treeX + 12 + p.x, treeY + p.y, 4, 0, Math.PI*2); ctx.fill();
    });

    // Fireflies
    updateFireflies(treeX, treeY);

    // Birds
    updateBirds();

    // High-quality character illustration (right side, under the tree)
    // Female character removed per request

    // Green grass patch on right side (where female stands)
    const grassX = rightX;
    const grassW = rightW;
    const grassH = h - groundLevel; // fill to bottom of screen
    const grassBaseY = groundLevel; // sit directly on ground
    const grassGrad = ctx.createLinearGradient(grassX, grassBaseY - 10, grassX, h);
    grassGrad.addColorStop(0, "#2e7d32");
    grassGrad.addColorStop(1, "#1b5e20");
    ctx.fillStyle = grassGrad;
    ctx.beginPath();
    ctx.moveTo(grassX, grassBaseY + 6);
    ctx.quadraticCurveTo(grassX + grassW * 0.5, grassBaseY - 6, grassX + grassW, grassBaseY + 6);
    ctx.lineTo(grassX + grassW, h);
    ctx.lineTo(grassX, h);
    ctx.closePath();
    ctx.fill();

    // Grass blades
    ctx.strokeStyle = "rgba(120, 200, 120, 0.5)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
        const gx = grassX + (i / 17) * grassW;
        const gh = 6 + (i % 3) * 4;
        ctx.beginPath();
        ctx.moveTo(gx, grassBaseY + 6);
        ctx.lineTo(gx - 2, grassBaseY + 6 - gh);
        ctx.stroke();
    }

    // Soft fog layer near ground (morning)
    const fogGrad = ctx.createLinearGradient(rightX, groundLevel - 20, rightX, groundLevel + 80);
    fogGrad.addColorStop(0, "rgba(255, 240, 220, 0.25)");
    fogGrad.addColorStop(1, "rgba(255, 240, 220, 0)");
    ctx.fillStyle = fogGrad;
    ctx.fillRect(rightX, groundLevel - 20, rightW, 100);

    // Small village details: fence + clay pots + lantern
    ctx.strokeStyle = "rgba(130, 90, 60, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rightX + rightW * 0.05, groundLevel - 6);
    ctx.lineTo(rightX + rightW * 0.28, groundLevel - 6);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
        const px = rightX + rightW * 0.07 + i * (rightW * 0.04);
        ctx.beginPath();
        ctx.moveTo(px, groundLevel - 6);
        ctx.lineTo(px, groundLevel - 20);
        ctx.stroke();
    }

    // (plants now drawn within garden above)

    // Hanging lantern glow near door
    const lanternX = houseX + 48;
    const lanternY = houseY - 70;
    const lanternGlow = ctx.createRadialGradient(lanternX, lanternY, 2, lanternX, lanternY, 18);
    lanternGlow.addColorStop(0, "rgba(255, 220, 140, 0.8)");
    lanternGlow.addColorStop(1, "rgba(255, 220, 140, 0)");
    ctx.fillStyle = lanternGlow;
    ctx.beginPath(); ctx.arc(lanternX, lanternY, 18, 0, Math.PI * 2); ctx.fill();

    // 6. Divider Line
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(dividerX, 0); ctx.lineTo(dividerX, h); ctx.stroke();

}

function drawWaitingWoman(x, y, scale, faceLeft) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * (faceLeft ? -1 : 1), scale);

    // Body proportions based on house height (~120)
    const headR = 17;
    const torsoH = 42;
    const torsoW = 18; // slimmer torso
    const legH = 55; // longer legs for model-like silhouette

    // Hair (sleek, long)
    const hairGrad = ctx.createLinearGradient(-20, -70, 20, 10);
    hairGrad.addColorStop(0, "#2a1a14");
    hairGrad.addColorStop(1, "#1c110c");
    ctx.fillStyle = hairGrad;
    ctx.beginPath();
    ctx.ellipse(0, -40, 22, 34, 0, 0, Math.PI * 2);
    ctx.fill();

    // Face (clear human look with soft shading)
    const faceGrad = ctx.createRadialGradient(0, -48, 4, 0, -48, 24);
    faceGrad.addColorStop(0, "#e2b08a");
    faceGrad.addColorStop(0.7, "#d29c75");
    faceGrad.addColorStop(1, "#c48a66");
    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.ellipse(0, -45, headR - 2, headR + 4, 0, 0, Math.PI * 2); // slimmer face
    ctx.fill();

    // Eyes (clearer, human)
    ctx.fillStyle = "#f6f4f2";
    ctx.beginPath(); ctx.ellipse(-6, -48, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6, -48, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2c5c77";
    ctx.beginPath(); ctx.arc(-7, -48, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, -48, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0b0b0b";
    ctx.beginPath(); ctx.arc(-7, -48, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, -48, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.arc(-8.5, -50, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5.5, -50, 1.1, 0, Math.PI * 2); ctx.fill();

    // Brows
    ctx.strokeStyle = "rgba(60,30,20,0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-12, -56); ctx.quadraticCurveTo(-6, -60, 0, -56); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -56); ctx.quadraticCurveTo(6, -60, 12, -56); ctx.stroke();

    // Nose and smile
    ctx.strokeStyle = "rgba(120,80,60,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -47); ctx.quadraticCurveTo(2, -41, 0, -37); ctx.stroke();
    ctx.strokeStyle = "rgba(140,80,80,0.7)";
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-6, -32); ctx.quadraticCurveTo(0, -29, 6, -32); ctx.stroke();

    // Bindi
    ctx.fillStyle = "#c62828";
    ctx.beginPath(); ctx.arc(0, -54, 2, 0, Math.PI * 2); ctx.fill();

    // Neck
    ctx.fillStyle = "#c48a66";
    ctx.beginPath();
    ctx.roundRect(-6, -27, 12, 10, 4);
    ctx.fill();

    // Torso (saree blouse)
    const clothGrad = ctx.createLinearGradient(-20, -20, 20, 60);
    clothGrad.addColorStop(0, "#8a1730");
    clothGrad.addColorStop(1, "#5d0c1f");
    ctx.fillStyle = clothGrad;
    ctx.beginPath();
    ctx.roundRect(-torsoW / 2, -18, torsoW, torsoH - 10, 7);
    ctx.fill();

    // Arm (down, waiting)
    ctx.fillStyle = "#d09a75";
    ctx.beginPath();
    ctx.roundRect(-torsoW / 2 - 6, -5, 6, 26, 4);
    ctx.fill();

    // Saree drape (pallu) over shoulder
    ctx.fillStyle = "rgba(155, 31, 51, 0.9)";
    ctx.beginPath();
    ctx.moveTo(-6, -10);
    ctx.quadraticCurveTo(20, 5, 14, 40);
    ctx.quadraticCurveTo(4, 70, -12, 85);
    ctx.quadraticCurveTo(-20, 55, -18, 30);
    ctx.closePath();
    ctx.fill();

    // Saree skirt with pleats
    const sareeGrad = ctx.createLinearGradient(-26, 10, 26, 80);
    sareeGrad.addColorStop(0, "#a11f34");
    sareeGrad.addColorStop(0.6, "#8a1730");
    sareeGrad.addColorStop(1, "#6a0f20");
    ctx.fillStyle = sareeGrad;
    ctx.beginPath();
    ctx.moveTo(-22, 10);
    ctx.quadraticCurveTo(0, 30, 22, 10);
    ctx.quadraticCurveTo(28, 45, 18, 75);
    ctx.quadraticCurveTo(0, 88, -18, 75);
    ctx.quadraticCurveTo(-28, 45, -22, 10);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 210, 210, 0.22)";
    ctx.lineWidth = 1.2;
    [-12, -6, 0, 6, 12].forEach((px) => {
        ctx.beginPath();
        ctx.moveTo(px, 15);
        ctx.quadraticCurveTo(px + 2, 45, px - 1, 75);
        ctx.stroke();
    });

    // Legs (covered with petticoat/leggings for traditional look)
    ctx.fillStyle = "#7a6a5c";
    ctx.beginPath();
    ctx.roundRect(-8, 32, 6, legH, 4);
    ctx.roundRect(2, 32, 6, legH, 4);
    ctx.fill();

    // Feet (simple sandals)
    ctx.fillStyle = "#3a2a1f";
    ctx.beginPath(); ctx.ellipse(-6, 90, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6, 90, 8, 3, 0, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
}

function drawWalkingMan(x, y, scale, faceRight) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * (faceRight ? 1 : -1), scale);

    const headR = 16;
    const torsoH = 44;
    const torsoW = 18;
    const legH = 55;
    const armH = 30;
    const walk = Math.sin(Date.now() * 0.008) * 10;

    // Hair (youthful, full coverage)
    const hairGrad = ctx.createLinearGradient(-18, -58, 18, -26);
    hairGrad.addColorStop(0, "#2b1a14");
    hairGrad.addColorStop(1, "#0f0906");
    ctx.fillStyle = hairGrad;
    ctx.beginPath();
    ctx.moveTo(-20, -34);
    ctx.quadraticCurveTo(-10, -64, 2, -66);
    ctx.quadraticCurveTo(16, -64, 22, -46);
    ctx.quadraticCurveTo(24, -34, 12, -30);
    ctx.quadraticCurveTo(2, -26, -12, -28);
    ctx.closePath();
    ctx.fill();

    // Side coverage (no baldness)
    ctx.fillStyle = "#1a100b";
    ctx.beginPath();
    ctx.ellipse(-14, -36, 10, 12, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4, -36, 10, 12, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Top fill to ensure full coverage
    ctx.fillStyle = "#1a100b";
    ctx.beginPath();
    ctx.ellipse(0, -54, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Face (same tone as female)
    const faceGrad = ctx.createRadialGradient(0, -46, 4, 0, -46, 22);
    faceGrad.addColorStop(0, "#e2b08a");
    faceGrad.addColorStop(0.7, "#d29c75");
    faceGrad.addColorStop(1, "#c48a66");
    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.ellipse(1, -45, headR - 3, headR + 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye with highlight
    ctx.fillStyle = "#f6f4f2";
    ctx.beginPath(); ctx.ellipse(6, -48, 5.5, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2c5c77";
    ctx.beginPath(); ctx.arc(7, -48, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0b0b0b";
    ctx.beginPath(); ctx.arc(7, -48, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath(); ctx.arc(6.2, -49.2, 0.9, 0, Math.PI * 2); ctx.fill();

    // Brow
    ctx.strokeStyle = "rgba(50,25,18,0.8)";
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(2, -56); ctx.quadraticCurveTo(8, -60, 14, -56); ctx.stroke();

    // Nose and mouth (profile)
    ctx.strokeStyle = "rgba(120,80,60,0.6)";
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(6, -46); ctx.quadraticCurveTo(12, -43, 8, -38); ctx.stroke();
    ctx.strokeStyle = "rgba(140,80,80,0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(4, -32); ctx.quadraticCurveTo(10, -31, 13, -34); ctx.stroke();

    // Neck
    ctx.fillStyle = "#c48a66";
    ctx.beginPath();
    ctx.roundRect(-5, -27, 10, 10, 4);
    ctx.fill();

    // Shirt
    const shirtGrad = ctx.createLinearGradient(-18, -18, 18, 40);
    shirtGrad.addColorStop(0, "#4f7aa8");
    shirtGrad.addColorStop(1, "#2f4c6e");
    ctx.fillStyle = shirtGrad;
    ctx.beginPath();
    ctx.roundRect(-torsoW / 2, -18, torsoW, torsoH, 6);
    ctx.fill();

    // Arms (swinging)
    ctx.fillStyle = "#d09a75";
    ctx.save();
    ctx.translate(-torsoW / 2 - 4, -4);
    ctx.rotate((-walk * 0.03));
    ctx.roundRect(0, 0, 6, armH, 4);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(torsoW / 2 - 2, -4);
    ctx.rotate((walk * 0.03));
    ctx.roundRect(0, 0, 6, armH, 4);
    ctx.fill();
    ctx.restore();

    // Jeans (walking)
    ctx.fillStyle = "#2b3a55";
    ctx.save();
    ctx.translate(-6, 28);
    ctx.rotate((walk * 0.03));
    ctx.roundRect(0, 0, 6, legH, 4);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(2, 28);
    ctx.rotate((-walk * 0.03));
    ctx.roundRect(0, 0, 6, legH, 4);
    ctx.fill();
    ctx.restore();

    // Shoes
    ctx.fillStyle = "#1f1b16";
    ctx.beginPath(); ctx.ellipse(-3, 90, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6, 90, 8, 3, 0, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
}

function drawPixarWoman(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Soft cinematic rim light
    ctx.shadowColor = "rgba(255, 214, 170, 0.35)";
    ctx.shadowBlur = 18;

    // Full body proportions
    const torsoW = 170;
    const torsoH = 170;
    const headR = 58;

    // Neck
    const neckGrad = ctx.createLinearGradient(0, -90, 0, -40);
    neckGrad.addColorStop(0, "#b87452");
    neckGrad.addColorStop(1, "#a86747");
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.roundRect(-18, -85, 36, 50, 16);
    ctx.fill();

    // Saree / kurti torso with folds
    const clothGrad = ctx.createLinearGradient(-80, -40, 80, 120);
    clothGrad.addColorStop(0, "#7b1424");
    clothGrad.addColorStop(0.5, "#9b1f33");
    clothGrad.addColorStop(1, "#6a0f20");
    ctx.fillStyle = clothGrad;
    ctx.beginPath();
    ctx.moveTo(-90, -40);
    ctx.quadraticCurveTo(0, -90, 90, -40);
    ctx.lineTo(100, 120);
    ctx.quadraticCurveTo(0, 150, -100, 120);
    ctx.closePath();
    ctx.fill();

    // Fabric highlight folds
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 200, 200, 0.25)";
    ctx.lineWidth = 2;
    [-55, -25, 5, 35, 60].forEach((fx, i) => {
        ctx.beginPath();
        ctx.moveTo(fx, -20);
        ctx.quadraticCurveTo(fx + 8, 30 + i * 5, fx - 6, 110);
        ctx.stroke();
    });

    // Blouse sleeve (right)
    const sleeveGrad = ctx.createLinearGradient(60, -30, 120, 40);
    sleeveGrad.addColorStop(0, "#8c1b2e");
    sleeveGrad.addColorStop(1, "#5f0c1c");
    ctx.fillStyle = sleeveGrad;
    ctx.beginPath();
    ctx.ellipse(85, 10, 30, 28, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Waist and saree drape
    const waistGrad = ctx.createLinearGradient(-80, 90, 80, 240);
    waistGrad.addColorStop(0, "#8a1730");
    waistGrad.addColorStop(0.6, "#7a122a");
    waistGrad.addColorStop(1, "#5d0c1f");
    ctx.fillStyle = waistGrad;
    ctx.beginPath();
    ctx.moveTo(-95, 110);
    ctx.quadraticCurveTo(-20, 70, 70, 105);
    ctx.quadraticCurveTo(90, 160, 60, 230);
    ctx.quadraticCurveTo(0, 260, -60, 230);
    ctx.quadraticCurveTo(-90, 170, -95, 110);
    ctx.closePath();
    ctx.fill();

    // Saree pleats
    ctx.strokeStyle = "rgba(255, 210, 210, 0.2)";
    ctx.lineWidth = 2;
    [-50, -30, -10, 10, 30, 50].forEach((px, i) => {
        ctx.beginPath();
        ctx.moveTo(px, 115);
        ctx.quadraticCurveTo(px + 6, 170 + i * 2, px - 5, 235);
        ctx.stroke();
    });

    // Arms
    const skinGrad = ctx.createLinearGradient(60, -5, 110, 90);
    skinGrad.addColorStop(0, "#c18260");
    skinGrad.addColorStop(1, "#a86a4b");
    ctx.fillStyle = skinGrad;
    ctx.beginPath();
    ctx.roundRect(70, 10, 22, 90, 10);
    ctx.fill();

    // Bangle
    ctx.strokeStyle = "rgba(215, 179, 107, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(81, 70, 11, 0, Math.PI * 2); ctx.stroke();

    // Gold jewelry: earrings and bangles
    ctx.fillStyle = "#d7b36b";
    ctx.beginPath(); ctx.arc(-45, -125, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(45, -125, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#caa85e";
    ctx.beginPath(); ctx.arc(70, 55, 10, 0, Math.PI * 2); ctx.strokeStyle = "rgba(255,230,160,0.5)"; ctx.lineWidth = 2; ctx.stroke();

    // Face base with smooth gradient
    const faceGrad = ctx.createRadialGradient(0, -150, 10, 0, -150, 85);
    faceGrad.addColorStop(0, "#c98764");
    faceGrad.addColorStop(0.6, "#b67754");
    faceGrad.addColorStop(1, "#9f6046");
    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.ellipse(0, -145, 58, 68, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soft cheek glow
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#d6917a";
    ctx.beginPath(); ctx.ellipse(-22, -135, 18, 12, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(22, -135, 18, 12, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Hair back volume
    const hairGrad = ctx.createLinearGradient(-80, -210, 80, -60);
    hairGrad.addColorStop(0, "#2a1a14");
    hairGrad.addColorStop(0.5, "#3b261c");
    hairGrad.addColorStop(1, "#1c110c");
    ctx.fillStyle = hairGrad;
    ctx.beginPath();
    ctx.moveTo(-75, -200);
    ctx.quadraticCurveTo(-95, -120, -70, -40);
    ctx.quadraticCurveTo(-20, -10, 0, 10);
    ctx.quadraticCurveTo(20, -10, 70, -40);
    ctx.quadraticCurveTo(100, -120, 75, -200);
    ctx.quadraticCurveTo(0, -240, -75, -200);
    ctx.closePath();
    ctx.fill();

    // Hair front strands
    ctx.fillStyle = "#3a241a";
    ctx.beginPath();
    ctx.moveTo(-60, -195);
    ctx.quadraticCurveTo(-20, -230, 0, -220);
    ctx.quadraticCurveTo(20, -230, 60, -195);
    ctx.quadraticCurveTo(30, -185, 0, -185);
    ctx.quadraticCurveTo(-30, -185, -60, -195);
    ctx.closePath();
    ctx.fill();

    // Eyes (large Pixar-style)
    const eyeWhite = "#f6f4f2";
    ctx.fillStyle = eyeWhite;
    ctx.beginPath(); ctx.ellipse(-22, -150, 18, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(22, -150, 18, 14, 0, 0, Math.PI * 2); ctx.fill();

    // Iris + pupil with highlights
    const irisGradL = ctx.createRadialGradient(-22, -150, 2, -22, -150, 10);
    irisGradL.addColorStop(0, "#2c5c77");
    irisGradL.addColorStop(1, "#1b2f3a");
    ctx.fillStyle = irisGradL;
    ctx.beginPath(); ctx.ellipse(-22, -150, 9, 9, 0, 0, Math.PI * 2); ctx.fill();
    const irisGradR = ctx.createRadialGradient(22, -150, 2, 22, -150, 10);
    irisGradR.addColorStop(0, "#2c5c77");
    irisGradR.addColorStop(1, "#1b2f3a");
    ctx.fillStyle = irisGradR;
    ctx.beginPath(); ctx.ellipse(22, -150, 9, 9, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#0b0b0b";
    ctx.beginPath(); ctx.arc(-22, -150, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(22, -150, 4.5, 0, Math.PI * 2); ctx.fill();

    // Eye highlights
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.arc(-26, -154, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(18, -154, 3, 0, Math.PI * 2); ctx.fill();

    // Eyelashes and brows
    ctx.strokeStyle = "rgba(40,20,16,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-34, -162); ctx.quadraticCurveTo(-22, -170, -10, -162); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -162); ctx.quadraticCurveTo(22, -170, 34, -162); ctx.stroke();

    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-38, -172); ctx.quadraticCurveTo(-22, -180, -6, -172); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -172); ctx.quadraticCurveTo(22, -180, 38, -172); ctx.stroke();

    // Nose and smile
    ctx.strokeStyle = "rgba(110,70,55,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -145); ctx.quadraticCurveTo(4, -135, 0, -128); ctx.stroke();

    ctx.strokeStyle = "rgba(125,70,60,0.7)";
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-18, -112); ctx.quadraticCurveTo(0, -100, 18, -112); ctx.stroke();

    // Lip tint
    ctx.fillStyle = "rgba(175, 86, 86, 0.45)";
    ctx.beginPath(); ctx.ellipse(0, -110, 12, 6, 0, 0, Math.PI * 2); ctx.fill();

    // Bindi
    ctx.fillStyle = "#c62828";
    ctx.beginPath(); ctx.arc(0, -172, 4, 0, Math.PI * 2); ctx.fill();

    // Subtle neck shadow
    ctx.fillStyle = "rgba(60,30,20,0.2)";
    ctx.beginPath(); ctx.ellipse(0, -80, 26, 10, 0, 0, Math.PI * 2); ctx.fill();

    // Legs (full body)
    const legGrad = ctx.createLinearGradient(-25, 230, 25, 360);
    legGrad.addColorStop(0, "#b67654");
    legGrad.addColorStop(1, "#9d5f43");
    ctx.fillStyle = legGrad;
    ctx.beginPath();
    ctx.roundRect(-35, 220, 28, 120, 12);
    ctx.roundRect(5, 220, 28, 120, 12);
    ctx.fill();

    // Feet / sandals
    ctx.fillStyle = "#3e2a1e";
    ctx.beginPath(); ctx.ellipse(-22, 350, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(18, 350, 22, 8, 0, 0, Math.PI * 2); ctx.fill();

    // Saree hem shadow
    ctx.fillStyle = "rgba(30, 10, 10, 0.2)";
    ctx.beginPath(); ctx.ellipse(0, 245, 70, 14, 0, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
}

function drawCharacters(progress) {
    const dividerX = w / 2;
    const groundLevel = h - 100;
    const now = Date.now();
    let maleWalkCycle = 0;
    if (now - animStartTime > 2000) {
        maleWalkCycle = (now - (animStartTime + 2000)) * 0.006;
    }

    const startGap = w * 0.8, endGap = 80;
    const targetGap = startGap - (startGap - endGap) * progress;

    // Initialize characterGap if needed
    if (characterGap === null) characterGap = startGap;
    // Smoothly ease gap toward target so male appears to walk toward the partner
    characterGap += (targetGap - characterGap) * 0.06;

    // Compute male walk cycle speed and normalization
    // maleWalkCycle is used as phase for sin/cos; keep scaling for readable speed
    const maleCycle = maleWalkCycle;

    // Characters removed per user request. This is intentionally a no-op.
    // Kept as a stub so existing calls elsewhere do not need changes.
    return;
}

function drawLockAndTimer(progress) {
    const lockX = w / 2;
    const lockY = 100; // Moved down to avoid overlap with timer text
    const isLocked = progress < 1;

    ctx.save();
    ctx.strokeStyle = 'white'; // White color
    ctx.fillStyle = 'white';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "white"; // White glow

    // Shackle
    ctx.beginPath();
    if (isLocked) {
        ctx.arc(lockX, lockY, 15, Math.PI, 0);
    } else {
        // Unlocked animation
        ctx.save();
        ctx.translate(lockX - 15, lockY);
        ctx.rotate(-Math.PI / 4);
        ctx.arc(15, 0, 15, Math.PI, 0);
        ctx.restore();
    }
    ctx.stroke();

    // Body
    ctx.beginPath();
    const bodyPath = new Path2D();
    bodyPath.roundRect(lockX - 22, lockY, 44, 30, 5);
    ctx.fill(bodyPath);

    // Keyhole
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(lockX, lockY + 15, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function handleIntroText() {
    const now = Date.now();
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, w, h);

    // Wrap text logic
    ctx.font = "22px 'Georgia', serif";
    const maxWidth = w * 0.8;
    const words = introText.split(' ');
    let lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        let word = words[i];
        let width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);

    // Typewriter Logic
    if (introState.phase === 'typing') {
        if (now - introState.lastUpdate > 50) {
            introState.charIndex++;
            introState.lastUpdate = now;
        }
        if (introState.charIndex >= introText.length) {
            introState.charIndex = introText.length;
            introState.phase = 'waiting';
            introState.completeTime = now;
        }
    } else if (introState.phase === 'waiting') {
        if (now - introState.completeTime > 6000) {
            gameState = 'SCENE_BUILDUP';
            animStartTime = now;
        }
    }

    // Draw
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    let y = h / 2 - (lines.length * 30) / 2;
    let charsRemaining = introState.charIndex;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (charsRemaining <= 0) break;
        
        let stringToDraw = "";
        if (charsRemaining >= line.length) {
            stringToDraw = line;
            charsRemaining -= (line.length + 1); // +1 for space/newline
        } else {
            stringToDraw = line.substring(0, charsRemaining);
            charsRemaining = 0;
        }
        ctx.fillText(stringToDraw, w / 2, y);
        y += 30;
    }
}

function handleSceneBuildup() {
    const now = Date.now();
    const elapsed = now - animStartTime;

    // Animate alphas over 3 seconds
    if (elapsed < 1000) { // 0-1s: Sky fades in
        sceneBuildupState.sky = elapsed / 1000;
    } else if (elapsed < 2000) { // 1-2s: Ground fades in
        sceneBuildupState.sky = 1;
        sceneBuildupState.ground = (elapsed - 1000) / 1000;
    } else if (elapsed < 3000) { // 2-3s: Chars fade in
        sceneBuildupState.sky = 1;
        sceneBuildupState.ground = 1;
        sceneBuildupState.chars = (elapsed - 2000) / 1000;
    } else {
        // Buildup complete, transition to journey
        gameState = 'JOURNEY';
        animStartTime = now; // Reset timer for journey
        return;
    }

    // Draw components with their current alpha
    ctx.globalAlpha = sceneBuildupState.sky;
    drawSky();
    ctx.globalAlpha = 1;
    
    ctx.globalAlpha = sceneBuildupState.ground;
    drawGroundElements();
    ctx.globalAlpha = 1;

    ctx.globalAlpha = sceneBuildupState.chars;
    drawCharacters(0); // progress is 0, they are standing still
    ctx.globalAlpha = 1;
}

function animate() {
    const now = Date.now();
    const timeLeft = targetDate - now;

    // Safeguard: Always clear the canvas to black first.
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, w, h);

    if (timeLeft <= 0 && gameState !== 'REVEAL') {
        gameState = 'REVEAL';
        animStartTime = now;
    }

    switch (gameState) {
        case 'INTRO_TEXT':
            timerElement.style.opacity = '0'; // Ensure hidden
            handleIntroText();
            break;
        case 'SCENE_BUILDUP':
            timerElement.style.opacity = '0'; // Ensure hidden
            handleSceneBuildup();
            break;
        case 'JOURNEY':
            timerElement.style.opacity = '1'; // Show
            const totalDuration = targetDate - startDate;
            const progress = Math.min(1, Math.max(0, 1 - (timeLeft / totalDuration)));
            
            drawSky();
            drawGroundElements();
            drawCharacters(progress);
            drawLockAndTimer(progress);

            const d = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const h_ = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((timeLeft % (1000 * 60)) / 1000);
            const pad = (num) => String(num).padStart(2, '0');
            timerElement.innerText = `${d} : ${pad(h_)} : ${pad(m)} : ${pad(s)}`;
            break;
        case 'REVEAL':
            if (timerElement.style.opacity !== "0") timerElement.style.opacity = "0";
            
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
        
        if (Math.random() < 0.05) {
            createFirework(Math.random() * w, Math.random() * h * 0.5);
        }
        updateFireworks();

            if (limit >= pieces.length) {
                drawLockAndTimer(1.1); // Draw unlocked lock on top of finished image
            }
            break;
    }
    requestAnimationFrame(animate);
}

function drawCharacterSilhouette() {
    // Removed per user request. This stub prevents errors from other calls.
}

// Character drawing functions removed per user request


init(); // Start animation logic immediately
window.addEventListener('resize', resize);
function resize() { 
    w = canvas.width = window.innerWidth; 
    h = canvas.height = window.innerHeight; 

    // Re-create dimension-dependent assets
    const numBuildings = 70;
    buildings = Array.from({ length: numBuildings }, (_, i) => {
        const bH = 100 + Math.random() * (h * 0.4);
        const bW = 40 + Math.random() * 80;
        const wins = [];
        // Generate windows (spacing will be adjusted on respawn too)
        for(let yy = 20; yy < bH - 20; yy += 20) {
            for(let xx = 10; xx < bW - 10; xx += 15) {
                if(Math.random() > 0.7) wins.push({x: xx, y: yy});
            }
        }

        // Distribute buildings across the width to avoid clustering
        const band = w / numBuildings;
        const bx = Math.max(0, Math.min(w - bW, i * band + Math.random() * band * 0.6 - band * 0.1));
        let color;
        if (bx + bW/2 < w / 2) {
            // Male/left side: vibrant, warmer palette
            const hue = Math.floor(Math.random() * 60); // reds/yellows/greens
            const sat = 60 + Math.floor(Math.random() * 20);
            const light = 30 + Math.floor(Math.random() * 25);
            color = `hsl(${hue}, ${sat}%, ${light}%)`;
        } else {
            // Right side: city tones but not too dark
            const light = 20 + Math.floor(Math.random() * 25);
            color = `hsl(230, 20%, ${light}%)`;
        }

        const typeRoll = Math.random();
        let type;
        if (typeRoll < 0.6) type = 'rect';
        else if (typeRoll < 0.85) type = 'stepped';
        else type = 'spire';

        return { x: bx, h: bH, w: bW, windows: wins, color: color, type: type };
    });

    // Fireflies
    fireflies = Array.from({ length: 15 }, () => ({
        offsetX: (Math.random() - 0.5) * 100,
        offsetY: -100 + (Math.random() - 0.5) * 50,
        phase: Math.random() * Math.PI * 2,
        speed: 0.002 + Math.random() * 0.002
    }));

    // Stars (persistent per side) - positions normalized [0..1]
    const makeStars = (count) => Array.from({ length: count }, () => ({
        x: Math.random(),
        y: 0.02 + Math.random() * 0.6,
        r: Math.random() * 1.6 + 0.3,
        a: 0.4 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2
    }));
    stars.left = makeStars(80);
    stars.right = makeStars(80);

    // Birds
    birds = Array.from({ length: 6 }, () => ({
        x: w * 0.5 + Math.random() * (w * 0.5), // Start on right side
        y: Math.random() * h * 0.6,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        state: 'flying', // 'flying', 'landing', 'perched'
        target: null,
        timer: 0
    }));
}
