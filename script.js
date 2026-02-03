// DEMO MODE: Timer runs for 15 seconds starting now
const start = new Date().getTime();
const end = start + 15000; 
// const start = new Date("February 2, 2026 00:00:00").getTime();
// const end = new Date("March 1, 2026 00:00:00").getTime();

let canvas, ctx, w, h;
let buildings = [];
let fireworks = [];
let stars = [];
let shootingStars = [];
let particles = [];

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

setTimeout(() => { document.getElementById('splash').style.display = 'none'; init(); }, 4000);

function init() {
    canvas = document.getElementById("scene");
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener('resize', resize);
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
    let progress = Math.min(Math.max((now - start) / (end - start), 0), 1);

    // END SEQUENCE: The Wait Is Over
    if (progress >= 1) {
        // 1. Sky
        const skyGrd = ctx.createLinearGradient(0, 0, 0, h);
        skyGrd.addColorStop(0, '#101725'); 
        skyGrd.addColorStop(0.7, '#f2789f'); 
        skyGrd.addColorStop(1, '#f999b9'); 
        ctx.fillStyle = skyGrd;
        ctx.fillRect(0, 0, w, h);

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
        drawOrganicHuman(w/2 - 12, h - 100, 0, 1.2, true, true);
        // Female (Right of center)
        drawOrganicHuman(w/2 + 12, h - 100, 0, 1.2, false, true);

        // 5. Text
        document.getElementById("timer").innerHTML = "THE WAIT IS OVER";
        
        requestAnimationFrame(render);
        return;
    }

    // 1. Unified Sky (Drawn across the whole screen)
    const skyGrd = ctx.createLinearGradient(0, 0, 0, h);
    skyGrd.addColorStop(0, '#101725'); 
    skyGrd.addColorStop(0.7, '#f2789f'); 
    skyGrd.addColorStop(1, '#f999b9'); 
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, w, h);
    
    // Draw Stars & Moon
    drawStars(progress < 1);
    ctx.shadowBlur = 30; ctx.shadowColor = "white";
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(w*0.85, h*0.15, 40, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    const dividerX = (w / 2) + ((w / 2) * progress); // Moves right as time goes on
    const isMerged = progress >= 0.99;

    // 2. MALE SIDE (Moving World)
    ctx.save();
    if (!isMerged) {
        ctx.beginPath();
        ctx.rect(0, 0, dividerX, h);
        ctx.clip();
    }

    // Moving Background (Buildings)
    drawMovingCity(progress);
    
    // Ground
    const gGrd = ctx.createLinearGradient(0, h - 100, 0, h);
    gGrd.addColorStop(0, '#1a1a1a');
    gGrd.addColorStop(1, '#000');
    ctx.fillStyle = gGrd;
    ctx.fillRect(0, h - 100, w, 100);
    
    // Male Animation
    const time = Date.now() * 0.005;
    const legSwing = Math.sin(time) * 20;
    const bodyBob = Math.abs(Math.cos(time)) * 4;
    
    // Male position: stays in place relative to the screen, but buildings move
    const mPosX = isMerged ? (w/2 - 50 + (progress * 40)) : (w / 4);
    drawOrganicHuman(mPosX, h - 100 - bodyBob, legSwing, 1.2, true);
    ctx.restore();

    // 3. FEMALE SIDE (Static World)
    if (!isMerged) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(dividerX, 0, w - dividerX, h);
        ctx.clip();

        // Static Ground
        ctx.fillStyle = gGrd;
        ctx.fillRect(0, h - 100, w, 100);

        // Female Animation (Standing still/Waiting)
        drawOrganicHuman(w * 0.75, h - 100, 0, 1.2, false);
        
        // Draw the Divider Line
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(dividerX, 0); ctx.lineTo(dividerX, h);
        ctx.stroke();
        
        ctx.restore();
    } else {
        // When merged, just draw the Female in the unified world
        drawOrganicHuman(w/2 + 50, h - 100, 0, 1.2, false);
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

function drawMovingCity(progress) {
    const speed = 2; // Speed of the buildings
    
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

// Organic Human Drawing Logic (Reuse the high-quality function)
function drawOrganicHuman(x, y, swing, s, isMale, isHugging = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(isMale ? s : -s, s); // Female faces left

    const skin = isMale ? "#8d5524" : "#c68642";
    
    // Torso
    ctx.fillStyle = isMale ? "#5d4037" : "#ff4d6d";
    ctx.beginPath();
    if (isMale) {
        ctx.roundRect(-10, -80, 20, 45, 5); 
        ctx.fill();
        // Sweater detail
        ctx.fillStyle = "#f5f5f5"; ctx.fillRect(2, -75, 5, 35);
        ctx.fillStyle = "#1a237e"; ctx.fillRect(2, -65, 5, 4);
    } else {
        ctx.moveTo(-12, -35); ctx.lineTo(12, -35); ctx.lineTo(0, -80); ctx.fill();
    }

    // Legs
    ctx.fillStyle = isMale ? "#3b5998" : "#333";
    ctx.fillRect(-6 + (swing/4), -35, 7, 35);
    ctx.fillRect(1 - (swing/4), -35, 7, 35);

    // Arms (Normal or Hugging)
    if (isHugging) {
        ctx.fillStyle = isMale ? "#5d4037" : "#ff4d6d";
        // Arms reaching out/up
        ctx.beginPath();
        ctx.roundRect(5, -75, 20, 8, 4); // Reaching forward
        ctx.fill();
    } else {
        // Simple side arm
        ctx.fillStyle = isMale ? "#5d4037" : "#ff4d6d";
        ctx.fillRect(-2, -75, 4, 25);
    }

    // Head
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(4, -95, 13, 0, Math.PI*2); ctx.fill();
    
    // Hair
    ctx.fillStyle = isMale ? "#1a1110" : "#000";
    if(isMale) {
        for(let i=0; i<5; i++) { ctx.beginPath(); ctx.arc(i*3-5, -108, 8, 0, Math.PI*2); ctx.fill(); }
    } else {
        ctx.fillRect(-10, -100, 12, 50);
        ctx.beginPath(); ctx.arc(2, -105, 12, 0, Math.PI*2); ctx.fill();
    }
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