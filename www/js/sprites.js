/* =========================================================
   SLINGSHOT DUMMY — Pixel-Art Arena, Dummy & Boss Renderer
   Crisp zero-blur arcade graphics with squash-and-stretch!
   ========================================================= */

(function () {
  const THEMES = {
    lab: {
      bg: '#141926',
      grid: 'rgba(116, 192, 252, 0.08)',
      border: '#ffd166',
      wallFill: '#2c3550',
      wallHi: '#4a5882',
      wallShade: '#191f30',
      accent: '#ffd166'
    },
    arcade: {
      bg: '#130d24',
      grid: 'rgba(247, 37, 133, 0.1)',
      border: '#f72585',
      wallFill: '#2b1b4d',
      wallHi: '#7209b7',
      wallShade: '#180d2e',
      accent: '#4cc9f0'
    },
    frost: {
      bg: '#0f1f33',
      grid: 'rgba(165, 216, 255, 0.1)',
      border: '#74c0fc',
      wallFill: '#284b6e',
      wallHi: '#6ec6ff',
      wallShade: '#162d45',
      accent: '#a5d8ff'
    },
    foundry: {
      bg: '#1f1010',
      grid: 'rgba(255, 146, 76, 0.1)',
      border: '#ff6b35',
      wallFill: '#45221f',
      wallHi: '#7a3b2e',
      wallShade: '#261110',
      accent: '#ff9f1c'
    },
    throne: {
      bg: '#1b111c',
      grid: 'rgba(255, 209, 102, 0.09)',
      border: '#ffd166',
      wallFill: '#4a1c30',
      wallHi: '#8a2b4f',
      wallShade: '#290d19',
      accent: '#ffd166'
    }
  };

  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  const Sprites = {
    THEMES,

    drawArena(ctx, W, H, themeKey, time) {
      const th = THEMES[themeKey] || THEMES.lab;
      ctx.fillStyle = th.bg;
      ctx.fillRect(0, 0, W, H);

      // Crisp pixel floor grid
      ctx.fillStyle = th.grid;
      for (let x = 16; x < W - 16; x += 24) ctx.fillRect(x, 16, 1, H - 32);
      for (let y = 16; y < H - 16; y += 24) ctx.fillRect(16, y, W - 32, 1);

      // Subtle corner rivets / arena markers
      const cCol = th.border;
      ctx.globalAlpha = 0.25;
      px(ctx, 24, 24, 10, 2, cCol); px(ctx, 24, 24, 2, 10, cCol);
      px(ctx, W - 34, 24, 10, 2, cCol); px(ctx, W - 26, 24, 2, 10, cCol);
      px(ctx, 24, H - 26, 10, 2, cCol); px(ctx, 24, H - 34, 2, 10, cCol);
      px(ctx, W - 34, H - 26, 10, 2, cCol); px(ctx, W - 26, H - 34, 2, 10, cCol);
      ctx.globalAlpha = 1;

      // Outer steel frame (16px border)
      px(ctx, 0, 0, W, 16, th.wallShade);
      px(ctx, 0, H - 16, W, 16, th.wallShade);
      px(ctx, 0, 0, 16, H, th.wallShade);
      px(ctx, W - 16, 0, 16, H, th.wallShade);

      px(ctx, 2, 2, W - 4, 12, th.wallFill);
      px(ctx, 2, H - 14, W - 4, 12, th.wallFill);
      px(ctx, 2, 2, 12, H - 4, th.wallFill);
      px(ctx, W - 14, 2, 12, H - 4, th.wallFill);

      // Inner neon trim ring
      ctx.strokeStyle = th.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(15, 15, W - 30, H - 30);

      // Animated hazard chevrons on Lab / Foundry top rail
      if (themeKey === 'lab' || themeKey === 'foundry') {
        const shift = Math.floor((time * 24) % 24);
        ctx.fillStyle = th.accent;
        for (let x = -24 + shift; x < W; x += 24) {
          ctx.fillRect(x, 4, 10, 4);
          ctx.fillRect(x, H - 8, 10, 4);
        }
      }
    },

    drawZone(ctx, z, time) {
      if (z.kind === 'ice') {
        px(ctx, z.x, z.y, z.w, z.h, 'rgba(116, 192, 252, 0.24)');
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(z.x + 1, z.y + 1, z.w - 2, z.h - 2);
        // Ice sheen diagonal lines
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        for (let i = 8; i < z.w - 10; i += 22) {
          px(ctx, z.x + i, z.y + 6, 8, 2, 'rgba(255,255,255,0.32)');
          px(ctx, z.x + i - 3, z.y + 10, 6, 2, 'rgba(255,255,255,0.22)');
        }
      } else if (z.kind === 'slime') {
        px(ctx, z.x, z.y, z.w, z.h, 'rgba(82, 224, 105, 0.26)');
        ctx.strokeStyle = '#52e069';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(z.x + 1, z.y + 1, z.w - 2, z.h - 2);
        // Bubbling slime spots
        for (let i = 0; i < 4; i++) {
          const bx = z.x + ((i * 29 + 11) % Math.max(12, z.w - 10));
          const by = z.y + ((i * 19 + 9) % Math.max(12, z.h - 10));
          const br = 2 + Math.sin(time * 4 + i * 2) * 1;
          ctx.fillStyle = 'rgba(163, 247, 176, 0.65)';
          ctx.beginPath();
          ctx.arc(bx, by, Math.max(1.2, br), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (z.kind === 'boost') {
        px(ctx, z.x, z.y, z.w, z.h, 'rgba(255, 209, 102, 0.16)');
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(z.x + 1, z.y + 1, z.w - 2, z.h - 2);
        const cx = z.x + z.w / 2;
        const cy = z.y + z.h / 2;
        const ang = Math.atan2(z.dirY || 0, z.dirX || 1);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        const phase = (time * 36) % 14;
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2.5;
        for (let off = -14; off <= 14; off += 14) {
          const ox = ((off + phase + 21) % 42) - 21;
          ctx.beginPath();
          ctx.moveTo(ox - 5, -7);
          ctx.lineTo(ox + 2, 0);
          ctx.lineTo(ox - 5, 7);
          ctx.stroke();
        }
        ctx.restore();
      }
    },

    drawWall(ctx, w, themeKey) {
      const th = THEMES[themeKey] || THEMES.lab;
      px(ctx, w.x, w.y, w.w, w.h, th.wallShade);
      px(ctx, w.x + 2, w.y + 2, w.w - 4, w.h - 4, w.kind === 'moving' ? '#6c47ff' : th.wallFill);
      px(ctx, w.x + 2, w.y + 2, w.w - 4, 3, w.kind === 'moving' ? '#c4b5fd' : th.wallHi);
      if (w.kind === 'moving') {
        px(ctx, w.x + w.w / 2 - 4, w.y + w.h / 2 - 2, 8, 4, '#ffd166');
      }
    },

    drawSpikes(ctx, s, time) {
      px(ctx, s.x, s.y, s.w, s.h, '#2b0d12');
      const pulse = Math.sin(time * 8) > 0 ? '#ff4d4d' : '#d93829';
      ctx.fillStyle = pulse;
      if (s.w >= s.h) {
        const step = 10;
        for (let x = s.x; x < s.x + s.w - 2; x += step) {
          ctx.beginPath();
          ctx.moveTo(x + 1, s.y + s.h);
          ctx.lineTo(x + step / 2, s.y + 1);
          ctx.lineTo(x + Math.min(step - 1, s.x + s.w - x), s.y + s.h);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        const step = 10;
        for (let y = s.y; y < s.y + s.h - 2; y += step) {
          ctx.beginPath();
          ctx.moveTo(s.x, y + 1);
          ctx.lineTo(s.x + s.w - 1, y + step / 2);
          ctx.lineTo(s.x, y + Math.min(step - 1, s.y + s.h - y));
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.strokeStyle = '#ff8787';
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);
    },

    drawLaser(ctx, l, time) {
      // Emitter sockets
      const drawSocket = (x, y) => {
        px(ctx, x - 5, y - 5, 10, 10, '#141724');
        px(ctx, x - 3, y - 3, 6, 6, l.active ? '#ff3b30' : (l.warning ? '#ffd166' : '#52e069'));
      };

      if (l.active) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 59, 48, 0.35)';
        ctx.lineWidth = 10 + Math.sin(time * 24) * 2;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();

        ctx.strokeStyle = '#ff3b30';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.strokeStyle = '#fff5f5';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      } else if (l.warning) {
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.setLineDash([3, 7]);
        ctx.strokeStyle = 'rgba(82, 224, 105, 0.28)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
        ctx.restore();
      }

      drawSocket(l.x1, l.y1);
      drawSocket(l.x2, l.y2);
    },

    drawBumper(ctx, b, time) {
      const pop = b.flash > 0 ? 3 * (b.flash / 0.22) : 0;
      const r = b.r + pop;
      const isSpiky = b.kind === 'troll' && b.armed;

      ctx.save();
      ctx.translate(b.x, b.y);

      if (isSpiky) {
        // Spiky red troll ring!
        ctx.fillStyle = '#ff3b30';
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + time * 2.5;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a - 0.22) * (r - 1), Math.sin(a - 0.22) * (r - 1));
          ctx.lineTo(Math.cos(a) * (r + 6), Math.sin(a) * (r + 6));
          ctx.lineTo(Math.cos(a + 0.22) * (r - 1), Math.sin(a + 0.22) * (r - 1));
          ctx.closePath();
          ctx.fill();
        }
      }

      // Outer glow
      ctx.beginPath();
      ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
      ctx.fillStyle = isSpiky ? 'rgba(255,59,48,0.28)' : (b.flash > 0 ? 'rgba(255,255,255,0.45)' : 'rgba(76,201,240,0.22)');
      ctx.fill();

      // Bumper body
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#141624';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
      ctx.fillStyle = isSpiky ? '#d93829' : (b.kind === 'troll' ? '#ff9f1c' : (b.flash > 0 ? '#ffffff' : '#4cc9f0'));
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, Math.max(3, r - 6), 0, Math.PI * 2);
      ctx.fillStyle = isSpiky ? '#ffd166' : (b.kind === 'troll' ? '#fff3bf' : '#f72585');
      ctx.fill();

      // Cute center icon
      ctx.fillStyle = '#141624';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isSpiky ? 'X' : (b.kind === 'troll' ? '!' : '★'), 0, 0.5);
      ctx.restore();
    },

    drawPortal(ctx, pt, time) {
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(time * 3);
      ctx.strokeStyle = pt.color || '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, pt.r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, pt.r - 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = pt.color === '#fb923c' ? 'rgba(251,146,60,0.25)' : 'rgba(56,189,248,0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, pt.r - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    drawTarget(ctx, t, time) {
      if (t.dead) return;
      ctx.save();
      ctx.translate(t.x, t.y);

      const hurtFlash = t.hitFlash > 0;
      if (t.kind === 'crate') {
        const s = t.r * 2;
        const armored = t.maxHp > 1 && t.hp > 1;
        px(ctx, -t.r, -t.r, s, s, '#111118');
        px(ctx, -t.r + 2, -t.r + 2, s - 4, s - 4, hurtFlash ? '#ffffff' : (armored ? '#64748b' : '#e09f3e'));
        px(ctx, -t.r + 4, -t.r + 4, s - 8, s - 8, hurtFlash ? '#ffffff' : (armored ? '#94a3b8' : '#f4c95d'));
        // Goofy target bullseye face
        px(ctx, -5, -4, 3, 4, '#14141c');
        px(ctx, 2, -4, 3, 4, '#14141c');
        px(ctx, -4, 3, 8, 2, '#14141c');
        if (armored) {
          ctx.fillStyle = '#111118';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(String(t.hp), 0, -t.r - 3);
        }
      } else if (t.kind === 'bomb') {
        const pulse = Math.sin(time * 10) > 0;
        ctx.beginPath();
        ctx.arc(0, 0, t.r, 0, Math.PI * 2);
        ctx.fillStyle = '#111118';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, t.r - 2, 0, Math.PI * 2);
        ctx.fillStyle = hurtFlash ? '#ffffff' : (pulse ? '#e63946' : '#c1121f');
        ctx.fill();
        // Fuse spark
        px(ctx, -2, -t.r - 4, 4, 5, '#ffd166');
        px(ctx, -1, -t.r - 6, 3, 3, pulse ? '#ffffff' : '#ff9f1c');
        ctx.fillStyle = '#fff6e5';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TNT', 0, 1);
      } else if (t.kind === 'enemy_bird') {
        const flap = Math.sin(time * 14) * 3;
        px(ctx, -11, -8, 22, 16, '#14141c');
        px(ctx, -9, -6, 18, 12, hurtFlash ? '#ffffff' : '#ef476f');
        // Wings
        px(ctx, -14, -4 + flap, 6, 6, '#ff8fab');
        px(ctx, 8, -4 - flap, 6, 6, '#ff8fab');
        // Eyes + Beak
        px(ctx, -5, -3, 4, 4, '#ffffff');
        px(ctx, 1, -3, 4, 4, '#ffffff');
        px(ctx, -3, -2, 2, 2, '#111');
        px(ctx, 3, -2, 2, 2, '#111');
        px(ctx, -2, 2, 5, 3, '#ffd166');
      } else if (t.kind === 'enemy_ghost') {
        const bob = Math.sin(time * 6) * 2;
        ctx.translate(0, bob);
        px(ctx, -10, -10, 20, 18, '#14141c');
        px(ctx, -8, -8, 16, 15, hurtFlash ? '#ffd166' : '#e2e8f0');
        px(ctx, -8, 7, 4, 3, '#e2e8f0');
        px(ctx, -2, 7, 4, 3, '#e2e8f0');
        px(ctx, 4, 7, 4, 3, '#e2e8f0');
        // Shy blush + eyes
        px(ctx, -5, -3, 3, 4, '#14141c');
        px(ctx, 2, -3, 3, 4, '#14141c');
        px(ctx, -7, 1, 3, 2, '#ff8fab');
        px(ctx, 4, 1, 3, 2, '#ff8fab');
      } else if (t.kind === 'enemy_slime') {
        const sq = Math.sin(time * 8) * 2;
        px(ctx, -11 - sq * 0.5, -8 + sq * 0.5, 22 + sq, 17 - sq * 0.5, '#14141c');
        px(ctx, -9 - sq * 0.5, -6 + sq * 0.5, 18 + sq, 13 - sq * 0.5, hurtFlash ? '#ffffff' : '#52e069');
        px(ctx, -6, -4 + sq * 0.5, 4, 3, '#b2f2bb');
        px(ctx, -5, -1, 3, 4, '#14141c');
        px(ctx, 2, -1, 3, 4, '#14141c');
      } else if (t.kind === 'boss') {
        const r = t.r;
        // Optional rotating frontal shield arc!
        if (t.shield) {
          ctx.save();
          ctx.strokeStyle = '#ff9f1c';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(0, 0, r + 6, t.shieldAngle - t.shieldArc / 2, t.shieldAngle + t.shieldArc / 2);
          ctx.stroke();
          ctx.strokeStyle = '#fff3bf';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
        // Boss pixel frame
        px(ctx, -r, -r, r * 2, r * 2, '#111118');
        px(ctx, -r + 3, -r + 3, r * 2 - 6, r * 2 - 6, hurtFlash ? '#ffffff' : (t.color || '#d93829'));
        px(ctx, -r + 6, -r + 6, r * 2 - 12, 6, '#ffd166'); // Crown / brow trim
        // Angry pixel eyes
        px(ctx, -11, -5, 8, 8, '#111');
        px(ctx, 3, -5, 8, 8, '#111');
        px(ctx, -10, -4, 6, 6, '#fff');
        px(ctx, 4, -4, 6, 6, '#fff');
        px(ctx, -7, -2, 3, 3, '#d93829');
        px(ctx, 6, -2, 3, 3, '#d93829');
        // Angry zigzag grin
        px(ctx, -9, 8, 18, 4, '#111');
        px(ctx, -7, 9, 4, 2, '#fff');
        px(ctx, 3, 9, 4, 2, '#fff');

        // Overhead HP Bar
        const barW = 44;
        const hpRatio = Math.max(0, t.hp / t.maxHp);
        px(ctx, -barW / 2, -r - 12, barW, 6, '#111118');
        px(ctx, -barW / 2 + 1, -r - 11, (barW - 2) * hpRatio, 4, hpRatio > 0.4 ? '#ff595e' : '#ffd166');
      }

      ctx.restore();
    },

    drawDummy(ctx, d, aimState, time) {
      if (d.dead) return;
      ctx.save();
      ctx.translate(d.x, d.y);

      // Squash & stretch along motion or slingshot pull!
      let sx = 1;
      let sy = 1;
      let rot = 0;
      const spd = Math.hypot(d.vx, d.vy);
      if (aimState && aimState.active && aimState.power > 0.05) {
        rot = Math.atan2(aimState.dirY, aimState.dirX);
        sx = 1 + aimState.power * 0.22;
        sy = 1 - aimState.power * 0.16;
      } else if (spd > 45) {
        rot = Math.atan2(d.vy, d.vx);
        const stretch = Math.min(0.24, (spd - 45) / 1400);
        sx = 1 + stretch;
        sy = 1 - stretch * 0.7;
      } else if (d.bounceSquash > 0) {
        sx = 1 + d.bounceSquash * 0.25;
        sy = 1 - d.bounceSquash * 0.22;
      }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      ctx.ellipse(0, d.r - 1, d.r * 0.9, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(rot);
      ctx.scale(sx, sy);

      const r = d.r;
      // Outer black crash-test outline
      ctx.beginPath();
      ctx.arc(0, 0, r + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#111118';
      ctx.fill();

      // Bright yellow crash-test dummy helmet!
      ctx.beginPath();
      ctx.arc(0, 0, r - 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd166';
      ctx.fill();

      // Classic crash-test quarter cap stripe
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r - 0.5, -Math.PI, -Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = '#181a24';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r - 0.5, -Math.PI / 2, 0);
      ctx.closePath();
      ctx.fillStyle = '#ff9f1c';
      ctx.fill();

      // Undo rotation slightly for readable goofy face
      ctx.scale(1 / sx, 1 / sy);
      ctx.rotate(-rot);

      const lookX = aimState && aimState.active ? aimState.dirX * 2 : (spd > 20 ? (d.vx / spd) * 2 : Math.sin(time * 2) * 0.8);
      const lookY = aimState && aimState.active ? aimState.dirY * 2 : (spd > 20 ? (d.vy / spd) * 2 : 0);

      // Googly pixel eyes (one bigger than the other for peak dummy charm!)
      px(ctx, -7, -4, 6, 6, '#111118');
      px(ctx, -6, -3, 4, 4, '#ffffff');
      px(ctx, -5 + lookX * 0.5, -2 + lookY * 0.5, 2, 2, '#111118');

      px(ctx, 1, -3, 5, 5, '#111118');
      px(ctx, 2, -2, 3, 3, '#ffffff');
      px(ctx, 2.5 + lookX * 0.5, -1.5 + lookY * 0.5, 2, 2, '#111118');

      // Mouth reacts to speed / pull tension
      if (spd > 260 || (aimState && aimState.power > 0.72)) {
        px(ctx, -3, 3, 6, 4, '#111118');
        px(ctx, -2, 4, 4, 2, '#ff6b9d');
      } else {
        px(ctx, -4, 4, 8, 2, '#111118');
        px(ctx, 1, 5, 3, 2, '#ff6b9d');
      }

      ctx.restore();
    },

    drawSlingshotBand(ctx, d, aimState, previewPoints) {
      if (!aimState || !aimState.active || aimState.power < 0.06) return;

      // Dotted trajectory preview (length depends on difficulty!)
      if (previewPoints && previewPoints.length > 0) {
        previewPoints.forEach((pt, idx) => {
          const alpha = Math.max(0.15, 1 - idx / (previewPoints.length + 2));
          ctx.fillStyle = `rgba(255, 246, 229, ${alpha.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, idx % 2 === 0 ? 2.6 : 1.9, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Glowing rubber pull-back slingshot band behind dummy
      const pullLen = 14 + aimState.power * 44;
      const tailX = d.x - aimState.dirX * pullLen;
      const tailY = d.y - aimState.dirY * pullLen;
      const perpX = -aimState.dirY * 9;
      const perpY = aimState.dirX * 9;
      const bandColor = aimState.power > 0.8 ? '#ff595e' : (aimState.power > 0.45 ? '#ffd166' : '#52e069');

      ctx.save();
      ctx.strokeStyle = bandColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(d.x + perpX, d.y + perpY);
      ctx.lineTo(tailX, tailY);
      ctx.lineTo(d.x - perpX, d.y - perpY);
      ctx.stroke();

      // Anchor handle dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tailX, tailY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111118';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  };

  window.SlingSprites = Sprites;
})();
