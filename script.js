const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const timerElement = document.getElementById('timer');

const img = new Image();
img.src = 'image1.png';

const targetDate = new Date("March 1, 2026 00:00:00 GMT-0600").getTime();
const startDate = new Date("February 1, 2026 00:00:00 GMT-0600").getTime();

let w, h, buildings = [], fireflies = [], smokeParticles = [], birds = [], fireworks = [], stars = { left: [], right: [] };
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

// Utility: lighten an `hsl(h, s%, l%)` color string by `add` percent (clamped)
function lightenHSL(hslStr, add) {
    const m = /hsl\((\d+),\s*(\d+)%\s*,\s*(\d+)%\)/i.exec(hslStr);
    if (!m) return hslStr;
    let h = Number(m[1]);
    let s = Number(m[2]);
    let l = Number(m[3]);
    l = Math.min(90, l + add);
    return `hsl(${h}, ${s}%, ${l}%)`;
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
    if (isDay) {
        skyGrd.addColorStop(0, '#87CEEB'); // Light Blue
        skyGrd.addColorStop(1, '#FFD700'); // Golden
    } else {
        skyGrd.addColorStop(0, '#000000'); // Black
        skyGrd.addColorStop(1, '#000000'); // Black
    }
    ctx.fillStyle = skyGrd;
    ctx.fillRect(x, y, width, height);

    // 2. Celestial Body (Sun/Moon)
    const celestialY = y + height * 0.2;

    if (isDay) {
        let sunX = x + width * 0.5;
        let sunY = celestialY;
        if (data && data.sunrise && data.sunset) {
            const progress = (now - data.sunrise) / (data.sunset - data.sunrise);
            sunX = x + (width * 0.1) + (width * 0.8 * progress);
            sunY = celestialY + Math.sin(progress * Math.PI) * -50;
        }
        
        ctx.fillStyle = "#FDB813";
        ctx.shadowBlur = 20; ctx.shadowColor = "#FDB813";
        ctx.beginPath();
        ctx.arc(sunX, sunY, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
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
        // Clouds
        if (data && (data.main === 'Clouds' || data.main === 'Rain' || data.main === 'Snow')) {
            if (pSystem.clouds.length < 4) { // Fewer, more distinct clouds
                pSystem.clouds.push({ x: x - 100, y: y + Math.random() * 100, w: 80 + Math.random()*50, speed: 0.1 + Math.random() * 0.2 });
            }
            ctx.fillStyle = "rgba(200, 200, 200, 0.4)";
            pSystem.clouds.forEach((c, i) => {
                c.x += c.speed;
                if (c.x - c.w > x + width) c.x = x - c.w;
                ctx.beginPath();
                ctx.arc(c.x, c.y, c.w * 0.4, 0, Math.PI * 2); // Center
                ctx.arc(c.x + c.w * 0.3, c.y + c.w * 0.1, c.w * 0.3, 0, Math.PI * 2); // Right
                ctx.arc(c.x - c.w * 0.3, c.y + c.w * 0.1, c.w * 0.3, 0, Math.PI * 2); // Left
                ctx.arc(c.x, c.y - c.w * 0.2, c.w * 0.3, 0, Math.PI * 2); // Top
                ctx.fill();
            });
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

    const dataLeft = weatherData.left;
    const dataRight = weatherData.right;
    const now = Date.now();
    const currentHour = new Date().getHours();
    let isNightLeft = (currentHour < 6 || currentHour >= 18);
    if (dataLeft && dataLeft.sunrise && dataLeft.sunset) {
        isNightLeft = (now < dataLeft.sunrise || now > dataLeft.sunset);
    }
    let isNightRight = (currentHour < 6 || currentHour >= 18);
    if (dataRight && dataRight.sunrise && dataRight.sunset) {
        isNightRight = (now < dataRight.sunrise || now > dataRight.sunset);
    }

    // Clip building drawing to the left side
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, dividerX, h);
    ctx.clip();

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
        
            // Draw windows (always). Size scales with building so they don't mix.
            const winW = Math.max(3, Math.floor(b.w / 10));
            const winH = Math.max(3, Math.floor(b.h / 15));
            // Window glow: night windows warm and slightly blurred, day windows faint
            b.windows.forEach(win => {
                const wx = Math.round(b.x + win.x);
                const wy = Math.round(groundY + win.y);
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

    // Right-side village (female side) - rural, retro village style
    ctx.save();
    ctx.beginPath();
    ctx.rect(dividerX, 0, w - dividerX, h);
    ctx.clip();

    // Fields
    const villageX = dividerX + 20;
    const villageW = w - villageX - 40;
    ctx.fillStyle = '#203b10';
    ctx.fillRect(villageX, groundLevel - 40, villageW, 40);
    // Crop lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
        const lx = villageX + (i / 10) * villageW;
        ctx.beginPath(); ctx.moveTo(lx, groundLevel - 40); ctx.lineTo(lx + 6, groundLevel); ctx.stroke();
    }

    // Ponds / water
    ctx.fillStyle = '#0b3b6f';
    ctx.beginPath(); ctx.ellipse(villageX + villageW * 0.18, groundLevel - 10, 40, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#06314f'; ctx.beginPath(); ctx.ellipse(villageX + villageW * 0.18, groundLevel - 10, 30, 12, 0, 0, Math.PI * 2); ctx.fill();

    // Huts positions
    const huts = [villageX + villageW * 0.12, villageX + villageW * 0.45, villageX + villageW * 0.78];
    huts.forEach((hx, idx) => {
        const hutW = 80 - idx * 8;
        const hutH = 50 + idx * 10;
        const hutY = groundLevel - hutH;

        // Hut body (mud)
        ctx.fillStyle = '#ad7b4b';
        ctx.beginPath(); ctx.ellipse(hx, hutY + hutH / 2, hutW * 0.6, hutH / 1.1, 0, 0, Math.PI * 2); ctx.fill();

        // Thatched roof
        ctx.fillStyle = '#b57f2a';
        ctx.beginPath(); ctx.moveTo(hx - hutW * 0.7, hutY + 4); ctx.lineTo(hx, hutY - hutH * 0.4); ctx.lineTo(hx + hutW * 0.7, hutY + 4); ctx.closePath(); ctx.fill();

        // Door
        ctx.fillStyle = '#5b3a24'; ctx.fillRect(hx - 12, hutY + hutH / 4, 24, hutH / 2);

        // Small window
        ctx.fillStyle = isNightRight ? 'rgba(255,220,150,0.9)' : 'rgba(240,245,250,0.25)';
        ctx.fillRect(hx + hutW * 0.2, hutY + hutH / 6, 12, 12);

        // Smoke from small earthen stove
        if (Math.random() < 0.02) updateSmoke(hx + 8, hutY - 10);
    });

    // Lanterns / ambient lights
    const lanterns = [villageX + villageW * 0.28, villageX + villageW * 0.6];
    lanterns.forEach((lx, i) => {
        const ly = groundLevel - 70 - (i * 8);
        ctx.fillStyle = isNightRight ? 'rgba(255,180,80,0.95)' : 'rgba(255,200,120,0.45)';
        ctx.beginPath(); ctx.arc(lx, ly, 6, 0, Math.PI * 2); ctx.fill();
        // glow
        if (isNightRight) {
            const g = ctx.createRadialGradient(lx, ly, 6, lx, ly, 40);
            g.addColorStop(0, 'rgba(255,180,80,0.6)'); g.addColorStop(1, 'rgba(255,180,80,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, 40, 0, Math.PI * 2); ctx.fill();
        }
    });

    ctx.restore();

    // Draw Rural Hut (female side centerpiece)
    const hutX = w * 0.75;
    const hutY = groundLevel;
    // Hut body (rounded mud)
    ctx.fillStyle = '#a66e3a';
    ctx.beginPath(); ctx.ellipse(hutX, hutY - 60, 70, 55, 0, 0, Math.PI * 2); ctx.fill();

    // Thatched roof
    ctx.fillStyle = '#b8862b';
    ctx.beginPath(); ctx.moveTo(hutX - 80, hutY - 90); ctx.lineTo(hutX, hutY - 140); ctx.lineTo(hutX + 80, hutY - 90); ctx.closePath(); ctx.fill();

    // Small stove pot and smoke
    ctx.fillStyle = '#5b3a24'; ctx.fillRect(hutX + 45, hutY - 110, 10, 18);
    updateSmoke(hutX + 50, hutY - 112);

    // Door and window
    ctx.fillStyle = '#4a2f1b'; ctx.fillRect(hutX - 18, hutY - 40, 36, 50);
    ctx.fillStyle = isNightRight ? 'rgba(255,220,150,0.9)' : 'rgba(230,240,255,0.22)';
    ctx.fillRect(hutX + 28, hutY - 60, 14, 14);

    // Garden with White Flowers
    ctx.fillStyle = "#2e7d32"; // Green bed
    ctx.beginPath();
    ctx.ellipse(houseX + 60, houseY + 5, 70, 10, 0, 0, Math.PI*2);
    ctx.fill();

    for(let i=0; i<12; i++) {
        const fx = houseX + 10 + (i * 9) + Math.sin(i*99)*5;
        const fy = houseY + 2 + Math.cos(i*50)*3;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(fx, fy, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#ffd700"; 
        ctx.beginPath(); ctx.arc(fx, fy, 1, 0, Math.PI*2); ctx.fill();
    }

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
    updateFireflies(treeX, treeY);

    // Birds
    updateBirds();

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
    const currentGap = startGap - (startGap - endGap) * progress;
    drawCharacterSilhouette(dividerX - currentGap / 2, groundLevel, 0.8, true, maleWalkCycle);
    drawCharacterSilhouette(dividerX + currentGap / 2, groundLevel, 0.8, false, 0);
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