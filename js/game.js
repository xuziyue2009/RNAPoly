// ============================================================
//  RNA Polymerase 4K Rhythm Game — Game Engine
// ============================================================

// ============ GAME ENGINE ============
class GameEngine {
  constructor() {
    this.audio = new AudioEngine();
    this.state = 'idle';          // idle | countdown | playing | finished
    this.beatmap = [];
    this.notes = [];
    this.songStartTime = 0;
    this.songStartAudio = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboMult = 1;   // Malody combo 加成倍数（初始1，封顶1，下限0）
    this.judgments = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.totalJudged = 0;
    this.animFrame = null;
    this.keyBindings = [...DEFAULT_KEYS];
    this.rebindingLane = -1;
    this.noteSpeed = BASE_NOTE_SPEED;
    this.speedLevel = 2; // index into SPEED_LEVELS (1.0x)
    this.judgeTier = DEFAULT_JUDGE_TIER; // 判定难度档位（0=EASY ~ 4=EXTRA）
    this.offset = DEFAULT_OFFSET;        // 判定偏移（ms，正=提前按）
    this.spawnedUpTo = -1; // 已生成到 beatmap 的哪个索引（在 _loop 中自增）
    this.mods = new Set(); // 启用的 Mod（参见 MODS）

    this._loadSettings();
    this.initSvg();
    this.renderStaticScene();
    this.renderSongList();
    this.renderKeyBindings();
    this.setupInput();
    this._updateSpeedDisplay();
  }

  // ---- Persistence ----
  _loadSettings() {
    this.loadKeyBindings();
    loadSongSelection(); // from songs.js
    try {
      const saved = localStorage.getItem('rnapoly-speed');
      if (saved !== null) {
        const lvl = parseInt(saved);
        if (lvl >= 0 && lvl < SPEED_LEVELS.length) {
          this.speedLevel = lvl;
          this.noteSpeed = BASE_NOTE_SPEED * SPEED_LEVELS[lvl];
        }
      }
    } catch (e) { /* ignore */ }
    try {
      const saved = localStorage.getItem('rnapoly-judge-tier');
      if (saved !== null) {
        const t = parseInt(saved);
        if (t >= 0 && t < JUDGE_TIERS.length) this.judgeTier = t;
      }
    } catch (e) { /* ignore */ }
    try {
      const saved = localStorage.getItem('rnapoly-offset');
      if (saved !== null) {
        const o = parseInt(saved);
        if (!isNaN(o) && Math.abs(o) <= 200) this.offset = o;
      }
    } catch (e) { /* ignore */ }
    try {
      const saved = localStorage.getItem('rnapoly-mods');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          this.mods = new Set(arr.filter(id => MODS[id]));
        }
      }
    } catch (e) { /* ignore */ }
  }
  _saveSettings() {
    this.saveKeyBindings();
    try { localStorage.setItem('rnapoly-speed', String(this.speedLevel)); } catch (e) { /* ignore */ }
    try { localStorage.setItem('rnapoly-judge-tier', String(this.judgeTier)); } catch (e) { /* ignore */ }
    try { localStorage.setItem('rnapoly-offset', String(this.offset)); } catch (e) { /* ignore */ }
    try { localStorage.setItem('rnapoly-mods', JSON.stringify([...this.mods])); } catch (e) { /* ignore */ }
  }

  loadKeyBindings() {
    try {
      const saved = localStorage.getItem('rnapoly-keys');
      if (saved) {
        const arr = JSON.parse(saved);
        if (arr.length === 4) this.keyBindings = arr;
      }
    } catch (e) { /* ignore */ }
  }

  saveKeyBindings() {
    try { localStorage.setItem('rnapoly-keys', JSON.stringify(this.keyBindings)); } catch (e) { /* ignore */ }
  }

  // ---- SVG Construction ----
  initSvg() {
    this.svg = document.getElementById('game-svg');
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '1200');
    bg.setAttribute('height', '750');
    bg.setAttribute('fill', 'url(#bg-grad)');
    this.svg.appendChild(bg);

    this.gBgFx   = this._createGroup();
    this.gDna    = this._createGroup();
    this.gLanes  = this._createGroup();
    this.gNotes  = this._createGroup();
    this.gPol    = this._createGroup();
    this.gRna    = this._createGroup();
    this.gFx     = this._createGroup();
    this.gUI     = this._createGroup();
  }

  _createGroup() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svg.appendChild(g);
    return g;
  }

  // ---- Static Scene ----
  renderStaticScene() {
    // BPM pulse overlay (subtle)
    this._pulseOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this._pulseOverlay.setAttribute('x', 0);
    this._pulseOverlay.setAttribute('y', 0);
    this._pulseOverlay.setAttribute('width', 1200);
    this._pulseOverlay.setAttribute('height', 750);
    this._pulseOverlay.setAttribute('fill', '#4488ff');
    this._pulseOverlay.setAttribute('opacity', '0.03');
    this._pulseOverlay.setAttribute('pointer-events', 'none');
    this.gBgFx.appendChild(this._pulseOverlay);

    // Background particles (animated drift)
    this._bgParticles = [];
    for (let i = 0; i < 40; i++) {
      const cx = Math.random() * 1200, cy = Math.random() * 750, r = 1 + Math.random() * 2.5;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
      c.setAttribute('fill', '#334466'); c.setAttribute('opacity', String(0.2 + Math.random() * 0.5));
      this.gBgFx.appendChild(c);
      this._bgParticles.push({
        el: c, cx, cy,
        vx: (Math.random() - 0.5) * 0.03,
        vy: (Math.random() - 0.5) * 0.03,
      });
    }

    // DNA double helix — dynamic animated backbones
    const topY = 300, botY = 510;
    this._dnaTopY = topY; this._dnaBotY = botY;
    this._dnaPhase = 0;

    // Top backbone (dynamic path)
    this._dnaTopPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this._dnaTopPath.setAttribute('fill', 'none');
    this._dnaTopPath.setAttribute('stroke', '#8899bb');
    this._dnaTopPath.setAttribute('stroke-width', '3');
    this.gDna.appendChild(this._dnaTopPath);

    // Bottom backbone (dynamic path)
    this._dnaBotPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this._dnaBotPath.setAttribute('fill', 'none');
    this._dnaBotPath.setAttribute('stroke', '#6677aa');
    this._dnaBotPath.setAttribute('stroke-width', '2.5');
    this.gDna.appendChild(this._dnaBotPath);

    // Base-pair rungs (stored for animation)
    this._dnaRungs = [];
    for (let x = 80; x < 1160; x += 18) {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('stroke', '#2a3355'); l.setAttribute('stroke-width', '1');
      this.gDna.appendChild(l);
      this._dnaRungs.push({ el: l, x });
    }

    this._updateDnaHelix(0);

    // 4 lanes with large labels + key indicators
    this._laneLabels = [];
    this._keyIndicators = [];
    this._keyPills = [];
    this._laneBgs = [];   // direct rect refs for flash animation
    for (let i = 0; i < LANE_COUNT; i++) {
      // Use <rect> directly (not <use>) so fill/stroke overrides work for flash
      const lb = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      lb.setAttribute('x', 100); lb.setAttribute('y', LANE_Y[i] - 30);
      lb.setAttribute('width', 1060); lb.setAttribute('height', 60);
      lb.setAttribute('rx', 10); lb.setAttribute('fill', '#0d0d2a');
      lb.setAttribute('stroke', '#223355'); lb.setAttribute('stroke-width', '1');
      lb.setAttribute('opacity', '0.6');
      this.gLanes.appendChild(lb);
      this._laneBgs.push(lb);

      // Large DNA→RNA label on the left side of each lane
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', 108); txt.setAttribute('y', LANE_Y[i] + 7);
      txt.setAttribute('fill', '#ffffff'); txt.setAttribute('font-size', '16');
      txt.setAttribute('font-weight', 'bold');
      txt.setAttribute('font-family', 'monospace');
      txt.textContent = DNA_BASES[i] + ' → ' + RNA_BASES[i];
      this.gLanes.appendChild(txt);
      this._laneLabels.push(txt);

      // Large key letter indicator at the hit zone
      const keyGrp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      // Background pill
      const pill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      pill.setAttribute('x', -16); pill.setAttribute('y', -15);
      pill.setAttribute('width', 32); pill.setAttribute('height', 30);
      pill.setAttribute('rx', 8); pill.setAttribute('fill', '#0a0a22');
      pill.setAttribute('stroke', BASE_COLORS[i]); pill.setAttribute('stroke-width', '2');
      pill.setAttribute('opacity', '0.85');
      keyGrp.appendChild(pill);
      const keyTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      keyTxt.setAttribute('y', 7); keyTxt.setAttribute('fill', BASE_COLORS[i]);
      keyTxt.setAttribute('font-size', '20'); keyTxt.setAttribute('font-weight', '900');
      keyTxt.setAttribute('font-family', 'monospace'); keyTxt.setAttribute('text-anchor', 'middle');
      keyTxt.textContent = this._codeToLabel(this.keyBindings[i]);
      keyGrp.appendChild(keyTxt);
      keyGrp.setAttribute('transform', `translate(${HIT_X + 50},${LANE_Y[i]})`);
      this.gPol.appendChild(keyGrp);
      this._keyIndicators.push(keyTxt);
      this._keyPills.push(pill);
    }

    // RNA Polymerase
    const pol = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    pol.setAttribute('href', '#rna-polymerase');
    pol.setAttribute('x', HIT_X - 55);
    pol.setAttribute('y', 330);
    this.gPol.appendChild(pol);

    // Approach preview dots (right side of each lane)
    this._previewDots = [];
    const PREVIEW_X = 1130;
    for (let i = 0; i < LANE_COUNT; i++) {
      const dots = [];
      for (let j = 0; j < 3; j++) {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', PREVIEW_X + j * 22);
        dot.setAttribute('cy', LANE_Y[i]);
        dot.setAttribute('r', 4);
        dot.setAttribute('fill', '#1a1a3e');
        dot.setAttribute('stroke', '#334466');
        dot.setAttribute('stroke-width', '1');
        dot.setAttribute('opacity', '0.5');
        this.gPol.appendChild(dot);
        dots.push(dot);
      }
      this._previewDots.push(dots);
    }

    // Hit-zone markers (colored per lane)
    for (let i = 0; i < LANE_COUNT; i++) {
      const hm = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      hm.setAttribute('href', '#hit-' + DNA_BASES[i]);
      hm.setAttribute('x', HIT_X); hm.setAttribute('y', LANE_Y[i]);
      this.gPol.appendChild(hm);
    }

    // Growing RNA strand
    this.rnaStrandX = HIT_X + 40;
    this.rnaStrandY = 540;
    this.rnaBases = [];
    const rnaLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    rnaLabel.setAttribute('x', HIT_X + 20); rnaLabel.setAttribute('y', 530);
    rnaLabel.setAttribute('fill', '#556688'); rnaLabel.setAttribute('font-size', '10');
    rnaLabel.setAttribute('font-family', 'sans-serif');
    rnaLabel.textContent = 'RNA 产物 →';
    this.gRna.appendChild(rnaLabel);
  }

  // ---- Song Selection UI ----
  // 预计算并缓存每首歌的难度（只需一次，懒加载）
  _songDiff(i) {
    const song = SONGS[i];
    if (song._diff) return song._diff;
    try {
      const midiBytes = decodeMidiBase64(song.midiBase64);
      const parsed = parseMidi(midiBytes);
      const beatmap = buildBeatmap(parsed);
      song._diff = computeDifficulty(beatmap);
    } catch (e) {
      song._diff = { nps: 0, peakNps: 0, level: DIFF_LEVELS[0], stars: 1 };
    }
    return song._diff;
  }

  renderSongList() {
    const container = document.getElementById('song-list');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < SONGS.length; i++) {
      const song = SONGS[i];
      const card = document.createElement('div'); card.className = 'song-card';
      if (i === currentSongIndex) card.classList.add('active');
      const title = document.createElement('div'); title.className = 's-title';
      title.textContent = song.title;
      const sub = document.createElement('div'); sub.className = 's-sub';
      sub.textContent = song.titleEn + ' · ' + song.bpm + ' BPM';
      card.appendChild(title); card.appendChild(sub);

      // 难度星级
      const diff = this._songDiff(i);
      const diffEl = document.createElement('div'); diffEl.className = 's-diff';
      diffEl.textContent = '★'.repeat(diff.stars)
        + ' · ~Lv.' + diff.level.lv + ' ' + diff.level.name
        + ' · NPS ' + diff.nps.toFixed(1) + (diff.peakNps > diff.nps + 0.3 ? ' /峰值' + diff.peakNps.toFixed(1) : '');
      card.appendChild(diffEl);

      card.addEventListener('click', () => {
        if (selectSong(i)) {
          this.renderSongList();
        }
      });
      container.appendChild(card);
    }
  }

  // ---- Key Binding UI ----
  renderKeyBindings() {
    const container = document.getElementById('keybind-display');
    container.innerHTML = '';
    for (let i = 0; i < LANE_COUNT; i++) {
      const lane = document.createElement('div'); lane.className = 'kb-lane';

      const color = document.createElement('div'); color.className = 'kb-color';
      color.style.background = BASE_COLORS[i]; color.textContent = DNA_BASES[i];

      const keyEl = document.createElement('div'); keyEl.className = 'kb-key';
      keyEl.textContent = this._codeToLabel(this.keyBindings[i]);
      keyEl.dataset.lane = i;
      keyEl.addEventListener('click', () => this._startRebind(i, keyEl));
      if (this.rebindingLane === i) keyEl.classList.add('rebinding');

      const rna = document.createElement('div'); rna.className = 'kb-rna';
      rna.textContent = '按此键→合成 ' + RNA_BASES[i];

      lane.appendChild(color); lane.appendChild(keyEl); lane.appendChild(rna);
      container.appendChild(lane);
    }
    // Also refresh in-game key indicators if scene is built
    this._refreshKeyIndicators();
  }

  _refreshKeyIndicators() {
    if (!this._keyIndicators) return;
    for (let i = 0; i < LANE_COUNT; i++) {
      this._keyIndicators[i].textContent = this._codeToLabel(this.keyBindings[i]);
    }
  }

  _codeToLabel(code) {
    const m = code.match(/^Key([A-Z])$/);
    if (m) return m[1];
    if (code === 'Space') return '␣';
    if (code.startsWith('Digit')) return code.slice(5);
    if (code === 'ArrowLeft')  return '←';
    if (code === 'ArrowRight') return '→';
    if (code === 'ArrowUp')    return '↑';
    if (code === 'ArrowDown')  return '↓';
    return code;
  }

  _startRebind(lane, el) {
    if (this.rebindingLane >= 0) return;
    this.rebindingLane = lane;
    el.classList.add('rebinding');
    el.textContent = '...';
    const handler = (e) => {
      e.preventDefault(); e.stopPropagation();
      this.keyBindings[lane] = e.code;
      this.rebindingLane = -1;
      this._saveSettings();
      this.renderKeyBindings();
      document.removeEventListener('keydown', handler, true);
    };
    document.addEventListener('keydown', handler, true);
  }

  // ---- Input ----
  setupInput() {
    this._keyStates = {};
    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (this.rebindingLane >= 0) return;

      // Visual key press feedback
      const lane = this.keyBindings.indexOf(e.code);
      if (lane >= 0 && this._keyPills && this._keyPills[lane]) {
        this._keyPills[lane].setAttribute('fill', BASE_COLORS[lane]);
        this._keyPills[lane].setAttribute('opacity', '0.9');
        this._keyPills[lane].setAttribute('stroke-width', '3');
      }

      if (this.state === 'idle' && e.code === 'Space') { this.start(); return; }
      if (e.code === 'Escape') { this._togglePause(); return; }
      // Speed adjustment (only on title screen)
      if ((e.code === 'BracketLeft' || e.code === 'BracketRight') && this.state === 'idle') {
        if (e.code === 'BracketRight' && this.speedLevel < SPEED_LEVELS.length - 1) this.speedLevel++;
        if (e.code === 'BracketLeft' && this.speedLevel > 0) this.speedLevel--;
        this.noteSpeed = BASE_NOTE_SPEED * SPEED_LEVELS[this.speedLevel];
        this._saveSettings();
        this._updateSpeedDisplay();
        return;
      }
      // Judge tier adjustment (only on title screen): Slash = harder, Period = easier
      if ((e.code === 'Slash' || e.code === 'Period') && this.state === 'idle') {
        const delta = e.code === 'Slash' ? 1 : -1;
        this.judgeTier = clamp(this.judgeTier + delta, 0, JUDGE_TIERS.length - 1);
        this._saveSettings();
        this._updateSpeedDisplay();
        return;
      }
      // Offset calibration (only on title screen): Minus = later, Equal = earlier
      if ((e.code === 'Minus' || e.code === 'Equal') && this.state === 'idle') {
        this.offset += e.code === 'Minus' ? 4 : -4;
        this.offset = clamp(this.offset, -200, 200);
        this._saveSettings();
        this._updateSpeedDisplay();
        return;
      }
      // Mod 切换（标题界面）：Digit1~5 对应 DASH/RUSH/SLOW/FLIP/HIDE
      if (MOD_ID_BY_KEY[e.code] && this.state === 'idle') {
        this._toggleMod(MOD_ID_BY_KEY[e.code]);
        this._updateSpeedDisplay();
        return;
      }
      if (this.state === 'playing') {
        if (lane >= 0) this._onKeyPress(lane);
      }
      if (this.state === 'finished' && e.code === 'Space') { this.start(); }
      this._keyStates[e.code] = true;
    });
    document.addEventListener('keyup', (e) => {
      this._keyStates[e.code] = false;
      const lane = this.keyBindings.indexOf(e.code);
      if (lane >= 0 && this._keyPills && this._keyPills[lane]) {
        this._keyPills[lane].setAttribute('fill', '#0a0a22');
        this._keyPills[lane].setAttribute('opacity', '0.85');
        this._keyPills[lane].setAttribute('stroke-width', '2');
      }
    });
  }

  // ---- Mod 系统辅助 ----
  // 有效判定窗口：基础窗口 × 速度类 Mod 的窗口缩放（加速缩窗、减速放窗）
  _getEffectiveWindow() {
    const win = getJudgeWindows(this.judgeTier);
    let mult = 1;
    for (const id of this.mods) {
      const m = MODS[id];
      if (m && m.windowMult) mult *= m.windowMult;
    }
    if (mult === 1) return win;
    return { perfect: win.perfect * mult, great: win.great * mult, good: win.good * mult, miss: win.miss, gradeMult: win.gradeMult };
  }
  // 有效下落速度：基础速度 × 速度类 Mod 缩放
  _effectiveNoteSpeed() {
    let mult = 1;
    for (const id of this.mods) {
      const m = MODS[id];
      if (m && m.speedMult) mult *= m.speedMult;
    }
    return this.noteSpeed * mult;
  }
  // 有效轨道：FLIP 镜像时左右翻转映射（lane 0<->3、1<->2）
  toDisplayLane(lane) {
    if (this.mods.has('FLIP')) return 3 - lane;
    return lane;
  }
  fromDisplayLane(lane) {
    if (this.mods.has('FLIP')) return 3 - lane;
    return lane;
  }
  _toggleMod(id) {
    if (!MODS[id]) return;
    if (this.mods.has(id)) this.mods.delete(id);
    else this.mods.add(id);
    this._saveSettings();
    // 若在游戏中，HIDE/FLIP 立即刷新可见性/布局
    this._applyModVisual();
    this._updateModHud();
  }

  _onKeyPress(lane) {
    if (this.state !== 'playing') return;

    const win = this._getEffectiveWindow();
    const songTime = (this.audio.currentTime - this.songStartAudio) * 1000 - this.offset;
    // Adjust hit window: larger offset = notes judged earlier (more tolerant)
    let bestNote = null, bestDist = Infinity;
    const effLane = this.fromDisplayLane(lane);
    for (const note of this.notes) {
      if (note.lane !== effLane || note.hit || note.missed) continue;
      if (note.isHold && note.holding) continue; // 正在按住的长按音符不可重复命中
      const dist = Math.abs(songTime - note.time);
      if (dist < win.good && dist < bestDist) { bestDist = dist; bestNote = note; }
    }

    if (bestNote) {
      const offset = songTime - bestNote.time;
      let judgmentId;
      if (Math.abs(offset) <= win.perfect)  { judgmentId = 'perfect'; }
      else if (Math.abs(offset) <= win.great) { judgmentId = 'great'; }
      else                                    { judgmentId = 'good'; }

      // Malody scoring: base points × (1 + comboMult), multiplier updated then applied
      const prevComboMult = this.comboMult;
      // Update multiplier from judgment first
      this.comboMult = clamp(this.comboMult + COMBO_MOD[judgmentId], 0, 1);
      const points = Math.round(BASE_POINTS[judgmentId] * (1 + this.comboMult) * win.gradeMult);

      const prevCombo = this.combo;

      if (bestNote.isHold) {
        // Hold head 命中：进入 holding 状态，不立即 hit，直到持续按住完成
        bestNote.headJudgment = judgmentId;    // 记录头部判定
        bestNote.holding = true;                // 正在按住
        bestNote.holdStartTime = songTime;
        bestNote.holdEndTime = bestNote.time + bestNote.durationMs;
        this._showJudgment(judgmentId, lane, offset);
        this.audio.playHit(lane, judgmentId);
        this._spawnParticles(lane, judgmentId);
        this._flashLane(lane);
        this._pulsePolymerase();
        // head 也计入 combo 与判定数（部分游戏 Hold head/body/tail 各计一次，这里 head 计入）
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        this.judgments[judgmentId]++;
        this.totalJudged++;
        this._latestComboMult = this.comboMult;
        this._updateUI();
        return;
      }

      bestNote.hit = true;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.score += points;
      this.judgments[judgmentId]++;
      this.totalJudged++;
      this._latestComboMult = this.comboMult;

      this.audio.playHit(lane, judgmentId);
      this._animateNoteHit(bestNote);
      this._showJudgment(judgmentId, lane, offset);
      this._spawnParticles(lane, judgmentId);
      this._addRnaBase(lane);
      this._flashLane(lane);
      this._pulsePolymerase();
      this._checkComboMilestones(prevCombo);
    } else {
      // 空按（按了键但该 lane 附近没有可命中的音符）—— 严格模式：断 combo + 记 miss
      this.audio.playMiss();
      const hadCombo = this.combo > 0;
      this.combo = 0;
      // Malody: MISS drops combo multiplier by 0.32
      this.comboMult = clamp(this.comboMult + COMBO_MOD.miss, 0, 1);
      this.judgments.miss++;
      this.totalJudged++;
      this._showJudgmentMiss(lane);
      if (hadCombo) this._animateComboBreak();
    }
    this._updateUI();
  }

  // ---- Visual Effects ----
  _showJudgment(judgment, lane, offset = 0) {
    const el = document.getElementById('judgment-pop');
    const labels = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD' };
    const colors = { perfect: '#ffd700', great: '#51cf66', good: '#339af0' };
    const absOff = Math.abs(offset);
    const timing = offset > 8 ? '  LATE' : offset < -8 ? '  EARLY' : '';
    el.innerHTML = labels[judgment]
      + '<span style=\"font-size:0.7em;opacity:0.8\">' + timing + '</span>'
      + '<span style=\"font-size:0.55em;display:block;opacity:0.7\">±' + absOff.toFixed(0) + 'ms</span>';
    el.style.color = colors[judgment];
    el.style.top = (LANE_Y[lane] - 30) + 'px';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  _spawnParticles(lane, judgment) {
    const y = LANE_Y[lane];
    const count = judgment === 'perfect' ? 18 : judgment === 'great' ? 12 : 8;
    const colors = {
      perfect: ['#ffd700', '#ffec99', '#fff3bf', '#ffaa00'],
      great:   ['#51cf66', '#8ce99a', '#b2f2bb', BASE_COLORS[lane]],
      good:    [BASE_COLORS[lane], BASE_COLORS[lane]],
    };
    const palette = colors[judgment] || colors.good;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div'); p.className = 'particle';
      p.style.left = HIT_X + 'px'; p.style.top = y + 'px';
      const size = 3 + Math.random() * (judgment === 'perfect' ? 8 : 5);
      p.style.width = size + 'px'; p.style.height = size + 'px';
      p.style.background = palette[Math.floor(Math.random() * palette.length)];
      p.style.boxShadow = '0 0 ' + (4 + Math.random() * 6) + 'px ' + p.style.background;
      const angle = Math.random() * Math.PI * 2;
      const dist = 25 + Math.random() * (judgment === 'perfect' ? 70 : 45);
      p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(angle) * dist + 'px - 10px');
      document.getElementById('game-screen').appendChild(p);
      setTimeout(() => p.remove(), 700);
    }
  }

  // Note hit: scale up + fade out (scale preserved in loop transform now)
  _animateNoteHit(note) {
    note.el.setAttribute('opacity', '0');
    note.el.style.transition = 'opacity 0.15s ease-out';
    note._hitAnimated = true;
  }

  // Note miss: red flash overlay + dim
  _animateNoteMiss(note) {
    note.el.setAttribute('opacity', '0.35');
    note.flashEl.setAttribute('opacity', '0.55');
    setTimeout(() => { note.flashEl.setAttribute('opacity', '0'); }, 150);
  }

  _flashLane(lane) {
    const lb = this._laneBgs[lane];
    if (lb) {
      lb.setAttribute('opacity', '1');
      lb.setAttribute('fill', BASE_COLORS[lane]);
      lb.setAttribute('stroke', '#fff');
      lb.setAttribute('stroke-width', '2');
      setTimeout(() => {
        lb.setAttribute('opacity', '0.6');
        lb.setAttribute('fill', '#0d0d2a');
        lb.setAttribute('stroke', '#223355');
        lb.setAttribute('stroke-width', '1');
      }, 120);
    }
    // Also pulse the key indicator pill
    if (this._keyIndicators && this._keyIndicators[lane]) {
      const parent = this._keyIndicators[lane].parentNode;
      const pill = parent.querySelector('rect');
      if (pill) {
        pill.setAttribute('fill', BASE_COLORS[lane]);
        pill.setAttribute('opacity', '1');
        setTimeout(() => {
          pill.setAttribute('fill', '#0a0a22');
          pill.setAttribute('opacity', '0.85');
        }, 150);
      }
    }
  }

  _addRnaBase(lane) {
    const x = this.rnaStrandX + this.rnaBases.length * 26;
    const y = this.rnaStrandY;
    const rna = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    rna.setAttribute('href', '#rna-' + RNA_BASES[lane]);
    rna.setAttribute('x', x); rna.setAttribute('y', y);
    rna.setAttribute('opacity', '0');
    rna.setAttribute('transform', 'translate(0,-12)');
    rna.style.transition = 'opacity 0.25s ease-out, transform 0.25s ease-out';
    this.gRna.appendChild(rna);
    this.rnaBases.push(rna);
    // Update backbone polyline
    this._updateRnaBackbone();
    // Animate in
    requestAnimationFrame(() => {
      rna.setAttribute('opacity', '1');
      rna.setAttribute('transform', 'translate(0,0)');
    });
  }

  _updateRnaBackbone() {
    if (!this._rnaBackbone) {
      this._rnaBackbone = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      this._rnaBackbone.setAttribute('fill', 'none');
      this._rnaBackbone.setAttribute('stroke', '#7799cc');
      this._rnaBackbone.setAttribute('stroke-width', '2');
      this._rnaBackbone.setAttribute('opacity', '0.6');
      this.gRna.insertBefore(this._rnaBackbone, this.gRna.firstChild);
    }
    const pts = [];
    for (let i = 0; i < this.rnaBases.length; i++) {
      const bx = this.rnaStrandX + i * 26 + 12;
      const by = this.rnaStrandY + (i % 2 === 0 ? -4 : 4);
      pts.push(bx + ',' + by);
    }
    this._rnaBackbone.setAttribute('points', pts.join(' '));
  }

  // Combo milestone check
  _checkComboMilestones(prevCombo) {
    const milestones = [10, 30, 50, 100];
    for (const m of milestones) {
      if (prevCombo < m && this.combo >= m) {
        this._showComboMilestone(m);
      }
    }
  }

  _showComboMilestone(combo) {
    const el = document.getElementById('ui-combo');
    el.classList.add('show');
    el.style.transform = 'translateX(-50%) scale(1.4)';
    el.style.textShadow = '0 0 30px rgba(255,200,0,0.9)';
    setTimeout(() => {
      el.style.transform = 'translateX(-50%) scale(1)';
      el.style.textShadow = '0 0 20px rgba(255,200,0,0.5)';
    }, 300);
  }

  // DNA helix animation
  _updateDnaHelix(songTime) {
    const phase = songTime * 0.0003; // slow undulation
    this._dnaPhase = phase;
    const topY = this._dnaTopY, botY = this._dnaBotY;
    const amp = 8, freq = 0.04;

    // Generate backbone paths
    let topD = '', botD = '';
    for (let x = 60; x <= 1140; x += 4) {
      const yOff = Math.sin(x * freq + phase) * amp;
      topD += (x === 60 ? 'M' : 'L') + x + ',' + (topY + yOff) + ' ';
      botD += (x === 60 ? 'M' : 'L') + x + ',' + (botY - yOff) + ' ';
    }
    this._dnaTopPath.setAttribute('d', topD);
    this._dnaBotPath.setAttribute('d', botD);

    // Update rungs
    for (const rung of this._dnaRungs) {
      const yOff = Math.sin(rung.x * freq + phase) * amp;
      rung.el.setAttribute('x1', rung.x);
      rung.el.setAttribute('y1', topY + yOff);
      rung.el.setAttribute('x2', rung.x);
      rung.el.setAttribute('y2', botY - yOff);
    }
  }

  // Background pulse synced to BPM
  _pulseBackground(songTime) {
    if (!this._pulseOverlay) return;
    // 120 BPM = 500ms per quarter note
    const beatPhase = (songTime % 500) / 500; // 0..1 over each beat
    const pulse = 0.03 * Math.sin(beatPhase * Math.PI * 2);
    this._pulseOverlay.setAttribute('opacity', String(0.05 + pulse));
  }

  // Polymerase pulse
  _pulsePolymerase() {
    const pol = this.gPol.querySelector('use[href="#rna-polymerase"]');
    if (!pol) return;
    pol.setAttribute('filter', 'url(#glow-strong)');
    setTimeout(() => pol.removeAttribute('filter'), 200);
  }

  // ---- UI Updates ----
  _updateUI() {
    document.getElementById('ui-score').textContent = this.score.toLocaleString();
    if (this.totalJudged > 0) {
      const acc = Math.round(
        (this.judgments.perfect * ACC_WEIGHTS.perfect +
         this.judgments.great * ACC_WEIGHTS.great +
         this.judgments.good * ACC_WEIGHTS.good) /
        this.totalJudged
      );
      document.getElementById('ui-accuracy').textContent = acc + '%';
    }
    const comboEl = document.getElementById('ui-combo');
    const comboNum = document.getElementById('combo-num');
    if (this.combo >= 10) {
      comboEl.classList.add('show');
      comboNum.textContent = this.combo;
    } else {
      comboEl.classList.remove('show');
    }
  }

  _updateProgress(songTime) {
    if (this.beatmap.length === 0) return;
    const total = this.beatmap[this.beatmap.length - 1].time + 1000;
    const pct = Math.min(100, Math.round(songTime / total * 100));
    document.getElementById('ui-progress').textContent = pct + '%';
    document.getElementById('progress-fill').style.width = pct + '%';
  }

  _updateSpeedDisplay() {
    const el = document.getElementById('ui-speed');
    if (el) el.textContent = SPEED_LEVELS[this.speedLevel].toFixed(2) + 'x';
    const st = document.getElementById('settings-status');
    if (st) {
      const tierName = JUDGE_TIERS[this.judgeTier].name;
      const modStr = this.mods.size ? '  ·  Mod: ' + [...this.mods].map(id => MODS[id].label).join('/') : '';
      st.textContent = `倍速 ${SPEED_LEVELS[this.speedLevel].toFixed(2)}x  ·  判定 ${tierName}  ·  偏移 ${this.offset >= 0 ? '+' : ''}${this.offset}ms${modStr}`;
    }
    this._updateModHud();
  }

  // ---- Mod 视觉 / HUD ----
  // 切换 Mod 后刷新已有音符的可见性与布局（HIDE 隐藏、FLIP 显示位置）
  _applyModVisual() {
    // 已生成的音符：HIDE 需要重新设置可见性；FLIP 显示位置在 _loop 中实时计算，无需手动改
    if (!this.notes) return;
    const hide = this.mods.has('HIDE');
    for (const note of this.notes) {
      if (!note.useEl) continue;
      note.useEl.setAttribute('opacity', hide ? '0' : '1');
      if (note.holdBodyEl && !note.hit) {
        note.holdBodyEl.setAttribute('opacity', hide ? '0' : String(HOLD_BODY_ALPHA));
      }
    }
  }
  // 更新标题界面 Mod HUD（显示当前激活 Mod 及其说明）
  _updateModHud() {
    const hud = document.getElementById('mod-status');
    if (!hud) return;
    const active = [...this.mods];
    if (active.length === 0) {
      hud.textContent = 'Mod: 无';
      hud.classList.remove('mod-active');
      hud.classList.add('mod-inactive');
    } else {
      hud.textContent = 'Mod: ' + active.map(id => {
        const key = Object.keys(MOD_ID_BY_KEY).find(k => MOD_ID_BY_KEY[k] === id) || '';
        return MODS[id].label + '(按' + key.replace('Digit', '') + ')';
      }).join(' · ');
      hud.classList.remove('mod-inactive');
      hud.classList.add('mod-active');
    }
  }

  _updatePreviewDots(songTime) {
    if (!this._previewDots) return;
    // Find next 3 notes per lane
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const upcoming = [];
      for (let k = this.spawnedUpTo + 1; k < this.beatmap.length && upcoming.length < 3; k++) {
        if (this.beatmap[k].lane === lane) upcoming.push(this.beatmap[k]);
      }
      for (let j = 0; j < 3; j++) {
        const dot = this._previewDots[lane][j];
        if (j < upcoming.length) {
          dot.setAttribute('fill', BASE_COLORS[lane]);
          dot.setAttribute('stroke', '#fff');
          dot.setAttribute('opacity', String(0.35 + j * 0.2));
          dot.setAttribute('r', String(3 + (2 - j) * 1.5));
        } else {
          dot.setAttribute('fill', '#1a1a3e');
          dot.setAttribute('stroke', '#334466');
          dot.setAttribute('opacity', '0.25');
          dot.setAttribute('r', '3');
        }
      }
    }
  }

  // ---- Pause ----
  _togglePause() {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    if (this.state === 'playing') {
      this.state = 'paused';
      this._pauseTime = performance.now();
      document.getElementById('pause-overlay').classList.add('show');
    } else {
      const pauseDuration = performance.now() - this._pauseTime;
      this.songStartTime += pauseDuration;
      this.songStartAudio += pauseDuration / 1000;
      this.state = 'playing';
      document.getElementById('pause-overlay').classList.remove('show');
      this._loop();
    }
  }

  // ---- Game Flow ----
  start() {
    this.state = 'countdown';
    this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.comboMult = 1;
    this.judgments = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.totalJudged = 0;
    this.notes = [];
    this.rnaBases = [];
    this.beatmap = [];
    this._rnaBackbone = null;

    this.initSvg();
    this.renderStaticScene();

    while (this.gNotes.firstChild) this.gNotes.removeChild(this.gNotes.firstChild);
    const rnaChildren = [...this.gRna.children];
    for (let i = 1; i < rnaChildren.length; i++) rnaChildren[i].remove();

    document.getElementById('ui-score').textContent = '0';
    document.getElementById('ui-progress').textContent = '0%';
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('ui-accuracy').textContent = '--';
    document.getElementById('ui-combo').classList.remove('show');
    document.getElementById('pause-overlay').classList.remove('show');
    this._updateSpeedDisplay();

    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    this._doCountdown().catch(e => {
      console.error('Countdown failed:', e);
      this.state = 'idle';
      document.getElementById('game-screen').classList.add('hidden');
      document.getElementById('title-screen').classList.remove('hidden');
    });
  }

  async _doCountdown() {
    await this.audio.init();

    try {
      const song = getCurrentSong();
      const midiBytes = decodeMidiBase64(song.midiBase64);
      const parsed = parseMidi(midiBytes);
      this.beatmap = buildBeatmap(parsed);
    } catch (e) {
      console.error('MIDI parse failed:', e);
      this.state = 'idle';
      document.getElementById('game-screen').classList.add('hidden');
      document.getElementById('title-screen').classList.remove('hidden');
      return;
    }

    // Start rendering notes — travel time ~2189 ms
    const travelMs = (SPAWN_X - HIT_X) / this.noteSpeed;
    this.songStartTime = performance.now() + travelMs;
    this.spawnedUpTo = -1;
    this.state = 'countdown';
    this._loop();

    // Countdown (2 seconds) with metronome clicks
    const overlay = document.getElementById('countdown-overlay');
    const text = document.getElementById('countdown-text');
    overlay.classList.add('show');
    for (const num of ['3', '2', '1', 'GO!']) {
      text.textContent = num;
      text.style.animation = 'none';
      void text.offsetWidth;
      text.style.animation = 'count-pop .5s ease-out';
      if (num === 'GO!') {
        this.audio.playHit(0);
        setTimeout(() => this.audio.playHit(3), 100);
      } else {
        this.audio.playTick();
      }
      await new Promise(r => setTimeout(r, 500));
    }
    overlay.classList.remove('show');

    // Schedule audio to start at songTime = 0
    const songTimeNow = performance.now() - this.songStartTime;
    const audioLeadIn = Math.max(0.05, -songTimeNow / 1000);
    this.songStartAudio = this.audio.currentTime + audioLeadIn;
    this.audio.scheduleSong(this.beatmap, audioLeadIn);
    this.state = 'playing';
  }

  _loop() {
    if (this.state === 'idle' || this.state === 'finished') {
      if (this.animFrame) cancelAnimationFrame(this.animFrame);
      return;
    }
    if (this.state === 'paused') {
      // Keep rendering static frame but don't update
      this.animFrame = requestAnimationFrame(() => this._loop());
      return;
    }

    // Animate background particles
    if (this._bgParticles) {
      for (const p of this._bgParticles) {
        p.cx += p.vx; p.cy += p.vy;
        if (p.cx < 0) p.cx = 1200; if (p.cx > 1200) p.cx = 0;
        if (p.cy < 0) p.cy = 750; if (p.cy > 750) p.cy = 0;
        p.el.setAttribute('cx', String(p.cx));
        p.el.setAttribute('cy', String(p.cy));
      }
    }

    const now = performance.now();
    const songTime = now - this.songStartTime;

    // Animate DNA helix (clamp for countdown phase)
    const visTime = Math.max(0, songTime);
    if (this._dnaTopPath) this._updateDnaHelix(visTime);

    // BPM-synced background pulse
    this._pulseBackground(visTime);

    // Spawn notes
    const effSpeed = this._effectiveNoteSpeed();
    while (this.spawnedUpTo + 1 < this.beatmap.length) {
      const next = this.beatmap[this.spawnedUpTo + 1];
      const noteScreenX = HIT_X + (next.time - songTime) * effSpeed;
      if (noteScreenX <= SPAWN_X) {
        this.spawnedUpTo++;
        this._spawnNote(next);
      } else break;
    }

    // Update approach preview dots
    this._updatePreviewDots(songTime);

    // Update notes
    const toRemove = [];
    for (let i = 0; i < this.notes.length; i++) {
      const note = this.notes[i];
      const x = HIT_X + (note.time - songTime) * effSpeed;
      const scale = note._hitAnimated ? ' scale(1.3)' : '';
      note.el.setAttribute('transform', `translate(${x},${LANE_Y[this.toDisplayLane(note.lane)]})${scale}`);
      note.screenX = x;

      const distToHit = Math.abs(x - HIT_X);
      if (distToHit < 40 && !note.hit && !note.missed) {
        note.useEl.setAttribute('filter', 'url(#glow)');
      } else if (note.useEl) {
        note.useEl.removeAttribute('filter');
      }

      // Miss detection（跳过正在 holding 的 Hold 音符，由下方 Hold 检测处理）
      if (this.state === 'playing' && !note.hit && !note.missed && !(note.isHold && note.holding)) {
        const win = this._getEffectiveWindow();
        if (songTime > note.time + win.good) {
          note.missed = true;
          this._animateNoteMiss(note);
          const hadCombo = this.combo > 0;
          this.combo = 0;
          this.judgments.miss++;
          this.totalJudged++;
          this._showJudgmentMiss(note.lane);
          if (hadCombo) this._animateComboBreak();
          this._updateUI();
        }
      }

      if (x < -60) { toRemove.push(i); if (note.el.parentNode) note.el.remove(); }

      // Hold 持续按住检测
      if (this.state === 'playing' && note.isHold && note.holding && !note.hit && !note.missed) {
        const laneKey = this.keyBindings[this.fromDisplayLane(note.lane)];
        const stillHolding = this._keyStates[laneKey];
        const win = this._getEffectiveWindow();

        if (songTime >= note.holdEndTime && stillHolding) {
          // 完整按住到尾部 —— Hold 命中
          // 尾部判定（越接近尾部perfect越好，这里按头部判定给基础分，尾部奖励）
          note.hit = true;
          note.holding = false;
          // body 进度补满
          if (note.holdBodyEl) note.holdBodyEl.setAttribute('opacity', '0');
          const tailPts = Math.round(BASE_POINTS[note.headJudgment || 'perfect'] * HOLD_SCORE_MULT * win.gradeMult);
          // 用当前 comboMult 计算
          this.comboMult = clamp(this.comboMult + COMBO_MOD[note.headJudgment || 'perfect'], 0, 1);
          this.score += Math.round(tailPts * (1 + this.comboMult));
          this.combo++;
          if (this.combo > this.maxCombo) this.maxCombo = this.combo;
          this._addRnaBase(note.lane);
          this._animateNoteHit(note);
          this._showJudgment(note.headJudgment || 'perfect', note.lane, 0);
          this._spawnParticles(note.lane, note.headJudgment || 'perfect');
          this._checkComboMilestones(0);
          this._updateUI();
        } else if (!stillHolding && songTime < note.holdEndTime - win.good) {
          // 松开过早（还没到尾部）—— Hold 断开，断 combo
          note.holding = false;
          note.hit = true;      // 视为已处理，避免重复
          const hadCombo = this.combo > 0;
          this.combo = 0;
          this.judgments.miss++;
          this.totalJudged++;
          this.comboMult = clamp(this.comboMult + COMBO_MOD.miss, 0, 1);
          this._animateNoteMiss(note);
          this._showJudgmentMiss(note.lane, false);
          if (hadCombo) this._animateComboBreak();
          this._updateUI();
        } else if (note.holdBodyEl) {
          // 更新 body 消耗进度（命中线左侧长度按剩余按住时间消耗）
          const remain = Math.max(0, note.holdEndTime - songTime);
          const remainLen = Math.max(0, remain * effSpeed);
          note.holdBodyEl.setAttribute('width', String(remainLen));
        }
      }
    }
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.notes.splice(toRemove[i], 1);
    }

    // Progress
    if (this.state === 'playing') {
      this._updateProgress(songTime);
    }

    // End detection
    if (this.state === 'playing' && this.beatmap.length > 0) {
      const lastTime = this.beatmap[this.beatmap.length - 1].time;
      const allSpawned = this.spawnedUpTo >= this.beatmap.length - 1;
      const allDone = this.notes.filter(n => !n.hit && !n.missed).length === 0;
      if (allSpawned && allDone && songTime > lastTime + 1500) {
        this._endGame();
        return;
      }
    }

    this.animFrame = requestAnimationFrame(() => this._loop());
  }

  _spawnNote(beat) {
    // Wrap note in <g> for proper hit/miss overlays and scale persistence
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('opacity', '0');
    g.style.transition = 'opacity 0.25s ease-in';

    const useEl = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    useEl.setAttribute('href', '#note-' + beat.dnaBase);
    g.appendChild(useEl);
    // HIDE Mod：隐藏下落音符（保留判定逻辑，凭节奏/命中线提示玩）
    let noteHidden = false;
    if (this.mods.has('HIDE')) {
      noteHidden = true;
      useEl.setAttribute('opacity', '0');
      g.setAttribute('opacity', '0');
    }

    // Hold body：长按音符在方块右侧的横向拖尾（代表按住持续时间）
    let holdBodyEl = null;
    if (beat.isHold) {
      const bodyLen = Math.max(40, beat.durationMs * this._effectiveNoteSpeed());
      holdBodyEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      holdBodyEl.setAttribute('x', '36');       // 方块右边缘
      holdBodyEl.setAttribute('y', '-14');      // 相对方块中心垂直居中（-28+14）
      holdBodyEl.setAttribute('width', String(bodyLen));
      holdBodyEl.setAttribute('height', '28');
      holdBodyEl.setAttribute('rx', '10');
      holdBodyEl.setAttribute('fill', BASE_COLORS[beat.lane]);
      holdBodyEl.setAttribute('opacity', String(HOLD_BODY_ALPHA));
      holdBodyEl.setAttribute('stroke', BASE_COLORS[beat.lane]);
      holdBodyEl.setAttribute('stroke-width', '2');
      holdBodyEl.setAttribute('style', 'pointer-events:none');
      g.appendChild(holdBodyEl);
      if (noteHidden) holdBodyEl.setAttribute('opacity', '0');
    }

    // Hidden miss-flash rect (shown on miss)
    const flash = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    flash.setAttribute('x', '-36'); flash.setAttribute('y', '-28');
    flash.setAttribute('width', '72'); flash.setAttribute('height', '56');
    flash.setAttribute('rx', '12'); flash.setAttribute('fill', '#ff0000');
    flash.setAttribute('opacity', '0'); flash.setAttribute('pointer-events', 'none');
    g.appendChild(flash);

    const initialX = SPAWN_X + 60;
    g.setAttribute('transform', `translate(${initialX},${LANE_Y[this.toDisplayLane(beat.lane)]})`);
    this.gNotes.appendChild(g);

    const noteObj = {
      ...beat,
      el: g,           // the group
      useEl: useEl,    // the <use> inside it
      flashEl: flash,  // miss flash rect
      holdBodyEl: holdBodyEl, // hold body rect (null for tap)
      screenX: initialX,
      hit: false,
      missed: false,
    };
    this.notes.push(noteObj);
    // Fade in
    requestAnimationFrame(() => { g.setAttribute('opacity', '1'); });
  }

  _showJudgmentMiss(lane, shake = true) {
    const el = document.getElementById('judgment-pop');
    el.textContent = 'MISS';
    el.style.color = '#ff6b6b';
    el.style.top = (LANE_Y[lane] - 20) + 'px';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    // Screen shake（空按等轻反馈可不震屏）
    if (shake) this._shakeScreen();
  }

  _animateComboBreak() {
    const el = document.getElementById('ui-combo');
    el.classList.add('show');
    el.style.color = '#ff4444';
    el.style.textShadow = '0 0 20px rgba(255,0,0,0.7)';
    el.style.transform = 'translateX(-50%) scale(0.7)';
    setTimeout(() => {
      el.style.color = '#ffcc00';
      el.style.textShadow = '0 0 20px rgba(255,200,0,0.5)';
      el.style.transform = 'translateX(-50%) scale(1)';
      el.classList.remove('show');
    }, 400);
  }

  _shakeScreen() {
    const gs = document.getElementById('game-screen');
    gs.classList.remove('shake');
    void gs.offsetWidth;
    gs.classList.add('shake');
  }

  _endGame() {
    this.state = 'finished';
    if (this.animFrame) cancelAnimationFrame(this.animFrame);

    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');

    const total = this.totalJudged || 1;
    const acc = Math.round(
      (this.judgments.perfect * ACC_WEIGHTS.perfect +
       this.judgments.great * ACC_WEIGHTS.great +
       this.judgments.good * ACC_WEIGHTS.good) / total
    );
    const accPct = acc; // 统一用 Malody 权重

    // FC / AP detection
    const isFullCombo = this.judgments.miss === 0;
    const isAllPerfect = this.judgments.miss === 0 && this.judgments.great === 0 && this.judgments.good === 0;
    const badgesEl = document.getElementById('result-badges');
    badgesEl.innerHTML = '';
    if (isAllPerfect) {
      const ap = document.createElement('span'); ap.className = 'badge ap'; ap.textContent = '★ ALL PERFECT';
      badgesEl.appendChild(ap);
      setTimeout(() => ap.classList.add('show'), 800);
    } else if (isFullCombo) {
      const fc = document.createElement('span'); fc.className = 'badge fc'; fc.textContent = '● FULL COMBO';
      badgesEl.appendChild(fc);
      setTimeout(() => fc.classList.add('show'), 800);
    }

    // Grade (Malody M 体系: S/M5 A/M4 B/M3 C/M2 D/M1 F/M0)
    const grade = computeGrade(acc, this.judgments);
    const gradeClass = grade;

    // Animated score count-up
    const scoreEl = document.getElementById('r-score');
    const finalScore = this.score;
    const duration = 800;
    const startTime = performance.now();
    const animateScore = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out
      scoreEl.textContent = Math.round(finalScore * eased).toLocaleString();
      if (progress < 1) requestAnimationFrame(animateScore);
      else scoreEl.textContent = finalScore.toLocaleString();
    };
    requestAnimationFrame(animateScore);

    // Animated combo count-up
    const comboEl = document.getElementById('r-maxcombo');
    const finalCombo = this.maxCombo;
    const startTime2 = performance.now();
    const animateCombo = () => {
      const elapsed = performance.now() - startTime2;
      const progress = Math.min(1, elapsed / 600);
      const eased = 1 - Math.pow(1 - progress, 3);
      comboEl.textContent = Math.round(finalCombo * eased);
      if (progress < 1) requestAnimationFrame(animateCombo);
      else comboEl.textContent = finalCombo;
    };
    requestAnimationFrame(animateCombo);

    // Grade reveal with delay
    const gradeEl = document.getElementById('result-grade');
    gradeEl.textContent = '?';
    gradeEl.className = 'grade';
    gradeEl.style.transform = 'scale(0.3)';
    gradeEl.style.opacity = '0.3';
    setTimeout(() => {
      gradeEl.textContent = grade;
      gradeEl.className = 'grade ' + gradeClass;
      gradeEl.style.transform = 'scale(1.3)';
      gradeEl.style.opacity = '1';
      gradeEl.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s';
      setTimeout(() => { gradeEl.style.transform = 'scale(1)'; }, 400);
    }, 500);

    document.getElementById('r-acc').textContent = acc + '%';
    document.getElementById('r-judge').textContent =
      `${this.judgments.perfect}/${this.judgments.great}/${this.judgments.good}/${this.judgments.miss}`;
  }
}