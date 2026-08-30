// ═══════════════════════════════════════════════════════════════
//  LIVE THEME EFFECTS — Animated Canvas Backgrounds
//  EXAMNOVA Test
//
//  Draws a full-viewport <canvas> fixed BEHIND all page content
//  (z-index:-1) so it shows through the site's translucent/blurred
//  .card elements. Started/stopped by ThemeManager.apply() whenever
//  a theme has `live: true` + `effect: "<name>"`.
// ═══════════════════════════════════════════════════════════════

window.LiveThemeFX = (function () {
  let canvas = null, ctx = null, rafId = null, particles = [];
  let currentEffect = null, currentTheme = null, running = false, lastFrameTime = 0;

  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const MATRIX_CHARS = 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEFｱｲｳｴｵﾊﾋﾌﾍﾎﾗﾘﾙﾚﾛ';

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function hexAlpha(hex, alpha) {
    if (!hex) return `rgba(255,255,255,${alpha})`;
    if (hex[0] !== '#') return hex; // already rgb/rgba
    const c = hex.replace('#', '');
    const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
    const r = parseInt(full.substring(0, 2), 16);
    const g = parseInt(full.substring(2, 4), 16);
    const b = parseInt(full.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function particleCount(base) {
    const area = window.innerWidth * window.innerHeight;
    const scale = Math.min(1.4, Math.max(0.35, area / (1280 * 800)));
    return Math.max(6, Math.round(base * scale));
  }

  function makeCanvas() {
    const c = document.createElement('canvas');
    c.id = 'live-theme-canvas';
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;display:block;';
    document.body.appendChild(c);
    return c;
  }

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (currentEffect) buildParticles(currentEffect, currentTheme);
      if (reduceMotion) drawOnce();
    }, 150);
  }

  function onVisibility() {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (running && !reduceMotion && currentEffect) {
      lastFrameTime = performance.now();
      rafId = requestAnimationFrame(loop);
    }
  }

  // ── Particle builders per effect ──
  const builders = {
    bubbles(theme) {
      const n = particleCount(45);
      const colors = [theme.accent, theme.secondary, theme.primary];
      particles = Array.from({ length: n }, () => ({
        x: rand(0, window.innerWidth), y: rand(0, window.innerHeight),
        r: rand(6, 26), speed: rand(0.3, 1.1), drift: rand(-0.4, 0.4), phase: rand(0, Math.PI * 2),
        color: colors[Math.floor(rand(0, colors.length))], alpha: rand(0.12, 0.32)
      }));
    },
    snow(theme) {
      const n = particleCount(90);
      particles = Array.from({ length: n }, () => ({
        x: rand(0, window.innerWidth), y: rand(0, window.innerHeight),
        r: rand(1.5, 4.5), speed: rand(0.4, 1.6), drift: rand(0.2, 0.7), phase: rand(0, Math.PI * 2),
        alpha: rand(0.5, 0.95)
      }));
    },
    stars(theme) {
      const n = particleCount(130);
      const list = Array.from({ length: n }, () => ({
        x: rand(0, window.innerWidth), y: rand(0, window.innerHeight),
        r: rand(0.6, 2), phase: rand(0, Math.PI * 2), speed: rand(0.02, 0.06),
        color: Math.random() < 0.15 ? theme.accent : '#ffffff'
      }));
      list.shootTimer = rand(2000, 5000);
      list.shoot = null;
      particles = list;
    },
    matrix() {
      const fontSize = 15;
      const cols = Math.ceil(window.innerWidth / fontSize);
      particles = Array.from({ length: cols }, (_, i) => ({
        x: i * fontSize, y: rand(-window.innerHeight, 0), speed: rand(2, 6),
        char: MATRIX_CHARS[Math.floor(rand(0, MATRIX_CHARS.length))], switchTimer: rand(3, 12)
      }));
    },
    fireflies() {
      const n = particleCount(28);
      particles = Array.from({ length: n }, () => ({
        x: rand(0, window.innerWidth), y: rand(0, window.innerHeight),
        vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3), r: rand(1.5, 3), phase: rand(0, Math.PI * 2), speed: rand(0.02, 0.05)
      }));
    },
    diwali(theme) {
      const n = particleCount(55);
      const colors = [theme.accent, '#fde047', '#fb923c', '#f97316'];
      particles = Array.from({ length: n }, () => ({
        x: rand(0, window.innerWidth), y: rand(0, window.innerHeight),
        r: rand(1, 3), vy: rand(-0.5, -0.15), phase: rand(0, Math.PI * 2), speed: rand(0.05, 0.12),
        color: colors[Math.floor(rand(0, colors.length))]
      }));
    },
    holi() {
      const n = particleCount(40);
      const colors = ['#ec4899', '#a855f7', '#22c55e', '#facc15', '#3b82f6', '#f97316'];
      particles = Array.from({ length: n }, () => ({
        x: rand(0, window.innerWidth), y: rand(0, window.innerHeight) + window.innerHeight * 0.2,
        r: rand(20, 55), vy: rand(-0.5, -0.15), vx: rand(-0.15, 0.15),
        color: colors[Math.floor(rand(0, colors.length))], alpha: rand(0.06, 0.14)
      }));
    },
    rain(theme) {
      const n = particleCount(120);
      particles = Array.from({ length: n }, () => ({
        x: rand(0, window.innerWidth), y: rand(0, window.innerHeight),
        len: rand(10, 22), speed: rand(6, 14), alpha: rand(0.2, 0.5)
      }));
    },
    petals() {
      const n = particleCount(35);
      particles = Array.from({ length: n }, () => ({
        x: rand(0, window.innerWidth), y: rand(0, window.innerHeight),
        size: rand(6, 13), speed: rand(0.4, 1.2), drift: rand(-0.5, 0.5),
        rot: rand(0, Math.PI * 2), rotSpeed: rand(-0.02, 0.02), phase: rand(0, Math.PI * 2)
      }));
    },
    confetti(theme) {
      const n = particleCount(60);
      const colors = [theme.primary, theme.secondary, theme.accent, '#ef4444', '#22c55e', '#3b82f6', '#facc15'];
      particles = Array.from({ length: n }, () => ({
        x: rand(0, window.innerWidth), y: rand(-window.innerHeight, 0),
        w: rand(4, 8), h: rand(6, 12), speed: rand(1, 3), drift: rand(-0.6, 0.6),
        rot: rand(0, Math.PI * 2), rotSpeed: rand(-0.08, 0.08), color: colors[Math.floor(rand(0, colors.length))]
      }));
    }
  };

  function buildParticles(effect, theme) {
    const fn = builders[effect];
    if (fn) fn(theme || {});
  }

  // ── Draw / update per effect (called once per animation frame) ──
  function drawBg(theme) {
    const g = ctx.createLinearGradient(0, 0, 0, window.innerHeight);
    g.addColorStop(0, theme.bg || '#0f172a');
    g.addColorStop(1, theme.bg2 || theme.bg || '#0f172a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  }

  const drawers = {
    bubbles(theme) {
      drawBg(theme);
      particles.forEach(p => {
        p.y -= p.speed;
        p.x += Math.sin(p.phase += 0.01) * p.drift;
        if (p.y < -p.r) { p.y = window.innerHeight + p.r; p.x = rand(0, window.innerWidth); }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(p.color, p.alpha); ctx.fill();
        ctx.beginPath(); ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
      });
    },
    snow(theme) {
      drawBg(theme);
      particles.forEach(p => {
        p.y += p.speed;
        p.x += Math.sin(p.phase += 0.02) * p.drift;
        if (p.y > window.innerHeight + p.r) { p.y = -p.r; p.x = rand(0, window.innerWidth); }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`; ctx.fill();
      });
    },
    stars(theme) {
      drawBg(theme);
      particles.forEach(p => {
        const tw = 0.5 + Math.sin(p.phase += p.speed) * 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(p.color, 0.3 + tw * 0.7); ctx.fill();
      });
      particles.shootTimer -= 16;
      if (particles.shootTimer <= 0 && !particles.shoot) {
        particles.shoot = { x: rand(0, window.innerWidth * 0.6), y: rand(0, window.innerHeight * 0.3), len: rand(80, 140), vx: rand(6, 10), vy: rand(3, 5), life: 1 };
      }
      if (particles.shoot) {
        const s = particles.shoot;
        const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.len, s.y - s.len * (s.vy / s.vx));
        grad.addColorStop(0, `rgba(255,255,255,${s.life})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grad; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.len, s.y - s.len * (s.vy / s.vx)); ctx.stroke();
        s.x += s.vx; s.y += s.vy; s.life -= 0.02;
        if (s.life <= 0 || s.x > window.innerWidth || s.y > window.innerHeight) {
          particles.shoot = null; particles.shootTimer = rand(3000, 8000);
        }
      }
    },
    matrix(theme) {
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.font = '15px monospace';
      particles.forEach(p => {
        ctx.fillStyle = p.y < 40 ? '#ffffff' : hexAlpha(theme.accent || '#4ade80', 0.85);
        ctx.fillText(p.char, p.x, p.y);
        p.y += p.speed;
        if (--p.switchTimer <= 0) { p.char = MATRIX_CHARS[Math.floor(rand(0, MATRIX_CHARS.length))]; p.switchTimer = rand(3, 12); }
        if (p.y > window.innerHeight && Math.random() < 0.02) p.y = rand(-100, 0);
      });
    },
    fireflies(theme) {
      drawBg(theme);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        p.vx = Math.max(-0.6, Math.min(0.6, p.vx + rand(-0.02, 0.02)));
        p.vy = Math.max(-0.6, Math.min(0.6, p.vy + rand(-0.02, 0.02)));
        if (p.x < 0) p.x = window.innerWidth; if (p.x > window.innerWidth) p.x = 0;
        if (p.y < 0) p.y = window.innerHeight; if (p.y > window.innerHeight) p.y = 0;
        const glow = 0.4 + Math.sin(p.phase += p.speed) * 0.6;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(theme.accent || '#fde047', glow * 0.15); ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(theme.accent || '#fde047', glow); ctx.fill();
      });
    },
    diwali(theme) {
      drawBg(theme);
      particles.forEach(p => {
        p.y += p.vy;
        const tw = 0.4 + Math.sin(p.phase += p.speed) * 0.6;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(p.color, tw); ctx.fill();
        if (p.y < -10) { p.y = window.innerHeight + 10; p.x = rand(0, window.innerWidth); }
      });
    },
    holi(theme) {
      drawBg(theme);
      particles.forEach(p => {
        p.y += p.vy; p.x += p.vx;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(p.color, p.alpha); ctx.fill();
        if (p.y < -p.r) { p.y = window.innerHeight + p.r; p.x = rand(0, window.innerWidth); }
      });
    },
    rain(theme) {
      drawBg(theme);
      ctx.strokeStyle = hexAlpha(theme.accent || '#7dd3fc', 0.5);
      ctx.lineWidth = 1;
      particles.forEach(p => {
        ctx.globalAlpha = p.alpha;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 2, p.y + p.len); ctx.stroke();
        p.y += p.speed; p.x -= 0.6;
        if (p.y > window.innerHeight) { p.y = -p.len; p.x = rand(0, window.innerWidth); }
      });
      ctx.globalAlpha = 1;
    },
    petals(theme) {
      drawBg(theme);
      particles.forEach(p => {
        p.y += p.speed;
        p.x += Math.sin(p.phase += 0.02) * p.drift;
        p.rot += p.rotSpeed;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = hexAlpha(theme.accent || '#f9a8d4', 0.7);
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (p.y > window.innerHeight + p.size) { p.y = -p.size; p.x = rand(0, window.innerWidth); }
      });
    },
    confetti(theme) {
      drawBg(theme);
      particles.forEach(p => {
        p.y += p.speed; p.x += p.drift; p.rot += p.rotSpeed;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        if (p.y > window.innerHeight + 10) { p.y = -10; p.x = rand(0, window.innerWidth); }
      });
    }
  };

  function drawOnce() {
    const fn = drawers[currentEffect];
    if (fn) fn(currentTheme);
  }

  function loop(ts) {
    if (!running) return;
    const fn = drawers[currentEffect];
    if (fn) fn(currentTheme);
    lastFrameTime = ts;
    rafId = requestAnimationFrame(loop);
  }

  function start(effect, theme) {
    stop();
    if (!effect || !drawers[effect]) return;
    currentEffect = effect;
    currentTheme = theme || {};
    canvas = makeCanvas();
    ctx = canvas.getContext('2d');
    resize();
    buildParticles(effect, currentTheme);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    running = true;

    if (reduceMotion) {
      // Accessibility: draw one static themed frame instead of a continuous loop
      drawOnce();
      return;
    }
    lastFrameTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null; ctx = null; particles = []; currentEffect = null; currentTheme = null;
  }

  return { start, stop, get active() { return currentEffect; } };
})();
