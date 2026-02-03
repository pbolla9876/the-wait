// 1. Timeline Setup (Feb 2, 2026 to March 1, 2026)
const start = new Date("February 2, 2026 00:00:00").getTime();
const end = new Date("March 1, 2026 00:00:00").getTime();

// 2. Intro Sequences
setTimeout(() => { 
    const s = document.getElementById('splash');
    const i = document.getElementById('intro');
    if(s) s.style.display = 'none'; 
    if(i) i.style.display = 'flex'; 
}, 4000);

setTimeout(() => { 
    const i = document.getElementById('intro');
    if(i) i.style.display = 'none'; 
    init(); 
}, 8000);

let canvas, ctx, w, h;

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
}

function render() {
    const now = new Date().getTime();
    let progress = Math.min(Math.max((now - start) / (end - start), 0), 1);

    // Cinematic Sky
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#101725'); // Night deep blue
    grd.addColorStop(0.6, '#f2789f'); // Horizon pink
    grd.addColorStop(1, '#f999b9'); // Ground glow
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    // Positions & Scale
    const mX = (w * 0.1) + ((w/2 - w * 0.1) * progress);
    const fX = (w * 0.9) - ((w * 0.9 - w/2) * progress);
    const scale = 1.0 + (progress * 0.4); 

    // Ground
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, h - 100, w, 100);

    // Animation Math
    const time = Date.now() * 0.005;
    const walkCycle = Math.sin(time);
    const legSwing = walkCycle * 20; 
    const armSwing = -walkCycle * 25;
    const bodyBob = Math.abs(Math.cos(time)) * 4;

    // Male (You) - Side Profile
    drawOrganicHuman(mX, h - 100 - (bodyBob * scale), legSwing, armSwing, scale, true);
    
    // Female - Side Profile (Flipped)
    ctx.save();
    ctx.translate(fX, 0);
    ctx.scale(-1, 1);
    drawOrganicHuman(0, h - 100 - (bodyBob * scale), -legSwing, -armSwing, scale, false);
    ctx.restore();

    updateTimer(now);
    requestAnimationFrame(render);
}

function updateTimer(now) {
    const diff = end - now;
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const t = document.getElementById("timer");
    if(t) t.innerHTML = `${d}D ${h}H ${m}M ${s}S`;
}

function drawOrganicHuman(x, y, legAngle, armAngle, s, isMale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    const skin = isMale ? "#8d5524" : "#c68642";
    const skinShade = isMale ? "#633d1a" : "#9e6932";

    // 1. Shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath(); ctx.ellipse(0, 4, 18, 5, 0, 0, Math.PI*2); ctx.fill();

    // 2. Back Limbs (Hidden/Darker)
    drawLimb(ctx, legAngle, isMale ? "#2c4a85" : "#444", false, true); // Leg
    drawLimb(ctx, armAngle, isMale ? "#4e342e" : "#d13250", true, true, skinShade); // Arm

    // 3. Torso (Organic Path)
    ctx.fillStyle = isMale ? "#5d4037" : "#ff4d6d";
    ctx.beginPath();
    if (isMale) {
        ctx.moveTo(-8, -80);
        ctx.quadraticCurveTo(5, -88, 14, -80); // Shoulders
        ctx.lineTo(11, -38); // Back
        ctx.lineTo(-6, -35); // Waist
    } else {
        ctx.moveTo(-2, -80);
        ctx.quadraticCurveTo(8, -82, 12, -75); 
        ctx.lineTo(18, -35); // Flare
        ctx.lineTo(-15, -35);
    }
    ctx.fill();

    // Sweater Stripe Detail
    if(isMale) {
        ctx.fillStyle = "#f5f5f5"; ctx.fillRect(4, -78, 6, 40);
        ctx.fillStyle = "#1a237e"; ctx.fillRect(4, -65, 6, 5);
    }

    // 4. Neck & Head
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(4, -82, 4, 0, Math.PI*2); ctx.fill(); 
    ctx.beginPath(); ctx.ellipse(6, -100, 12, 15, 0.1, 0, Math.PI*2); ctx.fill(); 

    // 5. Facial Features
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath(); ctx.arc(13, -103, 1.8, 0, Math.PI*2); ctx.fill(); // Eye
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.beginPath(); ctx.moveTo(18, -101); ctx.lineTo(22, -99); ctx.lineTo(18, -97); ctx.fill(); // Nose

    // 6. Hair
    ctx.fillStyle = isMale ? "#1a1110" : "#000";
    if (isMale) {
        for(let i=0; i<8; i++) {
            ctx.beginPath(); ctx.arc(-2 + i*3, -114 + i, 9, 0, Math.PI*2); ctx.fill();
        }
    } else {
        ctx.fillRect(-14, -100, 16, 55);
        ctx.beginPath(); ctx.arc(2, -106, 14, 0, Math.PI*2); ctx.fill();
    }

    // 7. Front Limbs (Bright/Visible)
    drawLimb(ctx, -legAngle, isMale ? "#3b5998" : "#555", false, false); // Leg
    drawLimb(ctx, -armAngle, isMale ? "#5d4037" : "#ff4d6d", true, false, skin); // Arm

    ctx.restore();
}

function drawLimb(ctx, angle, color, isArm, isBack, skinColor) {
    ctx.save();
    ctx.translate(isArm ? 4 : 0, isArm ? -78 : -35);
    ctx.rotate(angle * 0.018);
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-4, 0, isArm ? 8 : 10, isArm ? 28 : 34, 5);
    ctx.fill();

    if (isArm) {
        ctx.fillStyle = skinColor;
        ctx.beginPath(); ctx.arc(0, 32, 5, 0, Math.PI*2); ctx.fill(); // Hand
    } else {
        ctx.fillStyle = isBack ? "#000" : "#1a1a1a";
        ctx.roundRect(-2, 32, 15, 7, 2); ctx.fill(); // Shoe
    }
    ctx.restore();
}