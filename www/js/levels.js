/* =========================================================
   SLINGSHOT DUMMY — 20 Handcrafted Pinball & Boss Arenas
   5 Themes × 4 Arenas each (W5, W10, W15, W20 = Mini-Bosses!)
   Arena interior: x = 16..464, y = 16..272 (480 × 288 canvas)
   ========================================================= */

(function () {
  const W = 480;
  const H = 288;

  const ARENA_META = [
    // Theme 1: Crash-Test Lab (W1-W4)
    { num: 1, name: 'Crash-Test 101', subtitle: 'Pull Back, Aim & Smash!', theme: 'lab', par: 2 },
    { num: 2, name: 'Bumper Alley', subtitle: 'Bank Off Neon Bumpers!', theme: 'lab', par: 2 },
    { num: 3, name: 'TNT Domino', subtitle: '1 Shot Chain Explosion!', theme: 'lab', par: 2 },
    { num: 4, name: 'Spike Corridor', subtitle: 'Thread the Needle!', theme: 'lab', par: 3 },

    // Theme 2: Neon Pinball Arcade (W5-W8)
    { num: 5, name: 'Boss: Grumpy Safe', subtitle: 'BOSS ARENA · Crack the 4-HP Vault!', theme: 'arcade', par: 4, isBoss: true },
    { num: 6, name: 'Warp Trickshot', subtitle: 'Blue In, Orange Out!', theme: 'arcade', par: 2 },
    { num: 7, name: 'Troll Bumper Club', subtitle: 'Safe First... Spiky Second!', theme: 'arcade', par: 3 },
    { num: 8, name: 'Turbo Pinball', subtitle: 'Boost Pads & Armored Crates!', theme: 'arcade', par: 3 },

    // Theme 3: Ice Rink Ricochet (W9-W12)
    { num: 9, name: 'Slippery Chaos', subtitle: 'Zero-Friction Ice Ricochet!', theme: 'frost', par: 2 },
    { num: 10, name: 'Boss: Pinball King', subtitle: 'BOSS ARENA · Dethrone the 5-HP King!', theme: 'frost', par: 5, isBoss: true },
    { num: 11, name: 'Sticky & Icy', subtitle: 'Brake on Slime, Launch on Ice!', theme: 'frost', par: 3 },
    { num: 12, name: 'Ghost Gallery', subtitle: 'Matchstick Cameo: Shy Ghosts!', theme: 'frost', par: 3 },

    // Theme 4: Lava Foundry (W13-W16)
    { num: 13, name: 'Laser Gatehouse', subtitle: 'Time the Pulsing Red Beams!', theme: 'foundry', par: 3 },
    { num: 14, name: 'Flip-Flop Lasers', subtitle: 'Lasers Toggle Every Shot!', theme: 'foundry', par: 3 },
    { num: 15, name: 'Boss: Turret Prime', subtitle: 'BOSS ARENA · 6-HP Laser Fortress!', theme: 'foundry', par: 5, isBoss: true },
    { num: 16, name: 'Powder Keg Panic', subtitle: 'Moving Walls & Bomb Chains!', theme: 'foundry', par: 3 },

    // Theme 5: Matchbox Royal Throne (W17-W20)
    { num: 17, name: 'Portal Gauntlet', subtitle: 'Twin Warps & Patrol Birds!', theme: 'throne', par: 4 },
    { num: 18, name: 'Pinball Blender', subtitle: 'Troll Bumpers Everywhere!', theme: 'throne', par: 4 },
    { num: 19, name: 'Royal Laser Maze', subtitle: 'Precision Ricochet Trial!', theme: 'throne', par: 4 },
    { num: 20, name: 'Boss: Matchbox Mech', subtitle: 'FINAL BOSS · 8-HP Shielded Mech!', theme: 'throne', par: 6, isBoss: true }
  ];

  function crate(x, y, hp = 1) {
    return { kind: 'crate', x, y, r: 12, hp, maxHp: hp, dead: false, hitFlash: 0 };
  }
  function bomb(x, y, radius = 78) {
    return { kind: 'bomb', x, y, r: 13, hp: 1, maxHp: 1, radius, dead: false, hitFlash: 0 };
  }
  function bird(x, y, vx = 72, vy = 0, minX = 40, maxX = 440, minY = 40, maxY = 248) {
    return { kind: 'enemy_bird', x, y, r: 13, hp: 1, maxHp: 1, vx, vy, minX, maxX, minY, maxY, dead: false, hitFlash: 0 };
  }
  function ghost(x, y, speed = 28) {
    return { kind: 'enemy_ghost', x, y, r: 13, hp: 1, maxHp: 1, vx: 0, vy: 0, speed, dead: false, hitFlash: 0 };
  }
  function slime(x, y, vx = 52, minX = 60, maxX = 420) {
    return { kind: 'enemy_slime', x, y, r: 13, hp: 1, maxHp: 1, vx, vy: 0, minX, maxX, minY: 40, maxY: 248, dead: false, hitFlash: 0 };
  }
  function boss(opts) {
    return {
      kind: 'boss',
      name: opts.name || 'BOSS',
      color: opts.color || '#d93829',
      x: opts.x, y: opts.y, r: opts.r || 24,
      hp: opts.hp || 5, maxHp: opts.hp || 5,
      vx: opts.vx || 0, vy: opts.vy || 0,
      minX: opts.minX || 48, maxX: opts.maxX || 432,
      minY: opts.minY || 50, maxY: opts.maxY || 238,
      shield: Boolean(opts.shield),
      shieldAngle: opts.shieldAngle || Math.PI,
      shieldSpeed: opts.shieldSpeed || 1.4,
      shieldArc: opts.shieldArc || 1.45,
      dead: false, hitFlash: 0, hitCooldown: 0
    };
  }
  function bumper(x, y, r = 15, kind = 'neon') {
    return { x, y, r, boost: 1.32, kind, armed: false, flash: 0 };
  }
  function wall(x, y, w, h, opts = {}) {
    return { x, y, w, h, kind: opts.kind || 'wall', vx: opts.vx || 0, vy: opts.vy || 0, minX: opts.minX || x, maxX: opts.maxX || x, minY: opts.minY || y, maxY: opts.maxY || y };
  }
  function spike(x, y, w, h, hardOnly = false) {
    return { x, y, w, h, hardOnly };
  }
  function laser(x1, y1, x2, y2, opts = {}) {
    return {
      x1, y1, x2, y2,
      mode: opts.mode || 'timer',
      period: opts.period || 3.2,
      duty: opts.duty || 0.42,
      phase: opts.phase || 0,
      active: Boolean(opts.active),
      warning: false,
      hardOnly: Boolean(opts.hardOnly)
    };
  }
  function portalPair(idA, ax, ay, idB, bx, by) {
    return [
      { id: idA, pairId: idB, x: ax, y: ay, r: 15, color: '#38bdf8' },
      { id: idB, pairId: idA, x: bx, y: by, r: 15, color: '#fb923c' }
    ];
  }
  function zone(kind, x, y, w, h, extra = {}) {
    return { kind, x, y, w, h, ...extra };
  }

  function makeArena(metaIdx, cfg) {
    const m = ARENA_META[metaIdx];
    return {
      num: m.num,
      name: m.name,
      subtitle: m.subtitle,
      theme: m.theme,
      par: m.par,
      isBoss: Boolean(m.isBoss),
      width: W,
      height: H,
      spawn: cfg.spawn || { x: 76, y: 144 },
      walls: cfg.walls || [],
      zones: cfg.zones || [],
      bumpers: cfg.bumpers || [],
      portals: cfg.portals || [],
      spikes: cfg.spikes || [],
      lasers: cfg.lasers || [],
      targets: cfg.targets || [],
      clearQuote: cfg.clearQuote || '"BOING!! Arena smashed!"'
    };
  }

  const ARENA_BUILDERS = [
    // W1: Crash-Test 101 — Instant juicy tutorial + clean combo!
    () => makeArena(0, {
      spawn: { x: 84, y: 144 },
      bumpers: [bumper(230, 88, 15), bumper(230, 200, 15)],
      targets: [crate(310, 144), crate(366, 108), crate(366, 180), crate(414, 144)],
      spikes: [spike(210, 16, 60, 12, true)],
      clearQuote: '"First crash test passed! Dummy helmet still intact!"'
    }),

    // W2: Bumper Alley — Pinball bank shots around center wall
    () => makeArena(1, {
      spawn: { x: 72, y: 214 },
      walls: [wall(190, 96, 20, 176)],
      bumpers: [bumper(198, 56, 16), bumper(310, 88, 16), bumper(310, 198, 16)],
      targets: [crate(388, 72), crate(388, 144), crate(388, 216), crate(264, 144)],
      spikes: [spike(16, 16, 150, 12, true)],
      clearQuote: '"Bank-shot legend! Even the bumpers are dizzy!"'
    }),

    // W3: TNT Domino — Satisfying 1-shot chain explosion
    () => makeArena(2, {
      spawn: { x: 74, y: 144 },
      walls: [wall(182, 16, 18, 92), wall(182, 180, 18, 92)],
      bumpers: [bumper(256, 144, 15)],
      targets: [
        bomb(330, 144, 86),
        crate(330, 82), crate(330, 206),
        crate(396, 108), crate(396, 180),
        crate(420, 144, 2)
      ],
      spikes: [spike(182, 108, 18, 12), spike(182, 168, 18, 12)],
      clearQuote: '"KABOOM! Zero safety standards, maximum style!"'
    }),

    // W4: Spike Corridor — Precision bank shots through spike hazards
    () => makeArena(3, {
      spawn: { x: 66, y: 144 },
      walls: [wall(176, 86, 18, 116), wall(308, 16, 18, 104), wall(308, 174, 18, 98)],
      spikes: [spike(176, 74, 18, 12), spike(176, 202, 18, 12), spike(452, 92, 12, 104)],
      bumpers: [bumper(246, 54, 14), bumper(246, 234, 14)],
      targets: [crate(246, 144), crate(390, 74), crate(390, 214), slime(388, 144, 0, 360, 420)],
      clearQuote: '"Threaded the spike gauntlet like a pro dummy!"'
    }),

    // W5: BOSS — GRUMPY SAFE (4-HP Armored Vault + Flank TNT Barrels!)
    () => makeArena(4, {
      spawn: { x: 72, y: 144 },
      bumpers: [bumper(194, 72, 16), bumper(194, 216, 16), bumper(418, 60, 14), bumper(418, 228, 14)],
      spikes: [spike(16, 16, 12, 92, true), spike(16, 180, 12, 92, true)],
      targets: [
        boss({ name: 'GRUMPY SAFE', color: '#475569', x: 332, y: 144, r: 25, hp: 4, vy: 62, minY: 66, maxY: 222 }),
        bomb(332, 60, 82),
        bomb(332, 228, 82)
      ],
      clearQuote: '"VAULT CRACKED!! Grumpy Safe left the chat!"'
    }),

    // W6: Warp Trickshot — Shoot through Blue Portal to smash walled vault!
    () => makeArena(5, {
      spawn: { x: 74, y: 212 },
      walls: [wall(250, 16, 20, 256)],
      portals: portalPair('p6a', 176, 68, 'p6b', 316, 212),
      bumpers: [bumper(176, 212, 15), bumper(404, 144, 15)],
      targets: [crate(336, 78), crate(398, 78), bomb(366, 144, 78), crate(414, 214)],
      spikes: [spike(238, 96, 12, 96)],
      clearQuote: '"Now you\'re thinking with dummy portals!"'
    }),

    // W7: Troll Bumper Club — Safe on hit 1, spiky red on hit 2!
    () => makeArena(6, {
      spawn: { x: 68, y: 144 },
      bumpers: [
        bumper(188, 96, 16, 'troll'),
        bumper(188, 192, 16, 'troll'),
        bumper(310, 144, 17, 'troll'),
        bumper(410, 74, 14, 'neon')
      ],
      targets: [crate(252, 62), crate(252, 226), crate(396, 144, 2), bird(372, 210, 72, 0, 290, 434)],
      clearQuote: '"Outsmarted the troll bumpers! Respect!"'
    }),

    // W8: Turbo Pinball — High-speed boost lanes + armored crates
    () => makeArena(7, {
      spawn: { x: 66, y: 222 },
      zones: [
        zone('boost', 112, 198, 92, 46, { dirX: 1, dirY: 0, force: 520 }),
        zone('boost', 386, 60, 48, 120, { dirX: 0, dirY: -1, force: 500 })
      ],
      walls: [wall(16, 146, 276, 18)],
      bumpers: [bumper(412, 218, 16), bumper(340, 118, 14)],
      targets: [crate(280, 78, 2), crate(210, 78), bomb(144, 78, 80), crate(84, 78), crate(332, 218)],
      spikes: [spike(292, 146, 18, 18)],
      clearQuote: '"Mach-5 pinball madness!"'
    }),

    // W9: Slippery Chaos — Huge zero-friction ice rink
    () => makeArena(8, {
      spawn: { x: 70, y: 144 },
      zones: [zone('ice', 120, 32, 326, 224)],
      bumpers: [bumper(230, 100, 15), bumper(230, 188, 15), bumper(354, 144, 16)],
      targets: [
        crate(174, 62), crate(174, 226),
        crate(300, 62), crate(300, 226),
        crate(420, 96), crate(420, 192)
      ],
      spikes: [spike(452, 112, 12, 64)],
      clearQuote: '"Ice-cold combo chain! Still sliding!"'
    }),

    // W10: BOSS — PINBALL KING (5-HP Crown Boss + Orbiting Bumpers & Ice!)
    () => makeArena(9, {
      spawn: { x: 68, y: 144 },
      zones: [zone('ice', 160, 40, 260, 208)],
      portals: portalPair('p10a', 142, 54, 'p10b', 424, 232),
      bumpers: [bumper(236, 94, 15), bumper(236, 194, 15), bumper(376, 94, 15, 'troll'), bumper(376, 194, 15, 'troll')],
      targets: [
        boss({ name: 'PINBALL KING', color: '#7209b7', x: 306, y: 144, r: 24, hp: 5, vx: 45, vy: 58, minX: 256, maxX: 364, minY: 74, maxY: 214 }),
        crate(424, 66),
        bomb(186, 144, 72)
      ],
      clearQuote: '"THE PINBALL KING IS DETHRONED!! Crown claimed!"'
    }),

    // W11: Sticky & Icy — Use green slime anchor pads to line up narrow bank shots!
    () => makeArena(10, {
      spawn: { x: 66, y: 224 },
      zones: [
        zone('slime', 180, 188, 76, 68),
        zone('ice', 274, 34, 174, 116)
      ],
      walls: [wall(144, 16, 18, 150), wall(264, 140, 18, 132)],
      spikes: [spike(16, 16, 128, 12), spike(320, 260, 120, 12)],
      targets: [crate(208, 66), crate(334, 68), bomb(396, 96, 82), crate(424, 212), slime(350, 212, 48, 304, 412)],
      clearQuote: '"Sticky anchor into ice bank-shot! Pure IQ!"'
    }),

    // W12: Ghost Gallery — Shy Ghosts freeze while you aim, drift when you release!
    () => makeArena(11, {
      spawn: { x: 74, y: 144 },
      walls: [wall(210, 110, 22, 68, { kind: 'moving', vy: 48, minY: 46, maxY: 174 })],
      bumpers: [bumper(318, 62, 14), bumper(318, 226, 14)],
      targets: [
        ghost(290, 144, 32),
        ghost(382, 86, 34),
        ghost(382, 202, 34),
        crate(424, 144, 2)
      ],
      spikes: [spike(16, 16, 12, 256, true)],
      clearQuote: '"Ain\'t afraid of no pixel ghosts!"'
    }),

    // W13: Laser Gatehouse — Time your launch between pulsing red laser gates!
    () => makeArena(12, {
      spawn: { x: 66, y: 144 },
      walls: [wall(188, 16, 16, 84), wall(188, 188, 16, 84), wall(320, 16, 16, 84), wall(320, 188, 16, 84)],
      lasers: [
        laser(196, 100, 196, 188, { mode: 'timer', period: 3.0, duty: 0.44, phase: 0 }),
        laser(328, 100, 328, 188, { mode: 'timer', period: 3.0, duty: 0.44, phase: 1.5 })
      ],
      bumpers: [bumper(262, 62, 14), bumper(262, 226, 14)],
      targets: [crate(262, 144), crate(392, 82), crate(392, 206), bomb(412, 144, 80)],
      clearQuote: '"Zero laser burns! Smooth timing!"'
    }),

    // W14: Flip-Flop Lasers — Lasers swap ON/OFF every shot!
    () => makeArena(13, {
      spawn: { x: 68, y: 214 },
      walls: [wall(220, 134, 18, 138)],
      lasers: [
        laser(229, 16, 229, 134, { mode: 'shot', active: false }),
        laser(238, 144, 464, 144, { mode: 'shot', active: true })
      ],
      zones: [zone('slime', 284, 52, 66, 62)],
      bumpers: [bumper(144, 72, 15)],
      targets: [crate(316, 82), crate(414, 74), crate(316, 212), bomb(406, 212, 80)],
      clearQuote: '"Shot-toggle lasers solved like chess!"'
    }),

    // W15: BOSS — LASER TURRET PRIME (6-HP Boss + Crossfire Lasers + Boost!)
    () => makeArena(14, {
      spawn: { x: 64, y: 144 },
      zones: [
        zone('boost', 102, 40, 86, 36, { dirX: 1, dirY: 0.25, force: 500 }),
        zone('boost', 102, 212, 86, 36, { dirX: 1, dirY: -0.25, force: 500 })
      ],
      lasers: [
        laser(230, 16, 230, 102, { mode: 'timer', period: 2.8, duty: 0.45, phase: 0 }),
        laser(230, 186, 230, 272, { mode: 'timer', period: 2.8, duty: 0.45, phase: 1.4 })
      ],
      bumpers: [bumper(420, 62, 15), bumper(420, 226, 15)],
      targets: [
        boss({ name: 'TURRET PRIME', color: '#e63946', x: 344, y: 144, r: 24, hp: 6, vy: 76, minY: 64, maxY: 224 }),
        bomb(286, 68, 76),
        bomb(286, 220, 76)
      ],
      clearQuote: '"LASER TURRET PRIME SCRAPPED!! Meltdown complete!"'
    }),

    // W16: Powder Keg Panic — Moving crushers + 3-bomb chain reaction
    () => makeArena(15, {
      spawn: { x: 66, y: 144 },
      walls: [
        wall(166, 56, 18, 86, { kind: 'moving', vy: 64, minY: 28, maxY: 162 }),
        wall(284, 146, 18, 86, { kind: 'moving', vy: -64, minY: 28, maxY: 162 })
      ],
      bumpers: [bumper(230, 144, 15, 'troll')],
      targets: [
        bomb(360, 78, 86),
        bomb(360, 210, 86),
        bomb(420, 144, 86),
        crate(360, 144, 2),
        bird(230, 62, 68, 0, 198, 266)
      ],
      spikes: [spike(16, 16, 448, 10, true)],
      clearQuote: '"Triple powder-keg detonation! Chef\'s kiss!"'
    }),

    // W17: Portal Gauntlet — Twin warp chambers & swooping birds
    () => makeArena(16, {
      spawn: { x: 64, y: 74 },
      walls: [wall(16, 136, 286, 18), wall(284, 16, 18, 120)],
      portals: portalPair('p17a', 236, 74, 'p17b', 68, 214),
      zones: [zone('boost', 112, 194, 86, 42, { dirX: 1, dirY: 0, force: 520 })],
      bumpers: [bumper(388, 214, 16), bumper(388, 74, 16, 'troll')],
      targets: [
        crate(252, 214),
        bird(366, 144, 0, 74, 330, 440, 56, 232),
        crate(426, 144, 2),
        bomb(336, 74, 78)
      ],
      spikes: [spike(16, 260, 180, 12)],
      clearQuote: '"Portal trickshot mastery unlocked!"'
    }),

    // W18: Pinball Blender — High-chaos troll bumper pit!
    () => makeArena(17, {
      spawn: { x: 64, y: 144 },
      zones: [zone('ice', 124, 32, 322, 224)],
      bumpers: [
        bumper(186, 86, 15, 'troll'),
        bumper(186, 202, 15, 'troll'),
        bumper(276, 144, 16, 'neon'),
        bumper(364, 86, 15, 'troll'),
        bumper(364, 202, 15, 'troll')
      ],
      targets: [
        crate(276, 56), crate(276, 232),
        ghost(332, 144, 38),
        crate(424, 86, 2), crate(424, 202, 2)
      ],
      spikes: [spike(452, 114, 12, 60)],
      clearQuote: '"Survived the Pinball Blender without losing a spring!"'
    }),

    // W19: Royal Laser Maze — Multi-room laser & portal precision trial
    () => makeArena(18, {
      spawn: { x: 64, y: 222 },
      walls: [wall(164, 86, 18, 186), wall(306, 16, 18, 186)],
      lasers: [
        laser(173, 16, 173, 86, { mode: 'timer', period: 2.6, duty: 0.46, phase: 0 }),
        laser(315, 202, 315, 272, { mode: 'timer', period: 2.6, duty: 0.46, phase: 1.3 })
      ],
      zones: [zone('slime', 206, 188, 72, 62)],
      bumpers: [bumper(240, 54, 15), bumper(392, 224, 15, 'troll')],
      targets: [
        crate(240, 128),
        bird(388, 144, 68, 0, 344, 438),
        bomb(392, 68, 80),
        crate(426, 68, 2),
        crate(352, 68)
      ],
      clearQuote: '"Royal Laser Maze conquered! One boss left!"'
    }),

    // W20: FINAL BOSS — KING MATCHBOX MECH (8-HP Shielded Mech + Portals + Bombs!)
    () => makeArena(19, {
      spawn: { x: 66, y: 144 },
      portals: portalPair('p20a', 142, 52, 'p20b', 426, 234),
      zones: [zone('boost', 96, 214, 86, 36, { dirX: 1, dirY: -0.2, force: 520 })],
      lasers: [
        laser(224, 16, 224, 86, { mode: 'timer', period: 2.7, duty: 0.44, phase: 0 }),
        laser(224, 202, 224, 272, { mode: 'timer', period: 2.7, duty: 0.44, phase: 1.35 })
      ],
      bumpers: [bumper(252, 144, 14, 'troll'), bumper(424, 58, 15, 'neon')],
      targets: [
        boss({
          name: 'MATCHBOX MECH', color: '#d93829',
          x: 356, y: 144, r: 26, hp: 8,
          vx: 36, vy: 64, minX: 312, maxX: 406, minY: 68, maxY: 220,
          shield: true, shieldAngle: Math.PI, shieldSpeed: 1.55, shieldArc: 1.45
        }),
        bomb(356, 52, 82),
        bomb(356, 236, 82),
        crate(290, 56)
      ],
      clearQuote: '"👑 KING MATCHBOX MECH SHATTERED!! ALL 20 ARENAS CONQUERED!!"'
    })
  ];

  window.SLING_ARENA_META = ARENA_META;
  window.SLING_ARENA_BUILDERS = ARENA_BUILDERS;
  window.SLING_WORLD_W = W;
  window.SLING_WORLD_H = H;
})();
