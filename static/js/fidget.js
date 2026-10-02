/**
 * Ambient Reader Fidget Canvas (Left Margin Zen Garden)
 * - Traditional East Asian cattails, river reeds, and wild grass rooted in reader's left margin.
 * - Soft, tranquil, silky sway: strictly clamped deflection angles so brushing past is always gentle and relaxing.
 * - Butterflies fly high up towards the ceiling before gently dissolving into mist.
 * - One graceful dragonfly emerges every ~20 clicks, hovering and darting skyward.
 * - Isolated from reader bookmarking events.
 * - Zero CPU/battery when idle.
 */

(function () {
  let canvas = null;
  let ctx = null;
  let overlay = null;
  let animId = null;
  let isAwake = false;

  let plants = [];
  let butterflies = [];
  let dragonflies = [];

  let lastMouseX = null;
  let lastMouseY = null;
  let mouseVelX = 0;
  let mouseVelY = 0;

  let clickCount = 0;
  const MAX_BUTTERFLIES = 28;

  function getThemeColors() {
    if (!overlay) return getDefaultColors();
    if (overlay.classList.contains('theme-dark')) {
      return {
        stalkBase: 'rgba(120, 165, 195, 0.35)',
        stalkTip: 'rgba(90, 135, 170, 0.18)',
        cattailHead: 'rgba(145, 170, 195, 0.65)',
        cattailHighlight: 'rgba(180, 205, 230, 0.4)',
        butterflyBody: 'rgba(215, 240, 255, 0.85)',
        butterflyWing1: 'rgba(105, 215, 245, 0.65)',
        butterflyWing2: 'rgba(165, 240, 255, 0.45)',
        butterflyGlow: 'rgba(120, 230, 255, 0.4)',
        dfBody: 'rgba(190, 225, 250, 0.95)',
        dfWing: 'rgba(80, 225, 215, 0.65)',
        dfGlow: 'rgba(120, 255, 240, 0.5)'
      };
    } else if (overlay.classList.contains('theme-light')) {
      return {
        stalkBase: 'rgba(50, 45, 40, 0.35)',
        stalkTip: 'rgba(90, 80, 70, 0.15)',
        cattailHead: 'rgba(75, 58, 46, 0.65)',
        cattailHighlight: 'rgba(110, 90, 75, 0.4)',
        butterflyBody: 'rgba(55, 48, 42, 0.8)',
        butterflyWing1: 'rgba(115, 95, 125, 0.55)',
        butterflyWing2: 'rgba(155, 135, 165, 0.4)',
        butterflyGlow: 'rgba(105, 85, 120, 0.15)',
        dfBody: 'rgba(45, 40, 35, 0.9)',
        dfWing: 'rgba(95, 110, 130, 0.55)',
        dfGlow: 'rgba(180, 195, 215, 0.3)'
      };
    } else {
      // Sepia default
      return {
        stalkBase: 'rgba(80, 68, 48, 0.45)',
        stalkTip: 'rgba(125, 108, 80, 0.22)',
        cattailHead: 'rgba(105, 60, 32, 0.75)',
        cattailHighlight: 'rgba(145, 95, 55, 0.5)',
        butterflyBody: 'rgba(75, 52, 32, 0.85)',
        butterflyWing1: 'rgba(215, 155, 55, 0.65)',
        butterflyWing2: 'rgba(235, 190, 110, 0.45)',
        butterflyGlow: 'rgba(225, 170, 70, 0.35)',
        dfBody: 'rgba(65, 42, 22, 0.92)',
        dfWing: 'rgba(220, 165, 75, 0.65)',
        dfGlow: 'rgba(245, 200, 110, 0.4)'
      };
    }
  }

  function getDefaultColors() {
    return {
      stalkBase: 'rgba(80, 68, 48, 0.45)',
      stalkTip: 'rgba(125, 108, 80, 0.22)',
      cattailHead: 'rgba(105, 60, 32, 0.75)',
      cattailHighlight: 'rgba(145, 95, 55, 0.5)',
      butterflyBody: 'rgba(75, 52, 32, 0.85)',
      butterflyWing1: 'rgba(215, 155, 55, 0.65)',
      butterflyWing2: 'rgba(235, 190, 110, 0.45)',
      butterflyGlow: 'rgba(225, 170, 70, 0.35)',
      dfBody: 'rgba(65, 42, 22, 0.92)',
      dfWing: 'rgba(220, 165, 75, 0.65)',
      dfGlow: 'rgba(245, 200, 110, 0.4)'
    };
  }

  function initPlants() {
    if (!canvas) return;
    plants = [];
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width === 0 || height === 0) return;

    const totalCount = Math.max(16, Math.min(26, Math.floor(width / 11)));
    
    // Choose 3-5 cattails distributed among reeds and grass
    const cattailIndices = new Set();
    const numCattails = Math.max(3, Math.min(5, Math.floor(totalCount * 0.22)));
    while (cattailIndices.size < numCattails) {
      cattailIndices.add(Math.floor(Math.random() * totalCount));
    }

    for (let i = 0; i < totalCount; i++) {
      const isCattail = cattailIndices.has(i);
      const isReed = !isCattail && (i % 2 === 0);
      const type = isCattail ? 'cattail' : (isReed ? 'reed' : 'grass');

      const x = (i / (totalCount - 1)) * (width * 0.90) + (Math.random() - 0.5) * 8;
      
      let length, baseWidth, stiffness, damping, naturalLean, maxDeflection;

      if (type === 'cattail') {
        length = Math.random() * 90 + 290; // 290 - 380px tall
        baseWidth = Math.random() * 1.5 + 4.2;
        stiffness = 0.016; // Harmonic tension: slow, dignified, regal sway
        damping = 0.96;    // Smooth fluid decay
        naturalLean = (Math.random() - 0.48) * 0.14;
        maxDeflection = 0.20; // ~11.5 degrees max bend (graceful, visible sway)
      } else if (type === 'reed') {
        length = Math.random() * 100 + 220; // 220 - 320px tall
        baseWidth = Math.random() * 1.2 + 3.4;
        stiffness = 0.019;
        damping = 0.955;
        naturalLean = (Math.random() - 0.45) * 0.22;
        maxDeflection = 0.26; // ~14.9 degrees max bend (fluid curving arch)
      } else {
        length = Math.random() * 70 + 150; // 150 - 220px tall
        baseWidth = Math.random() * 0.9 + 2.6;
        stiffness = 0.022;
        damping = 0.95;
        naturalLean = (Math.random() - 0.42) * 0.26;
        maxDeflection = 0.28; // ~16 degrees max bend
      }

      plants.push({
        type: type,
        baseX: x,
        baseY: height,
        length: length,
        baseWidth: baseWidth,
        angle: naturalLean,
        targetAngle: naturalLean,
        velocity: 0,
        tipLag: 0,
        tipLagVel: 0,
        stiffness: stiffness,
        damping: damping,
        maxDeflection: maxDeflection,
        headLength: Math.random() * 14 + 44, // 44 - 58px long velvety cylinder
        headWidth: Math.random() * 2.2 + 8.5, // 8.5 - 10.7px wide
        headStartFrac: Math.random() * 0.05 + 0.68,
        spikeLength: Math.random() * 8 + 20,
        swayPhase: Math.random() * Math.PI * 2
      });
    }
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initPlants();
    wakeUp();
  }

  function spawnButterflies(originX, originY, count = 2) {
    while (butterflies.length + count > MAX_BUTTERFLIES) {
      const oldest = butterflies.shift();
      if (oldest) oldest.opacity = 0;
    }

    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * 1.2 - Math.PI / 2; // Upward cone
      const speed = Math.random() * 1.5 + 2.0; // Graceful upward launch
      
      butterflies.push({
        x: originX + (Math.random() - 0.5) * 14,
        y: originY + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed * 0.65,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 2.8 + 6.2, // ~6.2px to 9.0px (a little bigger, distinct & delicate)
        wingPhase: Math.random() * Math.PI * 2,
        wingSpeed: Math.random() * 0.12 + 0.18,
        wobbleOffset: Math.random() * 100,
        wobbleSpeed: Math.random() * 0.016 + 0.018,
        opacity: 1.0,
        age: 0,
        maxAge: Math.random() * 120 + 260 // Long flight: 4.5 to 6.5 seconds
      });
    }

    wakeUp();
  }

  function spawnDragonfly(originX, originY) {
    // Unique dragonfly with darting flight physics and shimmering gossamer wings
    dragonflies.push({
      x: originX,
      y: originY,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -1.6,
      targetVx: (Math.random() - 0.3) * 1.5,
      targetVy: -2.2,
      bodyLength: 22,
      wingSpan: 28,
      wingPhase: 0,
      wingSpeed: 0.65, // High-frequency shimmer
      hoverCounter: 0,
      hoverDuration: Math.floor(Math.random() * 40) + 50, // Hover near cattails first
      dartPhase: 0,
      opacity: 1.0,
      age: 0,
      maxAge: 380 // Glides gracefully all the way up into the sky
    });
    wakeUp();
  }

  function wakeUp() {
    if (!isAwake) {
      isAwake = true;
      animId = requestAnimationFrame(renderLoop);
    }
  }

  function renderLoop(time) {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);
    const colors = getThemeColors();

    let motionDetected = false;

    // 1. UPDATE & DRAW CATTAILS, REEDS & GRASS
    for (let i = 0; i < plants.length; i++) {
      const p = plants[i];

      // Subtle ambient river breeze (soft living presence)
      const ambientBreeze = Math.sin(time * 0.001 + p.swayPhase) * 0.0004;

      // Spring physics
      const force = (p.targetAngle - p.angle) * p.stiffness + ambientBreeze;
      p.velocity += force;
      p.velocity *= p.damping;

      // Clamp velocity to a happy medium
      p.velocity = Math.max(-0.024, Math.min(0.024, p.velocity));
      p.angle += p.velocity;

      // Strict angle clamp: plant can NEVER exceed its gentle maxDeflection
      if (p.angle > p.targetAngle + p.maxDeflection) {
        p.angle = p.targetAngle + p.maxDeflection;
        p.velocity = 0;
      } else if (p.angle < p.targetAngle - p.maxDeflection) {
        p.angle = p.targetAngle - p.maxDeflection;
        p.velocity = 0;
      }

      // Smooth tip lag (soft organic curvature)
      const tipForce = (p.angle * 0.35 - p.tipLag) * 0.035;
      p.tipLagVel += tipForce;
      p.tipLagVel *= 0.94;
      p.tipLag += p.tipLagVel;

      if (Math.abs(p.angle - p.targetAngle) > 0.0002 || Math.abs(p.velocity) > 0.0002) {
        motionDetected = true;
      }

      const startX = p.baseX;
      const startY = height;

      const midLen = p.length * 0.52;
      const midAngle = p.angle * 0.65;
      const midX = startX + Math.sin(midAngle) * midLen;
      const midY = startY - Math.cos(midAngle) * midLen;

      const fullAngle = p.angle + p.tipLag;
      const tipX = startX + Math.sin(fullAngle) * p.length;
      const tipY = startY - Math.cos(fullAngle) * p.length;

      ctx.save();
      const grad = ctx.createLinearGradient(startX, startY, tipX, tipY);
      grad.addColorStop(0, colors.stalkBase);
      grad.addColorStop(1, colors.stalkTip);

      if (p.type === 'cattail') {
        // Stalk
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(midX, midY, tipX, tipY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = p.baseWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Velvety Cattail Head
        const headT = p.headStartFrac;
        const u = 1 - headT;
        const headX = u * u * startX + 2 * u * headT * midX + headT * headT * tipX;
        const headY = u * u * startY + 2 * u * headT * midY + headT * headT * tipY;

        const tangentX = 2 * (1 - headT) * (midX - startX) + 2 * headT * (tipX - midX);
        const tangentY = 2 * (1 - headT) * (midY - startY) + 2 * headT * (tipY - midY);
        const headAngle = Math.atan2(tangentY, tangentX) + Math.PI / 2;

        ctx.save();
        ctx.translate(headX, headY);
        ctx.rotate(headAngle);

        const hw = p.headWidth;
        const hl = p.headLength;
        const radius = hw / 2;

        const headGrad = ctx.createLinearGradient(-radius, 0, radius, 0);
        headGrad.addColorStop(0, colors.cattailHead);
        headGrad.addColorStop(0.35, colors.cattailHighlight);
        headGrad.addColorStop(1, colors.cattailHead);

        ctx.beginPath();
        ctx.roundRect(-radius, -hl / 2, hw, hl, radius);
        ctx.fillStyle = headGrad;
        ctx.fill();

        // Slender top spike
        ctx.beginPath();
        ctx.moveTo(0, -hl / 2);
        ctx.lineTo(0, -hl / 2 - p.spikeLength);
        ctx.strokeStyle = colors.stalkTip;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.restore();

      } else if (p.type === 'reed') {
        // Curving Ribbon Reed Leaf
        ctx.beginPath();
        ctx.moveTo(startX - p.baseWidth / 2, startY);
        ctx.quadraticCurveTo(midX - p.baseWidth / 3, midY, tipX, tipY);
        ctx.quadraticCurveTo(midX + p.baseWidth / 3, midY, startX + p.baseWidth / 2, startY);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

      } else {
        // Soft Grass Blade
        ctx.beginPath();
        ctx.moveTo(startX - p.baseWidth / 2, startY);
        ctx.quadraticCurveTo(midX, midY, tipX, tipY);
        ctx.quadraticCurveTo(midX + p.baseWidth / 4, midY, startX + p.baseWidth / 2, startY);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.restore();
    }

    // 2. UPDATE & DRAW BUTTERFLIES (Fly higher before fading)
    if (butterflies.length > 0) {
      motionDetected = true;
      ctx.save();

      for (let i = butterflies.length - 1; i >= 0; i--) {
        const bf = butterflies[i];
        bf.age++;

        bf.wingPhase += bf.wingSpeed;
        const drift = Math.sin(time * bf.wobbleSpeed + bf.wobbleOffset) * 0.7;
        bf.x += bf.vx + drift;
        bf.y += bf.vy;
        bf.vx *= 0.99;

        // Sustained upward glide: flies up high towards top of reader
        if (bf.vy > -1.2) bf.vy -= 0.012;

        // Only fade when reaching very high near top of screen or near max age
        if (bf.y < 30 || bf.age > bf.maxAge - 60) {
          bf.opacity -= 0.012;
        }

        if (bf.opacity <= 0 || bf.y < -50 || bf.x < -40 || bf.x > width + 40) {
          butterflies.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(bf.x, bf.y);
        ctx.globalAlpha = Math.max(0, bf.opacity);

        const wingScale = Math.cos(bf.wingPhase);
        const wingSpan = bf.size;

        ctx.shadowColor = colors.butterflyGlow;
        ctx.shadowBlur = 7;

        // Forewings and hindwings
        ctx.beginPath();
        ctx.fillStyle = colors.butterflyWing1;
        ctx.ellipse(-wingSpan * 0.55 * Math.abs(wingScale), -wingSpan * 0.35, wingSpan * 0.7 * Math.abs(wingScale), wingSpan * 0.45, -0.45, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = colors.butterflyWing2;
        ctx.ellipse(-wingSpan * 0.45 * Math.abs(wingScale), wingSpan * 0.25, wingSpan * 0.5 * Math.abs(wingScale), wingSpan * 0.35, 0.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = colors.butterflyWing1;
        ctx.ellipse(wingSpan * 0.55 * Math.abs(wingScale), -wingSpan * 0.35, wingSpan * 0.7 * Math.abs(wingScale), wingSpan * 0.45, 0.45, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = colors.butterflyWing2;
        ctx.ellipse(wingSpan * 0.45 * Math.abs(wingScale), wingSpan * 0.25, wingSpan * 0.5 * Math.abs(wingScale), wingSpan * 0.35, -0.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.fillStyle = colors.butterflyBody;
        ctx.ellipse(0, 0, 1.3, wingSpan * 0.52, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      ctx.restore();
    }

    // 3. UPDATE & DRAW DRAGONFLIES (Darting & Hovering)
    if (dragonflies.length > 0) {
      motionDetected = true;
      ctx.save();

      for (let i = dragonflies.length - 1; i >= 0; i--) {
        const df = dragonflies[i];
        df.age++;
        df.hoverCounter++;
        df.wingPhase += df.wingSpeed;

        if (df.hoverCounter < df.hoverDuration) {
          // Hovering phase: small agile micro-adjustments near the cattails
          df.x += Math.sin(time * 0.01) * 0.6;
          df.y += Math.cos(time * 0.008) * 0.4 - 0.2;
        } else {
          // Darting phase: zips upwards with smooth speed
          df.x += df.vx;
          df.y += df.vy;
          df.vx += (df.targetVx - df.vx) * 0.04;
          df.vy += (df.targetVy - df.vy) * 0.04;
        }

        // Fade near end of life or very high up
        if (df.y < 20 || df.age > df.maxAge - 50) {
          df.opacity -= 0.015;
        }

        if (df.opacity <= 0 || df.y < -60 || df.x < -60 || df.x > width + 60) {
          dragonflies.splice(i, 1);
          continue;
        }

        // Draw Dragonfly
        ctx.save();
        ctx.translate(df.x, df.y);
        ctx.globalAlpha = Math.max(0, df.opacity);

        // Angle aligned with flight direction
        const flyAngle = Math.atan2(df.vy, df.vx) + Math.PI / 2;
        ctx.rotate(flyAngle * 0.35);

        // High-frequency shimmering wing wave
        const shimmer = Math.sin(df.wingPhase);
        const wSpan = df.wingSpan;

        ctx.shadowColor = colors.dfGlow;
        ctx.shadowBlur = 9;

        // Four delicate gossamer wings
        ctx.fillStyle = colors.dfWing;

        // Left forewing & hindwing
        ctx.beginPath();
        ctx.ellipse(-wSpan * 0.52, -4 + shimmer * 1.2, wSpan * 0.58, 2.6, -0.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(-wSpan * 0.42, 4 + shimmer * 1.0, wSpan * 0.48, 2.4, 0.18, 0, Math.PI * 2);
        ctx.fill();

        // Right forewing & hindwing
        ctx.beginPath();
        ctx.ellipse(wSpan * 0.52, -4 - shimmer * 1.2, wSpan * 0.58, 2.6, 0.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(wSpan * 0.42, 4 - shimmer * 1.0, wSpan * 0.48, 2.4, -0.18, 0, Math.PI * 2);
        ctx.fill();

        // Slender segmented needle body
        ctx.shadowBlur = 0;
        ctx.fillStyle = colors.dfBody;

        // Thorax & Head
        ctx.beginPath();
        ctx.ellipse(0, -6, 2.0, 3.2, 0, 0, Math.PI * 2); // Head
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(0, -1, 2.2, 3.8, 0, 0, Math.PI * 2); // Thorax
        ctx.fill();

        // Needle abdomen
        ctx.beginPath();
        ctx.moveTo(-1.2, 2);
        ctx.lineTo(-0.6, df.bodyLength);
        ctx.lineTo(0.6, df.bodyLength);
        ctx.lineTo(1.2, 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      ctx.restore();
    }

    if (motionDetected) {
      animId = requestAnimationFrame(renderLoop);
    } else {
      isAwake = false;
      animId = null;
    }
  }

  function handleMouseMove(e) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (lastMouseX !== null) {
      mouseVelX = mx - lastMouseX;
      mouseVelY = my - lastMouseY;
    }
    lastMouseX = mx;
    lastMouseY = my;

    // Tranquil breeze nudge: tiny, strictly controlled momentum transfer
    let affected = false;
    const radius = 85;

    for (let i = 0; i < plants.length; i++) {
      const p = plants[i];
      const tipY = rect.height - p.length * 0.65;
      const dx = mx - p.baseX;
      const dy = my - tipY;
      const dist = Math.hypot(dx, dy);

      if (dist < radius) {
        affected = true;
        const proximity = (1 - dist / radius);
        // Happy medium impulse: responsive and tactile, yet controlled
        const impulse = Math.max(-0.015, Math.min(0.015, mouseVelX * 0.0018)) * proximity;
        p.velocity += impulse;
      }
    }

    if (affected || Math.abs(mouseVelX) > 0.4) {
      wakeUp();
    }
  }

  function handleClick(e) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    clickCount++;

    // Find nearest plants
    let nearestPlant = null;
    let minDist = Infinity;

    for (let i = 0; i < plants.length; i++) {
      const p = plants[i];
      const d = Math.abs(mx - p.baseX);
      if (d < minDist) {
        minDist = d;
        nearestPlant = p;
      }
      // Fluid visible ripple to neighbors
      if (d < 65) {
        const ripple = (mx > p.baseX ? -1 : 1) * 0.009;
        p.velocity += ripple;
      }
    }

    const spawnX = nearestPlant ? nearestPlant.baseX + Math.sin(nearestPlant.angle) * nearestPlant.length * 0.82 : mx;
    const spawnY = nearestPlant ? rect.height - nearestPlant.length * 0.82 : my;

    if (nearestPlant) {
      // Noticeable, graceful sway deflection on click
      const dir = (Math.random() - 0.5) * 0.022;
      nearestPlant.velocity += dir;
    }

    // Every ~20 clicks: spawn a graceful dragonfly!
    if (clickCount % 20 === 0) {
      spawnDragonfly(spawnX, spawnY - 10);
    } else {
      // Otherwise spawn 2-3 ethereal butterflies
      spawnButterflies(spawnX, spawnY, Math.floor(Math.random() * 2) + 2);
    }
  }

  function init() {
    canvas = document.getElementById('reader-fidget-canvas');
    overlay = document.getElementById('reader-overlay');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    resizeCanvas();

    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousemove', handleMouseMove);

    // Completely isolate events so spam-clicking never triggers reader bookmarks
    canvas.addEventListener('click', (e) => {
      e.stopPropagation();
      handleClick(e);
    });

    canvas.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      e.preventDefault();
      handleClick(e);
    });

    canvas.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    canvas.addEventListener('mouseleave', () => {
      lastMouseX = null;
      lastMouseY = null;
    });

    // Observer to re-trigger or adapt theme when reader opens or switches themes
    if (overlay) {
      const observer = new MutationObserver(() => {
        if (overlay.style.display !== 'none') {
          resizeCanvas();
          wakeUp();
        }
      });
      observer.observe(overlay, { attributes: true, attributeFilter: ['class', 'style'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
