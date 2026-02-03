// const start = new Date().getTime();
// const end = start + 15000; 
const start = new Date().getTime(); // The journey's progress starts from the moment you open the page
const end = new Date("March 1, 2026 00:00:00").getTime();

let canvas, ctx, w, h;
let buildings = [];
let fireworks = [];
let stars = [];
let shootingStars = [];
let particles = [];
let animStartTime;
let currentText = "";
const fullMessage = "Every day at 5 PM CST, our song plays... I'm almost there.";
let charIndex = 0;
let lastTextUpdate = 0;

// Initialize building positions for the moving side
for(let i = 0; i < 15; i++) {
    let bh = 200 + Math.random() * 300;
    let bw = 60 + Math.random() * 120;
    let wins = [];
    for(let wy = 20; wy < bh - 20; wy += 30) {
        for(let wx = 10; wx < bw - 10; wx += 20) {
            if(Math.random() > 0.3) wins.push({x: wx, y: wy});
        }
    }
    buildings.push({
        x: i * 200,
        width: bw,
        height: bh,
        color: `hsl(220, 30%, ${10 + Math.random() * 10}%)`,
        windows: wins
    });
}

setTimeout(() => { document.getElementById('splash').style.display = 'none'; document.getElementById('intro').style.display = 'flex'; }, 4000);
setTimeout(() => { document.getElementById('intro').style.display = 'none'; init(); }, 8000);

function init() {
    canvas = document.getElementById("scene");
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener('resize', resize);
    animStartTime = new Date().getTime();
    requestAnimationFrame(render);
}

function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    stars = [];
    for(let i=0; i<200; i++) {
        stars.push({x: Math.random()*w, y: Math.random()*h*0.7, s: Math.random()*1.5, a: Math.random()});
    }
}

function render() {
    const now = new Date().getTime();
    const storyTime = now - animStartTime;
    let progress = Math.min(Math.max((now - start) / (end - start), 0), 1);

    // END SEQUENCE: The Wait Is Over
    if (progress >= 1) {
        // 1. Sky
        drawSky();

        // Stars
        drawStars(false);

        // 2. Fireworks
        if (Math.random() < 0.1) createFirework();
        updateFireworks();
        updateShootingStars();
        updateParticles();

        // 3. Static Ground (Girl's World)
        const gGrd = ctx.createLinearGradient(0, h - 100, 0, h);
        gGrd.addColorStop(0, '#1a1a1a');
        gGrd.addColorStop(1, '#000');
        ctx.fillStyle = gGrd;
        ctx.fillRect(0, h - 100, w, 100);
        
        // Reflection on ground
        ctx.fillStyle = "rgba(242, 120, 159, 0.1)";
        ctx.fillRect(0, h-100, w, 100);

        // Aura Effect
        const aura = ctx.createRadialGradient(w/2, h - 150, 10, w/2, h - 150, 120);
        aura.addColorStop(0, "rgba(255, 255, 220, 0.5)");
        aura.addColorStop(0.5, "rgba(255, 200, 100, 0.2)");
        aura.addColorStop(1, "rgba(255, 200, 100, 0)");
        ctx.fillStyle = aura;
        ctx.beginPath(); ctx.arc(w/2, h - 150, 120, 0, Math.PI*2); ctx.fill();

        // 4. Hugging (Center Screen)
        // Male (Left of center)
        drawOrganicHuman(w/2 - 15, h - 80, 0, 1.3, true);
        // Female (Right of center)
        drawOrganicHuman(w/2 + 15, h - 80, 0, 1.3, false);

        // 5. Text
        document.getElementById("timer").innerHTML = "THE WAIT IS OVER";
        
        requestAnimationFrame(render);
        return;
    }

    // --- STORYBOARD LOGIC ---
    
    // Phase 1: Static Split Screen (Waiting)
    let dividerX = w / 2;
    let maleX = w / 4;
    
    let pose = "stand";
    let isWalking = false;
    let walkAnimTime = 0;
    let citySpeed = 0;
    const legSwing = (pose === 'walk') ? Math.sin(walkAnimTime * 10) * 30 : 0;

    if (storyTime < 2000) {
        pose = "stand";
    } else if (storyTime < 6000) {
        pose = "watch";
    } else {
        pose = "walk";
        isWalking = true;
        const walkDuration = now - (animStartTime + 6000);
        const speedRamp = Math.min(walkDuration / 3000, 1); // Ramp up over 3s
        citySpeed = 1.5 * speedRamp; // Max speed 1.5 (slower overall) 
        walkAnimTime = walkDuration * 0.004; // Slower leg animation
    }

    // 1. Unified Sky (Drawn across the whole screen)
    drawSky();
    drawStars(isWalking);

    // 2. MALE SIDE (The Solo Traveler)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, dividerX, h);
    ctx.clip();

    // Moving Background (Buildings)
    drawMovingCity(progress, citySpeed);
    
    // Ground
    const gGrd = ctx.createLinearGradient(0, h - 100, 0, h);
    gGrd.addColorStop(0, '#1a1a1a');
    gGrd.addColorStop(1, '#000');
    ctx.fillStyle = gGrd;
    ctx.fillRect(0, h - 100, w, 100);
    
    // Male Animation
    drawOrganicHuman(maleX, h - 80, legSwing, 1.3, true);

    // Act III: Thinking Text (Typewriter)
    if (pose === "watch") {
        updateThought(maleX, h - 80, now);
    }

    ctx.restore();

    // 3. FEMALE SIDE (The Reveal)
    if (dividerX < w) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(dividerX, 0, w - dividerX, h);
        ctx.clip();

        // Static Ground
        const gGrd = ctx.createLinearGradient(0, h - 100, 0, h);
        gGrd.addColorStop(0, '#1a1a1a');
        gGrd.addColorStop(1, '#000');
        ctx.fillStyle = gGrd;
        ctx.fillRect(0, h - 100, w, 100);

        // Female Animation (Standing still/Waiting)
        drawOrganicHuman(w * 0.75, h - 80, 0, 1.3, false);
        
        // Draw the Divider Line
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dividerX, 0);
        ctx.lineTo(dividerX, h);
        ctx.stroke();
        
        ctx.restore();
    }

    // Global Overlay Effects (Shared Air)
    updateShootingStars();
    updateParticles();

    updateTimer(now);
    requestAnimationFrame(render);
}

function drawStars(isMoving) {
    ctx.fillStyle = "white";
    stars.forEach(st => {
        if (isMoving) {
            st.x -= st.s * 0.3; // Parallax: larger (closer) stars move faster
            if (st.x < 0) st.x = w;
        }
        ctx.globalAlpha = st.a * (0.5 + Math.sin(Date.now() * 0.003 + st.x) * 0.5);
        ctx.beginPath(); ctx.arc(st.x, st.y, st.s, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function updateParticles() {
    // Fireflies / Petals logic (Drifting across divider)
    if(particles.length < 40) {
        particles.push({
            x: Math.random() * w, 
            y: Math.random() * (h - 50), 
            vx: 0.2 + Math.random() * 0.5, 
            vy: (Math.random() - 0.5) * 0.2, 
            life: 1,
            size: 1 + Math.random() * 2
        });
    }
    
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#fff59d"; // Glow
    ctx.fillStyle = "rgba(255, 245, 157, 0.6)"; // Light yellow/white

    particles.forEach((p, i) => {
        p.x += p.vx; 
        p.y += p.vy + Math.sin(Date.now() * 0.002 + p.x) * 0.2; 
        p.life = 0.5 + Math.sin(Date.now() * 0.005 + p.x * 0.1) * 0.5; // Blink

        // Wrap around
        if(p.x > w) p.x = -10;
        if(p.y > h) p.y = 0;
        if(p.y < 0) p.y = h;

        ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

function updateShootingStars() {
    if (Math.random() < 0.01) {
        shootingStars.push({
            x: Math.random() * w * 0.6, y: Math.random() * h * 0.4,
            vx: 15 + Math.random() * 10, vy: 2 + Math.random() * 2,
            len: 0, life: 1
        });
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"; ctx.lineWidth = 2; ctx.lineCap = "round";
    shootingStars.forEach((ss, i) => {
        ss.x += ss.vx; ss.y += ss.vy; ss.len = Math.min(ss.len + 5, 150); ss.life -= 0.02;
        if (ss.life > 0) { ctx.globalAlpha = ss.life; ctx.beginPath(); ctx.moveTo(ss.x, ss.y); ctx.lineTo(ss.x - ss.vx * (ss.len/20), ss.y - ss.vy * (ss.len/20)); ctx.stroke(); } else { shootingStars.splice(i, 1); }
    });
    ctx.globalAlpha = 1;
}

function drawMovingCity(progress, speed) {
    // Speed is now passed in directly
    
    // Fade out buildings near the end to transition to Girl's static screen
    let alpha = 1;
    if (progress > 0.8) alpha = 1 - (progress - 0.8) * 5;
    ctx.globalAlpha = Math.max(0, alpha);

    buildings.forEach(b => {
        if (progress < 1) b.x -= speed; // Stop moving when reached
        if (b.x + b.width < 0) b.x = w; // Loop back to start
        
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, h - 100 - b.height, b.width, b.height);
        
        // Windows
        ctx.fillStyle = "rgba(255, 236, 179, 0.6)"; // Warm light
        b.windows.forEach(win => ctx.fillRect(b.x + win.x, h - 100 - b.height + win.y, 10, 14));
    });
    ctx.globalAlpha = 1;
}

function updateTimer(now) {
    const diff = end - now;
    if (diff <= 0) {
        document.getElementById("timer").innerHTML = "THE WAIT IS OVER";
        return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    document.getElementById("timer").innerHTML = `${d}D ${h}H ${m}M ${s}S`;
}

// High-Detail Vector Shapes
const BOY_JACKET = "M-12,-80 Q0,-92 18,-80 L14,-35 Q0,-30 -10,-35 Z";
const GIRL_DRESS = "M-8,-80 Q5,-82 12,-75 L22,-20 Q0,-15 -18,-20 Z";
const CARTOON_HEAD = "M0,-85 Q-4,-105 6,-118 Q18,-118 20,-105 Q24,-100 20,-95 Q18,-85 5,-85 Z";

function drawOrganicHuman(x, y, swing, s, isMale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(isMale ? s : -s, s);

    const skin = isMale ? "#8d5524" : "#c68642";
    const clothes = isMale ? "#8b5a2b" : "#ff85a2"; // Brown jacket vs Pink dress
    
    // 1. Legs (Animated)
    drawLimb(ctx, swing, isMale ? "#3b5998" : skin, false); 
    drawLimb(ctx, -swing, isMale ? "#3b5998" : skin, false, true); 

    // 2. Torso
    ctx.fillStyle = clothes;
    ctx.fill(new Path2D(isMale ? BOY_JACKET : GIRL_DRESS));

    // 3. Head & Face
    ctx.fillStyle = skin;
    ctx.fill(new Path2D(CARTOON_HEAD));
    
    // Eyes with white reflection
    ctx.fillStyle = "black";
    ctx.beginPath(); ctx.arc(14, -104, 2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "white";
    ctx.beginPath(); ctx.arc(14.5, -104.5, 0.7, 0, Math.PI*2); ctx.fill();

    // 4. Hair
    ctx.fillStyle = isMale ? "#1a1110" : "#000";
    if(isMale) {
        // Puffy Curly Hair Clusters
        for(let i=0; i<8; i++) {
            ctx.beginPath(); ctx.arc(-2 + (i*4), -115 + (i%2*4), 12, 0, Math.PI*2); ctx.fill();
        }
    } else {
        // Flowing Hair
        ctx.fill(new Path2D("M-14,-105 L-18,-20 Q15,-30 10,-115 Z"));
    }

    // 5. Arms
    drawLimb(ctx, -swing * 0.8, clothes, true, false, skin);

    ctx.restore();
}

function drawLimb(ctx, angle, color, isArm, isBack = false, skin) {
    ctx.save();
    ctx.translate(isArm ? 5 : 0, isArm ? -78 : -35);
    ctx.rotate(angle * Math.PI / 180);
    if(isBack) ctx.filter = "brightness(0.7)";
    ctx.fillStyle = color;
    ctx.fill(new Path2D("M-5,0 L5,0 Q7,18 4,38 L-4,38 Q-6,18 -5,0 Z"));
    if(isArm) { ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, 40, 5, 0, Math.PI*2); ctx.fill(); }
    ctx.restore();
}

function updateThought(mPosX, mPosY, time) {
    if (time - lastTextUpdate > 50) { // Control speed of typewriter
        if (charIndex < fullMessage.length) {
            currentText += fullMessage[charIndex];
            charIndex++;
        }
        lastTextUpdate = time;
    }

    // Draw Bubble
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(mPosX - 120, mPosY - 250, 240, 80, 20);
    ctx.fill();
    ctx.stroke();

    // Draw Text
    ctx.fillStyle = "white";
    ctx.font = "italic 16px Courier New";
    ctx.textAlign = "center";
    ctx.fillText(currentText, mPosX, mPosY - 205);
}

function drawSky() {
    const skyGrd = ctx.createLinearGradient(0, 0, 0, h);
    skyGrd.addColorStop(0, '#1a1a2e'); // Deep Midnight
    skyGrd.addColorStop(0.5, '#4a1e4d'); // Purple
    skyGrd.addColorStop(1, '#ff85a2'); // Pink Sunset
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, w, h);

    // Glowing Moon
    ctx.save();
    ctx.shadowBlur = 40;
    ctx.shadowColor = "rgba(255,255,255,0.8)";
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(w * 0.8, h * 0.2, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// Fireworks Logic
function createFirework() {
    fireworks.push({
        x: Math.random() * w,
        y: h,
        targetY: h/4 + Math.random() * (h/2),
        color: `hsl(${Math.random() * 360}, 100%, 60%)`,
        particles: []
    });
}

function updateFireworks() {
    fireworks.forEach((fw, i) => {
        if (fw.particles.length === 0 && fw.y > fw.targetY) {
            // Launching up
            fw.y -= 10; 
            ctx.fillStyle = fw.color;
            ctx.fillRect(fw.x, fw.y, 4, 10);
        } else if (fw.particles.length === 0) {
            // Explode
            for(let j=0; j<30; j++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 6;
                fw.particles.push({ x: fw.x, y: fw.y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, life: 1 });
            }
        } else {
            // Particles falling
            fw.particles.forEach(p => {
                p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= 0.02;
                ctx.fillStyle = fw.color; ctx.globalAlpha = p.life;
                ctx.fillRect(p.x, p.y, 3, 3);
            });
            ctx.globalAlpha = 1;
            fw.particles = fw.particles.filter(p => p.life > 0);
            if(fw.particles.length === 0) fireworks.splice(i, 1);
        }
    });
}