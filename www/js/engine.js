/* =========================================================
   SLINGSHOT DUMMY — Pinball Slingshot Physics & Arena Engine
   One-finger drag-anywhere slingshot, 4× substep physics,
   TNT chains, portals, troll bumpers, lasers, 4 bosses,
   and JakePlay Cloud Account + Per-Arena Stats!
   ========================================================= */

(function () {
  const MAX_PULL_PX = 95;
  const MIN_PULL_PX = 12;
  const MAX_LAUNCH_SPEED = 560;
  const MAX_ABS_SPEED = 690;
  const STOP_SPEED = 18;
  const BORDER = 16;

  const EASY_ROASTS = [
    '🐥 EASY MODE: Training laser sight ON (2× bounce preview) + foam helmet equipped!',
    '🍼 Too bouncy? Adding extra Par shots and calling your mom to aim for you!',
    '🐥 Baby Mode locked in! Warning: red spikes are STILL not pillows lol.'
  ];

  const BONK_QUIPS = [
    '"BOING -> SPLAT! -100 AURA"',
    '"Dummy helmet warranty voided!"',
    '"Physics: 1. Dummy: 0."',
    '"Should\'ve angled 3 degrees left!"',
    '"Crash test results: CATASTROPHIC!"'
  ];

  const EASY_BONK_QUIPS = [
    '"Wait... you hit spikes WITH a 2-bounce laser sight?!"',
    '"Bro bonked on EASY MODE 💀 -100 AURA!"',
    '"Even with training wheels?! Try aiming AWAY from red stuff!"'
  ];

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function distPointToSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
    t = clamp(t, 0, 1);
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy);
  }

  function circleRectHit(cx, cy, r, rx, ry, rw, rh) {
    const nearX = clamp(cx, rx, rx + rw);
    const nearY = clamp(cy, ry, ry + rh);
    const dx = cx - nearX;
    const dy = cy - nearY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= r * r) return null;
    const dist = Math.sqrt(distSq);
    if (dist > 0.0001) {
      return { nx: dx / dist, ny: dy / dist, overlap: r - dist };
    }
    // Center inside rect — push out along shallowest axis
    const left = cx - rx;
    const right = (rx + rw) - cx;
    const top = cy - ry;
    const bottom = (ry + rh) - cy;
    const minSide = Math.min(left, right, top, bottom);
    if (minSide === left) return { nx: -1, ny: 0, overlap: left + r };
    if (minSide === right) return { nx: 1, ny: 0, overlap: right + r };
    if (minSide === top) return { nx: 0, ny: -1, overlap: top + r };
    return { nx: 0, ny: 1, overlap: bottom + r };
  }

  function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  class SlingshotEngine {
    constructor() {
      this.canvas = document.getElementById('gameCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.worldW = window.SLING_WORLD_W || 480;
      this.worldH = window.SLING_WORLD_H || 288;
      this.pixelScale = 2;
      this.canvas.width = this.worldW * this.pixelScale;
      this.canvas.height = this.worldH * this.pixelScale;

      this.save = this._loadSave();
      this.mode = 'title';
      this.difficulty = this.save.difficulty || 'normal';
      this.arenaIndex = 0;
      this.arena = null;
      this.time = 0;
      this.runTimer = 0;
      this.shotsTaken = 0;
      this.arenaBonks = 0;
      this.arenaRetries = 0;
      this.totalDeaths = this.save.totalDeaths || 0;
      this.aura = this.save.aura || 0;
      this.shotCombo = 0;
      this.bestCombo = 0;
      this.hitstop = 0;
      this.shakeTimer = 0;
      this.shakeMag = 0;

      this._cloudSaveTimer = null;
      this._cloudSaveDirty = false;
      this.activeRunToken = null;
      this.activeRunSeq = 0;

      this.particles = [];
      this.floatingTexts = [];
      this.shockwaves = [];
      this.trail = [];
      this.toastTimer = null;

      this.dummy = this._makeDummy(76, 144);
      this.lastSafePos = { x: 76, y: 144 };

      // Drag-anywhere virtual slingshot state
      this.aim = {
        active: false,
        pointerId: null,
        startX: 0, startY: 0,
        curX: 0, curY: 0,
        dirX: 1, dirY: 0,
        power: 0,
        lastStretchTick: 0
      };

      // Overlays & DOM
      this.ovTitle = document.getElementById('overlayTitle');
      this.ovLevels = document.getElementById('overlayLevels');
      this.ovPause = document.getElementById('overlayPause');
      this.ovVictory = document.getElementById('overlayVictory');
      this.ovAuth = document.getElementById('overlayAuth');
      this.elToast = document.getElementById('toastTicker');

      this._bindInputs();
      this._bindUIButtons();
      this._initCloudAuth();
      this.loadArena(0, false);

      this.lastTime = performance.now();
      requestAnimationFrame((t) => this._loop(t));
    }

    _freshSave(difficulty = 'normal') {
      return {
        ownerId: null,
        unlocked: 1,
        bestTimes: {},
        easyBestTimes: {},
        bestShots: {},
        worldStats: {},
        aura: 0,
        totalDeaths: 0,
        difficulty
      };
    }

    _guestSaveKey() { return 'slingshot_dummy_guest_v1'; }
    _userSaveKey(uid) { return `slingshot_dummy_user_${uid}`; }
    _getActiveSaveKey() {
      const uid = window.JakePlayCloud && window.JakePlayCloud.user && window.JakePlayCloud.user.id;
      return uid ? this._userSaveKey(uid) : this._guestSaveKey();
    }

    _loadSaveForKey(key) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return {
          ...this._freshSave(),
          ...parsed,
          bestTimes: parsed.bestTimes && typeof parsed.bestTimes === 'object' ? parsed.bestTimes : {},
          easyBestTimes: parsed.easyBestTimes && typeof parsed.easyBestTimes === 'object' ? parsed.easyBestTimes : {},
          bestShots: parsed.bestShots && typeof parsed.bestShots === 'object' ? parsed.bestShots : {},
          worldStats: parsed.worldStats && typeof parsed.worldStats === 'object' ? parsed.worldStats : {}
        };
      } catch (e) {
        return null;
      }
    }

    _loadSave() {
      return this._loadSaveForKey(this._guestSaveKey()) || this._freshSave();
    }

    _isPremiumUser() {
      return Boolean(window.JakePlayCloud && window.JakePlayCloud.isPremium && window.JakePlayCloud.isPremium());
    }

    _getWorldStat(num) {
      const key = String(num);
      if (!this.save.worldStats) this.save.worldStats = {};
      if (!this.save.worldStats[key]) {
        this.save.worldStats[key] = {
          attempts: 0,
          deaths: 0,
          clears: 0,
          triesToComplete: null,
          bestClearTries: null,
          lastClearTries: null,
          bestTimeMs: null
        };
      }
      return this.save.worldStats[key];
    }

    _getEarnedUnlockedCount() {
      const total = window.SLING_ARENA_BUILDERS.length;
      let cleared = 0;
      for (let w = 1; w <= total; w++) {
        const ws = this.save.worldStats && this.save.worldStats[String(w)];
        if ((ws && ws.clears >= 1) || Number(this.save.bestTimes[w - 1]) > 0 || Number(this.save.easyBestTimes[w - 1]) > 0) {
          cleared = w;
        } else {
          break;
        }
      }
      return Math.min(total, cleared + 1);
    }

    _getEffectiveUnlockedCount() {
      const total = window.SLING_ARENA_BUILDERS.length;
      const earned = this._getEarnedUnlockedCount();
      if (this._isPremiumUser()) {
        return Math.max(earned, Math.min(total, this.save.unlocked || 1));
      }
      return earned;
    }

    _flushCloudSave(keepalive = false) {
      if (this._cloudSaveTimer) {
        clearTimeout(this._cloudSaveTimer);
        this._cloudSaveTimer = null;
      }
      if (!this._cloudSaveDirty) return;
      if (window.JakePlayCloud && window.JakePlayCloud.user) {
        this._cloudSaveDirty = false;
        window.JakePlayCloud.saveProgress(this.save, { keepalive });
      }
    }

    _writeSave(immediateCloud = false) {
      if (!this._isPremiumUser()) {
        this.save.unlocked = this._getEffectiveUnlockedCount();
      }
      this.save.aura = this.aura;
      this.save.totalDeaths = this.totalDeaths;
      this.save.difficulty = this.difficulty;
      try {
        localStorage.setItem(this._getActiveSaveKey(), JSON.stringify(this.save));
      } catch (e) {}
      if (window.JakePlayCloud && window.JakePlayCloud.user) {
        this._cloudSaveDirty = true;
        if (immediateCloud) {
          this._flushCloudSave(false);
        } else if (!this._cloudSaveTimer) {
          this._cloudSaveTimer = setTimeout(() => this._flushCloudSave(false), 4500);
        }
      }
    }

    _mergeRemoteProgress(remote) {
      if (!remote || typeof remote !== 'object') return;
      const mergedBest = { ...(remote.bestTimes || {}) };
      for (const [k, v] of Object.entries(this.save.bestTimes || {})) {
        const lt = Number(v);
        const rt = Number(mergedBest[k]);
        if (Number.isFinite(lt) && lt > 0) mergedBest[k] = (Number.isFinite(rt) && rt > 0) ? Math.min(lt, rt) : lt;
      }
      this.save.bestTimes = mergedBest;

      const mergedWS = {};
      const keys = new Set([...Object.keys(remote.worldStats || {}), ...Object.keys(this.save.worldStats || {})]);
      for (const k of keys) {
        const r = remote.worldStats?.[k];
        const l = this.save.worldStats?.[k];
        if (!r && !l) continue;
        mergedWS[k] = {
          attempts: Math.max(r?.attempts || 0, l?.attempts || 0),
          deaths: Math.max(r?.deaths || 0, l?.deaths || 0),
          clears: Math.max(r?.clears || 0, l?.clears || 0),
          triesToComplete: r?.triesToComplete != null ? r.triesToComplete : (l?.triesToComplete ?? null),
          bestClearTries: (r?.bestClearTries && l?.bestClearTries) ? Math.min(r.bestClearTries, l.bestClearTries) : (r?.bestClearTries || l?.bestClearTries || null),
          lastClearTries: l?.lastClearTries != null ? l.lastClearTries : (r?.lastClearTries ?? null),
          bestTimeMs: (r?.bestTimeMs && l?.bestTimeMs) ? Math.min(r.bestTimeMs, l.bestTimeMs) : (r?.bestTimeMs || l?.bestTimeMs || null)
        };
      }
      this.save.worldStats = mergedWS;
      this.totalDeaths = Math.max(this.totalDeaths || 0, remote.totalDeaths || 0);
      this.aura = Math.min(this.aura || 0, remote.aura || 0);
      this.save.totalDeaths = this.totalDeaths;
      this.save.aura = this.aura;
      const rUnlocked = Math.max(1, remote.unlocked || 1);
      this.save.unlocked = this._isPremiumUser()
        ? Math.max(this.save.unlocked || 1, rUnlocked)
        : this._getEarnedUnlockedCount();
    }

    _makeDummy(x, y) {
      return {
        x, y, r: 10,
        vx: 0, vy: 0,
        moving: false,
        dead: false,
        deathTimer: 0,
        portalCooldown: 0,
        bounceSquash: 0
      };
    }

    showToast(text, durationMs = 2600) {
      if (!text || !this.elToast) return;
      this.elToast.textContent = text;
      this.elToast.classList.add('visible');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => this.elToast.classList.remove('visible'), durationMs);
    }

    _haptic(type = 'light') {
      try {
        const capH = window.Capacitor?.Plugins?.Haptics;
        if (capH?.impact) { capH.impact({ style: type === 'heavy' ? 'HEAVY' : 'LIGHT' }); return; }
        if (navigator.vibrate) navigator.vibrate(type === 'heavy' ? 28 : 10);
      } catch (e) {}
    }

    _isHardOrUlt() { return this.difficulty === 'hard' || this.difficulty === 'ultimate'; }

    _effectivePar() {
      const base = this.arena ? this.arena.par : 3;
      return this.difficulty === 'easy' ? base + 2 : base;
    }

    _bindInputs() {
      const toCanvasCoords = (clientX, clientY) => {
        const rect = this.canvas.getBoundingClientRect();
        return {
          x: ((clientX - rect.left) / Math.max(1, rect.width)) * this.worldW,
          y: ((clientY - rect.top) / Math.max(1, rect.height)) * this.worldH
        };
      };

      const startAim = (e) => {
        if (this.mode !== 'playing' || this.dummy.moving || this.dummy.dead) return;
        if (e.target !== this.canvas) return;
        e.preventDefault();
        window.SlingAudio.init();
        const pt = toCanvasCoords(e.clientX, e.clientY);
        this.aim.active = true;
        this.aim.pointerId = e.pointerId;
        this.aim.startX = pt.x;
        this.aim.startY = pt.y;
        this.aim.curX = pt.x;
        this.aim.curY = pt.y;
        this.aim.power = 0;
        try { this.canvas.setPointerCapture(e.pointerId); } catch (err) {}
      };

      const moveAim = (e) => {
        if (!this.aim.active || e.pointerId !== this.aim.pointerId) return;
        e.preventDefault();
        const pt = toCanvasCoords(e.clientX, e.clientY);
        this.aim.curX = pt.x;
        this.aim.curY = pt.y;
        // Pull back like a slingshot -> launch opposite the drag vector!
        const dx = this.aim.startX - this.aim.curX;
        const dy = this.aim.startY - this.aim.curY;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          this.aim.dirX = dx / dist;
          this.aim.dirY = dy / dist;
        }
        const power = dist < MIN_PULL_PX ? 0 : clamp((dist - MIN_PULL_PX) / (MAX_PULL_PX - MIN_PULL_PX), 0, 1);
        if (power > 0.1 && Math.abs(power - this.aim.lastStretchTick) > 0.18) {
          this.aim.lastStretchTick = power;
          window.SlingAudio.playStretch(power);
        }
        this.aim.power = power;
      };

      const releaseAim = (e) => {
        if (!this.aim.active || e.pointerId !== this.aim.pointerId) return;
        e.preventDefault();
        const pow = this.aim.power;
        const dx = this.aim.dirX;
        const dy = this.aim.dirY;
        this.aim.active = false;
        this.aim.pointerId = null;
        this.aim.power = 0;
        if (pow >= 0.06 && this.mode === 'playing' && !this.dummy.moving && !this.dummy.dead) {
          this.launchDummy(dx, dy, pow);
        }
      };

      this.canvas.addEventListener('pointerdown', startAim);
      this.canvas.addEventListener('pointermove', moveAim);
      this.canvas.addEventListener('pointerup', releaseAim);
      this.canvas.addEventListener('pointercancel', releaseAim);

      window.addEventListener('keydown', (e) => {
        if (!this.ovAuth.classList.contains('hidden')) return;
        const k = e.key.toLowerCase();
        if (k === 'r' && this.mode === 'playing') this.manualRestartArena();
        if (k === 'p' || e.key === 'Escape') {
          if (this.mode === 'playing') this.setMode('paused');
          else if (this.mode === 'paused') this.setMode('playing');
        }
        if (k === 'm') {
          const muted = window.SlingAudio.toggleMute();
          document.getElementById('btnMute').textContent = muted ? '🔇' : '🔊';
        }
      });
    }

    launchDummy(dirX, dirY, power) {
      const speed = 155 + power * (MAX_LAUNCH_SPEED - 155);
      this.lastSafePos = { x: this.dummy.x, y: this.dummy.y };
      this.dummy.vx = dirX * speed;
      this.dummy.vy = dirY * speed;
      this.dummy.moving = true;
      this.shotsTaken++;
      this.shotCombo = 0;
      this.trail = [];

      // Flip shot-toggled lasers on launch!
      for (const l of this.arena.lasers) {
        if (l.mode === 'shot') l.active = !l.active;
      }

      window.SlingAudio.playLaunch(power);
      this._haptic('light');
      this._spawnBurst(this.dummy.x, this.dummy.y, '#ffd166', 10, 120);
      this._updateHUD();
    }

    _syncDifficultyUI() {
      ['easy', 'normal', 'hard', 'ultimate'].forEach((d) => {
        const el = document.querySelector(`.diff-card[data-diff="${d}"]`);
        if (el) el.classList.toggle('active', this.difficulty === d);
      });
      const banner = document.getElementById('easyTrollBanner');
      if (banner) {
        banner.classList.toggle('hidden', this.difficulty !== 'easy');
        if (this.difficulty === 'easy' && !banner.textContent) banner.textContent = EASY_ROASTS[0];
      }
      const btnPauseDiff = document.getElementById('btnSwitchDiff');
      if (btnPauseDiff) {
        const labels = {
          easy: 'MODE: 🐥 EASY (LASER SIGHT)',
          normal: 'MODE: ⚡ NORMAL (1-BOUNCE)',
          hard: 'MODE: 🔥 HARD (EXTRA SPIKES)',
          ultimate: 'MODE: 💀 ULTIMATE (NO SIGHT)'
        };
        btnPauseDiff.textContent = labels[this.difficulty] || labels.normal;
      }
    }

    setDifficulty(diff, showRoast = true) {
      const next = ['easy', 'normal', 'hard', 'ultimate'].includes(diff) ? diff : 'normal';
      if (next !== this.difficulty) this.activeRunToken = null;
      this.difficulty = next;
      this._writeSave(true);
      this._syncDifficultyUI();
      if (showRoast) {
        if (next === 'easy') {
          this._roastIdx = ((this._roastIdx ?? -1) + 1) % EASY_ROASTS.length;
          const msg = EASY_ROASTS[this._roastIdx];
          const b = document.getElementById('easyTrollBanner');
          if (b) b.textContent = msg;
          window.SlingAudio.playTrollLaugh();
          this.showToast(msg, 3400);
        } else {
          window.SlingAudio.playPoke();
          const msgs = {
            normal: '"NORMAL MODE: 1-bounce preview & standard pinball physics!"',
            hard: '"HARD MODE: Short sight, extra spikes & faster hazards!"',
            ultimate: '"ULTIMATE MODE: Zero bounce preview & maximum speed!"'
          };
          this.showToast(msgs[next]);
        }
      }
      this._updateHUD();
    }

    _syncUnlockAllButton() {
      const btn = document.getElementById('btnUnlockAll');
      if (!btn) return;
      const isPrem = this._isPremiumUser();
      const total = window.SLING_ARENA_BUILDERS.length;
      const unlocked = this._getEffectiveUnlockedCount();
      btn.classList.toggle('prem-locked', !isPrem);
      btn.classList.toggle('prem-ready', isPrem);
      btn.textContent = isPrem ? (unlocked >= total ? '👑 ALL UNLOCKED' : '👑 UNLOCK ALL') : '🔒 UNLOCK ALL (PREMIUM)';
    }

    _bindUIButtons() {
      this._syncDifficultyUI();
      this._syncUnlockAllButton();
      document.querySelectorAll('.diff-card').forEach((btn) => {
        btn.addEventListener('click', () => {
          window.SlingAudio.init();
          this.setDifficulty(btn.dataset.diff, true);
        });
      });

      document.getElementById('btnStart').addEventListener('click', () => {
        window.SlingAudio.init();
        this.startArena(Math.min(this._getEffectiveUnlockedCount() - 1, window.SLING_ARENA_BUILDERS.length - 1));
      });
      document.getElementById('btnLevels').addEventListener('click', () => { window.SlingAudio.init(); this.openArenaSelect(); });
      document.getElementById('btnBackTitle').addEventListener('click', () => this.setMode('title'));
      document.getElementById('btnUnlockAll').addEventListener('click', () => {
        if (!this._isPremiumUser()) {
          window.SlingAudio.playPoke();
          const nextNum = Math.min(this._getEffectiveUnlockedCount(), window.SLING_ARENA_BUILDERS.length);
          this.showToast(`👑 Unlock All Arenas is for JakePlay Premium members! Beat Arena ${nextNum} to unlock the next.`, 3400);
          return;
        }
        this.save.unlocked = window.SLING_ARENA_BUILDERS.length;
        this._writeSave(true);
        this._syncUnlockAllButton();
        this._renderArenaGrid();
        window.SlingAudio.playVictory();
        this.showToast(`👑 Premium perk! All ${window.SLING_ARENA_BUILDERS.length} arenas unlocked!`);
      });

      document.getElementById('btnRetryTop').addEventListener('click', () => {
        if (this.mode === 'playing') this.manualRestartArena();
      });
      document.getElementById('btnMute').addEventListener('click', () => {
        const muted = window.SlingAudio.toggleMute();
        document.getElementById('btnMute').textContent = muted ? '🔇' : '🔊';
      });
      document.getElementById('btnPause').addEventListener('click', () => {
        if (this.mode === 'playing') this.setMode('paused');
        else if (this.mode === 'paused') this.setMode('playing');
        else if (this.mode === 'title') this.openArenaSelect();
      });

      document.getElementById('btnResume').addEventListener('click', () => this.setMode('playing'));
      document.getElementById('btnSwitchDiff').addEventListener('click', () => {
        const order = ['easy', 'normal', 'hard', 'ultimate'];
        this.setDifficulty(order[(order.indexOf(this.difficulty) + 1) % order.length], true);
      });
      document.getElementById('btnRestartArena').addEventListener('click', () => this.startArena(this.arenaIndex));
      document.getElementById('btnOpenLevels').addEventListener('click', () => this.openArenaSelect());
      document.getElementById('btnNextArena').addEventListener('click', () => {
        this.startArena((this.arenaIndex + 1) % window.SLING_ARENA_BUILDERS.length);
      });
      document.getElementById('btnReplayArena').addEventListener('click', () => this.startArena(this.arenaIndex));
    }

    _renderAccountStats(user) {
      const signedInfo = document.getElementById('signedInInfo');
      if (!signedInfo || !user) return;
      const total = window.SLING_ARENA_META.length;
      const wsMap = this.save.worldStats || {};
      let clearedCount = 0;
      const rows = [];
      for (let w = 1; w <= total; w++) {
        const st = wsMap[String(w)];
        if (st && (st.attempts > 0 || st.deaths > 0 || st.clears > 0)) {
          if (st.clears > 0) clearedCount++;
          const meta = window.SLING_ARENA_META[w - 1];
          const ttc = st.triesToComplete != null ? `${st.triesToComplete}` : '—';
          const bestSh = this.save.bestShots[w - 1] ? `${this.save.bestShots[w - 1]} sh` : '—';
          rows.push(`<tr><td>${escapeHtml(`A${w} ${meta.name}`)}</td><td>${ttc}</td><td>${bestSh}</td><td>${st.deaths || 0}</td></tr>`);
        }
      }
      const tierLabel = user.tier === 'premium' ? '👑 PREMIUM' : 'REGISTERED';
      const tbl = rows.length
        ? `<div class="acct-stats-scroll"><table class="acct-stats-table"><thead><tr><th>ARENA</th><th>1ST CLEAR</th><th>BEST</th><th>BONKS</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`
        : `<div class="acct-stats-empty">Smash Arena 1 to start tracking tries &amp; bonks!</div>`;

      signedInfo.innerHTML =
        `<b>@${escapeHtml(user.handle)}</b> (${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)})<br/>` +
        `TIER: <b>${tierLabel}</b> · CLOUD STATS ON<br/>` +
        `ARENAS CLEARED: <b>${clearedCount}/${total}</b> · LIFETIME BONKS: <b>${this.totalDeaths}</b><br/>` +
        `AURA: <b>${this.aura}</b>${tbl}`;
    }

    _initCloudAuth() {
      const cloud = window.JakePlayCloud;
      if (!cloud) return;
      const badge = document.getElementById('accountStatusBadge');
      const btnAcc = document.getElementById('btnAccount');
      const formReg = document.getElementById('gameFormReg');
      const formLog = document.getElementById('gameFormLog');
      const formDel = document.getElementById('gameFormDelete');
      const signedBox = document.getElementById('signedInBox');
      const tabReg = document.getElementById('tabReg');
      const tabLog = document.getElementById('tabLog');
      const regErr = document.getElementById('gRegErr');
      const logErr = document.getElementById('gLogErr');
      const delErr = document.getElementById('gDelErr');

      const updateAuthUI = (user) => {
        this._syncUnlockAllButton();
        if (formDel) { formDel.classList.add('hidden'); formDel.reset(); }
        if (delErr) delErr.textContent = '';
        if (user) {
          badge.textContent = `@${user.handle.toUpperCase()} · ${user.tier === 'premium' ? '👑 PREMIUM' : 'CLOUD STATS ON'}`;
          btnAcc.textContent = 'ACCOUNT & STATS';
          formReg.classList.add('hidden');
          formLog.classList.add('hidden');
          signedBox.classList.remove('hidden');
          this._renderAccountStats(user);
        } else {
          badge.textContent = 'FREE GUEST · LOCAL SAVE';
          btnAcc.textContent = 'SIGN IN / REGISTER';
          signedBox.classList.add('hidden');
          formReg.classList.remove('hidden');
          formLog.classList.add('hidden');
        }
      };

      cloud.onAuthChange = async (user, reason, deletedId) => {
        if (user) {
          const cached = this._loadSaveForKey(this._userSaveKey(user.id));
          this.save = cached || (reason === 'register' ? { ...this.save, ownerId: user.id } : this._freshSave(this.difficulty));
          this.save.ownerId = user.id;
          this.aura = this.save.aura || 0;
          this.totalDeaths = this.save.totalDeaths || 0;
          const remote = await cloud.loadProgress();
          if (remote) this._mergeRemoteProgress(remote);
          this._writeSave(true);
        } else {
          this.activeRunToken = null;
          if (reason === 'delete' && deletedId) {
            try { localStorage.removeItem(this._userSaveKey(deletedId)); } catch (e) {}
          }
          this.save = this._loadSaveForKey(this._guestSaveKey()) || this._freshSave(this.difficulty);
          this.aura = this.save.aura || 0;
          this.totalDeaths = this.save.totalDeaths || 0;
        }
        updateAuthUI(user);
        this._updateHUD();
        if (this.mode === 'levels') this._renderArenaGrid();
      };

      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this._flushCloudSave(true); });
      window.addEventListener('pagehide', () => this._flushCloudSave(true));

      btnAcc.addEventListener('click', () => { this.ovAuth.classList.remove('hidden'); updateAuthUI(cloud.user); });
      document.getElementById('btnCloseAuth').addEventListener('click', () => this.ovAuth.classList.add('hidden'));
      tabReg.addEventListener('click', () => {
        if (cloud.user) return;
        tabReg.classList.add('active'); tabLog.classList.remove('active');
        formReg.classList.remove('hidden'); formLog.classList.add('hidden');
      });
      tabLog.addEventListener('click', () => {
        if (cloud.user) return;
        tabLog.classList.add('active'); tabReg.classList.remove('active');
        formLog.classList.remove('hidden'); formReg.classList.add('hidden');
      });

      formReg.addEventListener('submit', async (e) => {
        e.preventDefault();
        regErr.textContent = '';
        const fd = new FormData(formReg);
        try {
          const u = await cloud.register({
            firstName: fd.get('firstName'), lastName: fd.get('lastName'),
            handle: fd.get('handle'), age: Number(fd.get('age')),
            email: fd.get('email'), password: fd.get('password')
          });
          this.showToast(`Welcome @${u.handle}! Cloud Stats enabled!`);
          this.ovAuth.classList.add('hidden');
        } catch (err) { regErr.textContent = err.message; }
      });

      formLog.addEventListener('submit', async (e) => {
        e.preventDefault();
        logErr.textContent = '';
        const fd = new FormData(formLog);
        try {
          const u = await cloud.login(fd.get('emailOrHandle'), fd.get('password'));
          this.showToast(`Signed in as @${u.handle}!`);
          this.ovAuth.classList.add('hidden');
        } catch (err) { logErr.textContent = err.message; }
      });

      document.getElementById('btnGameLogout').addEventListener('click', async () => {
        this._flushCloudSave(false);
        await cloud.logout();
        this.showToast('Signed out — local Guest save restored.');
        this.ovAuth.classList.add('hidden');
      });

      document.getElementById('btnShowDeleteAcct').addEventListener('click', () => {
        formDel.classList.toggle('hidden');
        delErr.textContent = '';
      });
      document.getElementById('btnCancelDeleteAcct').addEventListener('click', () => {
        formDel.classList.add('hidden');
        formDel.reset();
        delErr.textContent = '';
      });
      formDel.addEventListener('submit', async (e) => {
        e.preventDefault();
        delErr.textContent = '';
        const fd = new FormData(formDel);
        try {
          await cloud.deleteAccount(fd.get('password'));
          this.showToast('Account & cloud data permanently deleted.');
          this.ovAuth.classList.add('hidden');
        } catch (err) { delErr.textContent = err.message; }
      });

      cloud.init();
    }

    setMode(newMode) {
      this.mode = newMode;
      this.ovTitle.classList.toggle('hidden', newMode !== 'title');
      this.ovLevels.classList.toggle('hidden', newMode !== 'levels');
      this.ovPause.classList.toggle('hidden', newMode !== 'paused');
      this.ovVictory.classList.toggle('hidden', newMode !== 'victory');
      if (newMode === 'paused') {
        this._flushCloudSave(false);
        this._syncDifficultyUI();
        const ws = this._getWorldStat(this.arena.num);
        document.getElementById('pauseStats').innerHTML =
          `ARENA ${this.arena.num}: ${escapeHtml(this.arena.name)}<br/>` +
          `SHOTS: <b>${this.shotsTaken}</b> (PAR ${this._effectivePar()}) · BONKS: <b>${this.arenaBonks}</b><br/>` +
          `TOTAL A${this.arena.num} BONKS: <b>${ws.deaths}</b> · AURA: <b>${this.aura}</b>`;
      }
    }

    openArenaSelect() {
      this._syncUnlockAllButton();
      this._renderArenaGrid();
      this.setMode('levels');
    }

    _renderArenaGrid() {
      const grid = document.getElementById('worldGrid');
      grid.innerHTML = '';
      const unlockedCount = this._getEffectiveUnlockedCount();
      window.SLING_ARENA_META.forEach((m, idx) => {
        const unlocked = idx < unlockedCount;
        const ws = this.save.worldStats && this.save.worldStats[String(m.num)];
        const cleared = Boolean((ws && ws.clears > 0) || this.save.bestTimes[idx] || this.save.easyBestTimes[idx]);
        const bestSh = this.save.bestShots[idx];
        let statHtml = '';
        if (ws && (ws.clears > 0 || ws.deaths > 0 || ws.attempts > 0)) {
          const parts = [];
          if (bestSh) parts.push(`Best: ${bestSh} sh (Par ${m.par})`);
          if (ws.triesToComplete != null) parts.push(`1st Clear: ${ws.triesToComplete}t`);
          parts.push(`Bonks: ${ws.deaths || 0}`);
          statHtml = `<div class="w-stat-line">${parts.join(' · ')}</div>`;
        } else if (!unlocked && idx > 0) {
          statHtml = `<div class="w-meta">Clear A${idx} to unlock (or 👑 Premium)</div>`;
        }
        const btn = document.createElement('button');
        btn.className = 'world-item' + (unlocked ? '' : ' locked') + (m.isBoss ? ' boss-item' : '');
        btn.innerHTML = `
          <div>
            <div>A${m.num}. ${escapeHtml(m.name)}</div>
            <div class="w-meta">${escapeHtml(m.subtitle)}</div>
            ${statHtml}
          </div>
          <span class="w-badge">${unlocked ? (cleared ? 'CLEARED' : (m.isBoss ? 'BOSS' : 'PLAY')) : '🔒 LOCKED'}</span>
        `;
        btn.addEventListener('click', () => {
          if (unlocked) this.startArena(idx);
          else {
            window.SlingAudio.playPoke();
            this.showToast(`🔒 Clear Arena ${idx} to unlock Arena ${m.num}, or upgrade to JakePlay Premium!`, 3200);
          }
        });
        grid.appendChild(btn);
      });
    }

    loadArena(index, resetCounters = true) {
      this.arenaIndex = index;
      this.arena = window.SLING_ARENA_BUILDERS[index]();
      this.dummy = this._makeDummy(this.arena.spawn.x, this.arena.spawn.y);
      this.lastSafePos = { x: this.arena.spawn.x, y: this.arena.spawn.y };
      this.particles = [];
      this.floatingTexts = [];
      this.shockwaves = [];
      this.trail = [];
      this.aim.active = false;
      this.aim.power = 0;
      if (resetCounters) {
        this.runTimer = 0;
        this.shotsTaken = 0;
        this.arenaBonks = 0;
        this.arenaRetries = 0;
        this.bestCombo = 0;
        this.shotCombo = 0;
      }
      this._updateHUD();
    }

    startArena(index) {
      const safeIdx = clamp(index, 0, Math.max(0, this._getEffectiveUnlockedCount() - 1));
      this.loadArena(safeIdx, true);
      this.setMode('playing');

      this.activeRunToken = null;
      const seq = ++this.activeRunSeq;
      if (window.JakePlayCloud?.user && ['normal', 'hard', 'ultimate'].includes(this.difficulty)) {
        const aNum = this.arena.num;
        const diff = this.difficulty;
        window.JakePlayCloud.startRun(aNum, diff).then((tok) => {
          if (this.activeRunSeq === seq && this.arena?.num === aNum && this.difficulty === diff) {
            this.activeRunToken = tok;
          }
        });
      }

      const hint = safeIdx === 0 ? ' · Drag anywhere to pull back & launch!' : '';
      this.showToast(`A${this.arena.num}: ${this.arena.subtitle}${hint}`, 3000);
      window.SlingAudio.startBGM(safeIdx);
    }

    manualRestartArena() {
      if (this.arena) {
        this.arenaRetries++;
        const st = this._getWorldStat(this.arena.num);
        st.attempts++;
        this._writeSave(false);
      }
      this.loadArena(this.arenaIndex, false);
      this.shotsTaken = 0;
      this.showToast('Arena reset — fresh slingshot!');
    }

    bonkDummy(reason) {
      if (this.dummy.dead) return;
      this.dummy.dead = true;
      this.dummy.deathTimer = 0;
      this.dummy.moving = false;
      this.dummy.vx = 0;
      this.dummy.vy = 0;
      this.arenaBonks++;
      this.totalDeaths++;
      this.aura -= 100;

      const st = this._getWorldStat(this.arena.num);
      st.deaths++;
      st.attempts++;
      this._writeSave(false);

      window.SlingAudio.playDeath();
      this._haptic('heavy');
      this.shake(0.28, 6);
      this._spawnBurst(this.dummy.x, this.dummy.y, '#ff595e', 20, 170);
      this._addFloat(this.dummy.x, this.dummy.y - 10, '-100 AURA', '#ff595e');

      let msg = reason || BONK_QUIPS[this.totalDeaths % BONK_QUIPS.length];
      if (this.difficulty === 'easy' && (this.totalDeaths % 2 === 0 || !reason)) {
        msg = EASY_BONK_QUIPS[this.totalDeaths % EASY_BONK_QUIPS.length];
      }
      this.showToast(msg);
      this._updateHUD();
    }

    async triggerVictory() {
      this.setMode('victory');
      window.SlingAudio.playVictory();
      this._haptic('heavy');
      this.showToast(this.arena.clearQuote, 3500);

      const aNum = this.arena.num;
      const st = this._getWorldStat(aNum);
      const runTries = this.arenaBonks + this.arenaRetries + 1;
      st.attempts += 1;
      st.clears += 1;
      if (st.triesToComplete == null) st.triesToComplete = st.attempts;
      if (!st.bestClearTries || runTries < st.bestClearTries) st.bestClearTries = runTries;
      st.lastClearTries = runTries;

      const timeMs = Math.round(this.runTimer * 1000);
      if (this.difficulty === 'easy') {
        const pe = this.save.easyBestTimes[this.arenaIndex];
        if (!pe || this.runTimer < pe) this.save.easyBestTimes[this.arenaIndex] = this.runTimer;
      } else {
        const pb = this.save.bestTimes[this.arenaIndex];
        if (!pb || this.runTimer < pb) this.save.bestTimes[this.arenaIndex] = this.runTimer;
        if (!st.bestTimeMs || timeMs < st.bestTimeMs) st.bestTimeMs = timeMs;
      }

      const prevBestShots = this.save.bestShots[this.arenaIndex];
      if (!prevBestShots || this.shotsTaken < prevBestShots) {
        this.save.bestShots[this.arenaIndex] = this.shotsTaken;
      }

      const nextUnlock = Math.min(window.SLING_ARENA_BUILDERS.length, this.arenaIndex + 2);
      if (nextUnlock > (this.save.unlocked || 1)) this.save.unlocked = nextUnlock;
      this._writeSave(true);
      this._syncUnlockAllButton();

      const par = this._effectivePar();
      const stars = this.shotsTaken <= par ? '★★★' : (this.shotsTaken <= par + 2 ? '★★☆' : '★☆☆');

      const tok = this.activeRunToken;
      this.activeRunToken = null;
      let cloudLine = '';
      if (this.difficulty === 'easy') {
        cloudLine = `<br/><span style="color:#ffb3d9">🐥 Gold Star Sticker earned! Beat Normal/Hard/Ultimate for Pro Scores!</span>`;
      } else if (window.JakePlayCloud?.user) {
        const ok = await window.JakePlayCloud.submitScore(aNum, this.difficulty, this.runTimer, this.arenaBonks, this.aura, runTries, tok);
        cloudLine = ok
          ? `<br/>☁️ Cloud stats &amp; score saved for <b>@${escapeHtml(window.JakePlayCloud.user.handle)}</b>!`
          : `<br/><span style="color:#9aa6c4">☁️ Cloud stats saved for <b>@${escapeHtml(window.JakePlayCloud.user.handle)}</b>!</span>`;
      } else {
        cloudLine = `<br/><span style="color:#9aa6c4">Sign in (13+) to sync per-arena stats to JakePlay Cloud!</span>`;
      }

      const isFinal = this.arenaIndex === window.SLING_ARENA_BUILDERS.length - 1;
      const unlockedNote = !isFinal && this.arenaIndex + 2 === this._getEffectiveUnlockedCount()
        ? `<br/><span style="color:#7ee081">🔓 ARENA ${aNum + 1} UNLOCKED!</span>`
        : '';

      document.getElementById('victoryTag').textContent = isFinal ? '★ ALL 20 ARENAS SMASHED! ★' : `${stars} ARENA CLEARED!`;
      document.getElementById('victoryTitle').textContent = `A${aNum} · ${this.arena.name.toUpperCase()}`;
      document.getElementById('victoryStats').innerHTML =
        `SHOTS: <b>${this.shotsTaken}</b> (PAR ${par}) · BEST COMBO: <b>×${Math.max(1, this.bestCombo)}</b><br/>` +
        `TIME: <b>${this.runTimer.toFixed(1)}s</b> · 1ST CLEAR: <b>${st.triesToComplete} ${st.triesToComplete === 1 ? 'TRY' : 'TRIES'}</b><br/>` +
        `A${aNum} TOTAL BONKS: <b>${st.deaths}</b> · AURA: <b>${this.aura}</b>${unlockedNote}${cloudLine}`;
      document.getElementById('victoryQuote').textContent = this.arena.clearQuote;
      document.getElementById('btnNextArena').textContent = isFinal ? 'PLAY FROM A1 ▶' : 'NEXT ARENA ▶';
    }

    shake(dur, mag) {
      this.shakeTimer = Math.max(this.shakeTimer, dur);
      this.shakeMag = Math.max(this.shakeMag, mag);
    }

    _addFloat(x, y, text, color = '#ffd166') {
      this.floatingTexts.push({ x, y, text, color, life: 0.95, vy: -28 });
    }

    _spawnBurst(x, y, color, count = 12, speed = 130) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 25 + Math.random() * speed;
        this.particles.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 0.35 + Math.random() * 0.35, maxLife: 0.7,
          size: 2 + Math.floor(Math.random() * 3),
          color: i % 3 === 0 ? '#ffffff' : color
        });
      }
    }

    _damageTarget(t, dmg, fromExplosion = false) {
      if (t.dead) return;
      if (t.kind === 'boss' && !fromExplosion && t.hitCooldown > 0) return;

      t.hp -= dmg;
      t.hitFlash = 0.16;
      if (t.kind === 'boss') t.hitCooldown = 0.22;

      if (t.hp <= 0) {
        t.dead = true;
        this.shotCombo++;
        this.bestCombo = Math.max(this.bestCombo, this.shotCombo);
        this.hitstop = t.kind === 'boss' ? 0.08 : 0.032;

        if (t.kind === 'bomb') {
          this._explodeBomb(t);
        } else {
          const col = t.kind === 'boss' ? '#ffd166' : (t.kind === 'enemy_slime' ? '#52e069' : '#f4c95d');
          this._spawnBurst(t.x, t.y, col, t.kind === 'boss' ? 32 : 14, t.kind === 'boss' ? 210 : 140);
          window.SlingAudio.playSmash(this.shotCombo);
          this._haptic(t.kind === 'boss' ? 'heavy' : 'light');
          this.shake(t.kind === 'boss' ? 0.35 : 0.14, t.kind === 'boss' ? 7 : 3);
          const lbl = this.shotCombo >= 2 ? `COMBO ×${this.shotCombo}!!` : (t.kind === 'boss' ? 'BOSS KO!!' : 'SMASH!');
          this._addFloat(t.x, t.y - 10, lbl, this.shotCombo >= 2 ? '#4cc9f0' : '#ffd166');
        }
      } else {
        window.SlingAudio.playBossHit();
        this._haptic('light');
        this.shake(0.14, 3.5);
        this._spawnBurst(t.x, t.y, '#ffd166', 10, 120);
        this._addFloat(t.x, t.y - 14, `${t.hp} HP LEFT`, '#ff9f1c');
      }
    }

    _explodeBomb(b) {
      window.SlingAudio.playBomb();
      this._haptic('heavy');
      this.shake(0.32, 7);
      this.shockwaves.push({ x: b.x, y: b.y, r: 8, maxR: b.radius || 80, life: 0.35, maxLife: 0.35 });
      this._spawnBurst(b.x, b.y, '#ff595e', 26, 200);
      this._spawnBurst(b.x, b.y, '#ffd166', 14, 150);
      this._addFloat(b.x, b.y - 12, 'KABOOM!!', '#ff595e');

      const rad = b.radius || 80;
      for (const other of this.arena.targets) {
        if (other.dead || other === b) continue;
        if (Math.hypot(other.x - b.x, other.y - b.y) <= rad + other.r) {
          this._damageTarget(other, 2, true);
        }
      }
    }

    _computeAimPreview() {
      if (!this.aim.active || this.aim.power < 0.06) return [];
      const maxBounces = this.difficulty === 'easy' ? 2 : (this.difficulty === 'normal' ? 1 : 0);
      const maxSteps = this.difficulty === 'easy' ? 32 : (this.difficulty === 'normal' ? 18 : (this.difficulty === 'hard' ? 9 : 4));

      let x = this.dummy.x;
      let y = this.dummy.y;
      const spd = 155 + this.aim.power * (MAX_LAUNCH_SPEED - 155);
      let vx = this.aim.dirX * spd;
      let vy = this.aim.dirY * spd;
      const r = this.dummy.r;
      const stepDt = 0.022;
      let bounces = 0;
      const pts = [];

      for (let i = 0; i < maxSteps; i++) {
        x += vx * stepDt;
        y += vy * stepDt;

        // Outer border reflection
        if (x - r < BORDER) { x = BORDER + r; vx = Math.abs(vx); bounces++; }
        else if (x + r > this.worldW - BORDER) { x = this.worldW - BORDER - r; vx = -Math.abs(vx); bounces++; }
        if (y - r < BORDER) { y = BORDER + r; vy = Math.abs(vy); bounces++; }
        else if (y + r > this.worldH - BORDER) { y = this.worldH - BORDER - r; vy = -Math.abs(vy); bounces++; }

        // Solid walls reflection
        for (const w of this.arena.walls) {
          const hit = circleRectHit(x, y, r, w.x, w.y, w.w, w.h);
          if (hit) {
            x += hit.nx * hit.overlap;
            y += hit.ny * hit.overlap;
            const dot = vx * hit.nx + vy * hit.ny;
            if (dot < 0) {
              vx -= 2 * dot * hit.nx;
              vy -= 2 * dot * hit.ny;
              bounces++;
            }
          }
        }

        // Bumpers reflection
        for (const b of this.arena.bumpers) {
          const dx = x - b.x;
          const dy = y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < r + b.r && dist > 0.01) {
            const nx = dx / dist;
            const ny = dy / dist;
            x = b.x + nx * (r + b.r);
            y = b.y + ny * (r + b.r);
            const dot = vx * nx + vy * ny;
            if (dot < 0) {
              vx -= 2 * dot * nx;
              vy -= 2 * dot * ny;
              bounces++;
            }
          }
        }

        pts.push({ x, y });
        if (bounces > maxBounces) break;
      }
      return pts;
    }

    _updateHUD() {
      if (!this.arena) return;
      const rem = this.arena.targets.filter(t => !t.dead).length;
      const elA = document.getElementById('hudArena');
      const elDiff = document.getElementById('hudDiff');
      const elShots = document.getElementById('hudShots');
      const elTargets = document.getElementById('hudTargets');
      const elAura = document.getElementById('hudAura');
      const elTimer = document.getElementById('hudTimer');

      if (elA) elA.textContent = `A${this.arena.num} · ${this.arena.name.toUpperCase()}`;
      if (elDiff) {
        const dTxt = { easy: '🐥 EASY', normal: '⚡ NORMAL', hard: '🔥 HARD', ultimate: '💀 ULT' };
        elDiff.textContent = dTxt[this.difficulty] || '⚡ NORMAL';
        elDiff.className = `hud-pill diff-pill mode-${this.difficulty}`;
      }
      if (elShots) elShots.textContent = `SHOTS: ${this.shotsTaken}/${this._effectivePar()}`;
      if (elTargets) elTargets.textContent = `TARGETS: ${rem}`;
      if (elAura) {
        elAura.textContent = `AURA: ${this.aura}`;
        elAura.classList.toggle('aura-negative', this.aura < 0);
      }
      if (elTimer) {
        const mins = Math.floor(this.runTimer / 60);
        const secs = (this.runTimer % 60).toFixed(1).padStart(4, '0');
        elTimer.textContent = `${String(mins).padStart(2, '0')}:${secs}`;
      }
    }

    _update(dt) {
      this.time += dt;
      if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - dt);

      // Update particles, floats & shockwaves
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        pt.vx *= 0.94; pt.vy *= 0.94;
        pt.life -= dt;
        if (pt.life <= 0) this.particles.splice(i, 1);
      }
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y += ft.vy * dt;
        ft.life -= dt;
        if (ft.life <= 0) this.floatingTexts.splice(i, 1);
      }
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const sw = this.shockwaves[i];
        sw.life -= dt;
        sw.r = sw.maxR * (1 - sw.life / sw.maxLife);
        if (sw.life <= 0) this.shockwaves.splice(i, 1);
      }

      if (this.mode !== 'playing') return;

      if (this.hitstop > 0) {
        this.hitstop = Math.max(0, this.hitstop - dt);
        return;
      }

      this.runTimer += dt;
      const speedMul = this.difficulty === 'ultimate' ? 1.35 : (this.difficulty === 'hard' ? 1.2 : (this.difficulty === 'easy' ? 0.8 : 1.0));
      const d = this.dummy;

      if (d.dead) {
        d.deathTimer += dt;
        if (d.deathTimer >= 0.62) {
          d.dead = false;
          d.x = this.lastSafePos.x;
          d.y = this.lastSafePos.y;
          d.vx = 0; d.vy = 0; d.moving = false;
          // Disarm troll bumpers on respawn so player isn't unfairly trapped
          for (const b of this.arena.bumpers) {
            if (b.kind === 'troll') b.armed = false;
          }
        }
        this._updateHUD();
        return;
      }

      if (d.portalCooldown > 0) d.portalCooldown = Math.max(0, d.portalCooldown - dt);
      if (d.bounceSquash > 0) d.bounceSquash = Math.max(0, d.bounceSquash - dt * 4);

      // Update moving walls
      for (const w of this.arena.walls) {
        if (w.kind === 'moving') {
          w.x += (w.vx || 0) * speedMul * dt;
          w.y += (w.vy || 0) * speedMul * dt;
          if (w.vx && (w.x <= w.minX || w.x >= w.maxX)) { w.x = clamp(w.x, w.minX, w.maxX); w.vx = -w.vx; }
          if (w.vy && (w.y <= w.minY || w.y >= w.maxY)) { w.y = clamp(w.y, w.minY, w.maxY); w.vy = -w.vy; }
        }
      }

      // Update bumpers flash
      for (const b of this.arena.bumpers) {
        if (b.flash > 0) b.flash = Math.max(0, b.flash - dt);
      }

      // Update timer-based lasers
      for (const l of this.arena.lasers) {
        if (l.hardOnly && !this._isHardOrUlt()) { l.active = false; l.warning = false; continue; }
        if (l.mode === 'timer') {
          const per = l.period / speedMul;
          const cyc = ((this.time + (l.phase || 0)) % per) / per;
          l.active = cyc < l.duty;
          l.warning = !l.active && cyc > 0.84;
        }
      }

      // Update dynamic targets & bosses
      for (const t of this.arena.targets) {
        if (t.dead) continue;
        if (t.hitFlash > 0) t.hitFlash = Math.max(0, t.hitFlash - dt);
        if (t.hitCooldown > 0) t.hitCooldown = Math.max(0, t.hitCooldown - dt);

        if (t.kind === 'enemy_bird' || t.kind === 'enemy_slime' || t.kind === 'boss') {
          t.x += (t.vx || 0) * speedMul * dt;
          t.y += (t.vy || 0) * speedMul * dt;
          if (t.vx && (t.x <= t.minX || t.x >= t.maxX)) { t.x = clamp(t.x, t.minX, t.maxX); t.vx = -t.vx; }
          if (t.vy && (t.y <= t.minY || t.y >= t.maxY)) { t.y = clamp(t.y, t.minY, t.maxY); t.vy = -t.vy; }
          if (t.kind === 'boss' && t.shield) {
            t.shieldAngle = normalizeAngle(t.shieldAngle + (t.shieldSpeed || 1.4) * speedMul * dt);
          }
        } else if (t.kind === 'enemy_ghost') {
          // Shy ghost freezes while player aims!
          if (!this.aim.active && !d.dead) {
            const dx = d.x - t.x;
            const dy = d.y - t.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 8) {
              const spd = (t.speed || 30) * speedMul;
              t.x = clamp(t.x + (dx / dist) * spd * dt, BORDER + t.r, this.worldW - BORDER - t.r);
              t.y = clamp(t.y + (dy / dist) * spd * dt, BORDER + t.r, this.worldH - BORDER - t.r);
            }
          }
        }
      }

      // Substepped Dummy Physics (4 substeps prevents any tunneling!)
      const SUBSTEPS = 4;
      const subDt = dt / SUBSTEPS;

      for (let step = 0; step < SUBSTEPS; step++) {
        if (d.dead) break;

        if (d.moving) {
          // Terrain zone effects
          let drag = 1.42;
          for (const z of this.arena.zones) {
            if (d.x >= z.x && d.x <= z.x + z.w && d.y >= z.y && d.y <= z.y + z.h) {
              if (z.kind === 'ice') drag = 0.24;
              else if (z.kind === 'slime') drag = 7.4;
              else if (z.kind === 'boost') {
                d.vx += (z.dirX || 1) * (z.force || 500) * subDt * 2.2;
                d.vy += (z.dirY || 0) * (z.force || 500) * subDt * 2.2;
                if (Math.random() < 0.12) {
                  window.SlingAudio.playBoost();
                  this._spawnBurst(d.x, d.y, '#ffd166', 2, 60);
                }
              }
            }
          }

          // Clamp max velocity
          const curSpd = Math.hypot(d.vx, d.vy);
          if (curSpd > MAX_ABS_SPEED) {
            d.vx = (d.vx / curSpd) * MAX_ABS_SPEED;
            d.vy = (d.vy / curSpd) * MAX_ABS_SPEED;
          }

          d.x += d.vx * subDt;
          d.y += d.vy * subDt;

          // Exponential damping
          const damp = Math.exp(-drag * subDt);
          d.vx *= damp;
          d.vy *= damp;

          // Outer steel border bounce
          if (d.x - d.r < BORDER) {
            d.x = BORDER + d.r; d.vx = Math.abs(d.vx) * 0.92; d.bounceSquash = 0.85;
            window.SlingAudio.playWallBounce(curSpd / 500);
          } else if (d.x + d.r > this.worldW - BORDER) {
            d.x = this.worldW - BORDER - d.r; d.vx = -Math.abs(d.vx) * 0.92; d.bounceSquash = 0.85;
            window.SlingAudio.playWallBounce(curSpd / 500);
          }
          if (d.y - d.r < BORDER) {
            d.y = BORDER + d.r; d.vy = Math.abs(d.vy) * 0.92; d.bounceSquash = 0.85;
            window.SlingAudio.playWallBounce(curSpd / 500);
          } else if (d.y + d.r > this.worldH - BORDER) {
            d.y = this.worldH - BORDER - d.r; d.vy = -Math.abs(d.vy) * 0.92; d.bounceSquash = 0.85;
            window.SlingAudio.playWallBounce(curSpd / 500);
          }

          // Internal walls bounce
          for (const w of this.arena.walls) {
            const hit = circleRectHit(d.x, d.y, d.r, w.x, w.y, w.w, w.h);
            if (hit) {
              d.x += hit.nx * hit.overlap;
              d.y += hit.ny * hit.overlap;
              const dot = d.vx * hit.nx + d.vy * hit.ny;
              if (dot < 0) {
                d.vx = (d.vx - 2 * dot * hit.nx) * 0.93;
                d.vy = (d.vy - 2 * dot * hit.ny) * 0.93;
                d.bounceSquash = 0.9;
                window.SlingAudio.playWallBounce(curSpd / 500);
                this._spawnBurst(d.x - hit.nx * d.r, d.y - hit.ny * d.r, '#cbd5e1', 4, 80);
              }
            }
          }

          // Bumpers bounce (neon & troll!)
          for (const b of this.arena.bumpers) {
            const dx = d.x - b.x;
            const dy = d.y - b.y;
            const dist = Math.hypot(dx, dy);
            if (dist < d.r + b.r && dist > 0.001) {
              if (b.kind === 'troll' && b.armed) {
                this.bonkDummy('"TROLL BUMPER! Safe on bounce 1, spiky on bounce 2!"');
                break;
              }
              const nx = dx / dist;
              const ny = dy / dist;
              d.x = b.x + nx * (d.r + b.r + 0.5);
              d.y = b.y + ny * (d.r + b.r + 0.5);
              const dot = d.vx * nx + d.vy * ny;
              const newSpd = Math.min(MAX_ABS_SPEED, Math.max(260, Math.hypot(d.vx, d.vy) * (b.boost || 1.32)));
              let rx = d.vx - 2 * dot * nx;
              let ry = d.vy - 2 * dot * ny;
              const rLen = Math.hypot(rx, ry) || 1;
              d.vx = (rx / rLen) * newSpd;
              d.vy = (ry / rLen) * newSpd;
              b.flash = 0.22;
              d.bounceSquash = 1.0;
              window.SlingAudio.playBumper(this.shotCombo + 1);
              this._haptic('light');
              this._spawnBurst(b.x + nx * b.r, b.y + ny * b.r, b.kind === 'troll' ? '#ff9f1c' : '#4cc9f0', 8, 120);
              if (b.kind === 'troll') {
                b.armed = true;
                this._addFloat(b.x, b.y - 16, 'NOW SPIKY!!', '#ff595e');
              }
            }
          }
          if (d.dead) break;

          // Warp Portals
          if (d.portalCooldown <= 0) {
            for (const pt of this.arena.portals) {
              if (Math.hypot(d.x - pt.x, d.y - pt.y) < pt.r + d.r * 0.45) {
                const partner = this.arena.portals.find(o => o.id === pt.pairId);
                if (partner) {
                  d.x = partner.x;
                  d.y = partner.y;
                  d.portalCooldown = 0.34;
                  window.SlingAudio.playPortal();
                  this._spawnBurst(pt.x, pt.y, pt.color, 10, 110);
                  this._spawnBurst(partner.x, partner.y, partner.color, 12, 130);
                  this._addFloat(partner.x, partner.y - 14, 'WARP!', partner.color);
                  break;
                }
              }
            }
          }
        }

        // Spikes hazard check (even if pushed by moving wall!)
        for (const s of this.arena.spikes) {
          if (s.hardOnly && !this._isHardOrUlt()) continue;
          if (circleRectHit(d.x, d.y, d.r - 1.5, s.x, s.y, s.w, s.h)) {
            this.bonkDummy('"SPIKED! Dummy springs everywhere! -100 AURA"');
            break;
          }
        }
        if (d.dead) break;

        // Active Lasers hazard check
        for (const l of this.arena.lasers) {
          if (!l.active) continue;
          if (distPointToSeg(d.x, d.y, l.x1, l.y1, l.x2, l.y2) < d.r + 1.5) {
            this.bonkDummy('"ZAPPED BY LASER BEAM! Wait for green!"');
            break;
          }
        }
        if (d.dead) break;

        // Targets & Boss collisions
        for (const t of this.arena.targets) {
          if (t.dead) continue;
          const dx = d.x - t.x;
          const dy = d.y - t.y;
          const dist = Math.hypot(dx, dy);
          if (dist < d.r + t.r) {
            // Shy ghost hurts if you're standing still!
            if (t.kind === 'enemy_ghost' && !d.moving) {
              this.bonkDummy('"BOO!! Shy Ghost snuck up while you stalled!"');
              break;
            }
            const nx = dist > 0.001 ? dx / dist : 1;
            const ny = dist > 0.001 ? dy / dist : 0;
            d.x = t.x + nx * (d.r + t.r + 0.5);
            d.y = t.y + ny * (d.r + t.r + 0.5);

            // Bounce dummy cleanly
            const dot = d.vx * nx + d.vy * ny;
            if (dot < 0) {
              d.vx = (d.vx - 2 * dot * nx) * 0.95;
              d.vy = (d.vy - 2 * dot * ny) * 0.95;
            } else {
              d.vx += nx * 160;
              d.vy += ny * 160;
            }
            d.bounceSquash = 0.9;

            // Boss frontal shield check
            if (t.kind === 'boss' && t.shield) {
              const hitAng = Math.atan2(dy, dx);
              const diffAng = Math.abs(normalizeAngle(hitAng - t.shieldAngle));
              if (diffAng <= t.shieldArc / 2) {
                window.SlingAudio.playBumper(1);
                this._spawnBurst(d.x, d.y, '#ff9f1c', 10, 140);
                this._addFloat(t.x, t.y - t.r - 10, 'SHIELDED!!', '#ff9f1c');
                continue;
              }
            }
            this._damageTarget(t, 1, false);
          }
        }
        if (d.dead) break;

        // Stop check
        if (d.moving && Math.hypot(d.vx, d.vy) < STOP_SPEED) {
          d.vx = 0;
          d.vy = 0;
          d.moving = false;
          this.lastSafePos = { x: d.x, y: d.y };
        }
      }

      // Speed trail breadcrumbs
      if (d.moving) {
        this.trail.push({ x: d.x, y: d.y, life: 0.24 });
        if (this.trail.length > 22) this.trail.shift();
      }
      for (let i = this.trail.length - 1; i >= 0; i--) {
        this.trail[i].life -= dt;
        if (this.trail[i].life <= 0) this.trail.splice(i, 1);
      }

      // Check victory (all targets smashed!)
      const remaining = this.arena.targets.filter(t => !t.dead).length;
      if (remaining === 0 && this.mode === 'playing') {
        this.triggerVictory();
      }

      this._updateHUD();
    }

    _render() {
      const ctx = this.ctx;
      ctx.save();
      ctx.scale(this.pixelScale, this.pixelScale);

      if (this.shakeTimer > 0) {
        const ox = (Math.random() - 0.5) * 2 * this.shakeMag;
        const oy = (Math.random() - 0.5) * 2 * this.shakeMag;
        ctx.translate(ox, oy);
      }

      window.SlingSprites.drawArena(ctx, this.worldW, this.worldH, this.arena.theme, this.time);

      for (const z of this.arena.zones) window.SlingSprites.drawZone(ctx, z, this.time);
      for (const pt of this.arena.portals) window.SlingSprites.drawPortal(ctx, pt, this.time);
      for (const w of this.arena.walls) window.SlingSprites.drawWall(ctx, w, this.arena.theme);
      for (const s of this.arena.spikes) {
        if (s.hardOnly && !this._isHardOrUlt()) continue;
        window.SlingSprites.drawSpikes(ctx, s, this.time);
      }
      for (const l of this.arena.lasers) {
        if (l.hardOnly && !this._isHardOrUlt()) continue;
        window.SlingSprites.drawLaser(ctx, l, this.time);
      }
      for (const b of this.arena.bumpers) window.SlingSprites.drawBumper(ctx, b, this.time);
      for (const t of this.arena.targets) window.SlingSprites.drawTarget(ctx, t, this.time);

      // Motion trail
      for (const tr of this.trail) {
        const a = clamp(tr.life / 0.24, 0, 1) * 0.45;
        ctx.fillStyle = `rgba(255, 209, 102, ${a.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(tr.x, tr.y, 4 * (tr.life / 0.24) + 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ready-to-aim pulsing halo around dummy
      if (this.mode === 'playing' && !this.dummy.moving && !this.dummy.dead && !this.aim.active) {
        const pulse = 14 + Math.sin(this.time * 5.5) * 2.5;
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(this.dummy.x, this.dummy.y, pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      const preview = this._computeAimPreview();
      window.SlingSprites.drawSlingshotBand(ctx, this.dummy, this.aim, preview);
      window.SlingSprites.drawDummy(ctx, this.dummy, this.aim, this.time);

      // Shockwaves
      for (const sw of this.shockwaves) {
        const a = clamp(sw.life / sw.maxLife, 0, 1);
        ctx.strokeStyle = `rgba(255, 209, 102, ${a.toFixed(2)})`;
        ctx.lineWidth = 4 * a;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Particles
      for (const pt of this.particles) {
        ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
        ctx.fillStyle = pt.color;
        ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
      }
      ctx.globalAlpha = 1;

      // Floating combo/bonk texts
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      for (const ft of this.floatingTexts) {
        ctx.globalAlpha = clamp(ft.life / 0.95, 0, 1);
        ctx.fillStyle = '#0d0e14';
        ctx.fillText(ft.text, Math.round(ft.x) + 1, Math.round(ft.y) + 1);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, Math.round(ft.x), Math.round(ft.y));
      }
      ctx.globalAlpha = 1;

      ctx.restore();
    }

    _loop(now) {
      const dt = Math.min(0.033, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;
      this._update(dt);
      this._render();
      requestAnimationFrame((t) => this._loop(t));
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.SlingshotGame = new SlingshotEngine();
  });
})();
