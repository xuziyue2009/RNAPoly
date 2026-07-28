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
    this.judgments = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.totalJudged = 0;
    this.animFrame = null;
    this.keyBindings = [...DEFAULT_KEYS];
    this.rebindingLane = -1;
    this.noteSpeed = BASE_NOTE_SPEED;
    this.speedLevel = 2; // index into SPEED_LEVELS (1.0x)

    this._loadSettings();
    this.initSvg();
    this.renderStaticScene();
    this.renderSongList();
    this.renderKeyBindings();
    this.setupInput();
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
  }
  _saveSettings() {
    this.saveKeyBindings();
    try { localStorage.setItem('rnapoly-speed', String(this.speedLevel)); } catch (e) { /* ignore */ }
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

  _onKeyPress(lane) {
    if (this.state !== 'playing') return;

    const songTime = (this.audio.currentTime - this.songStartAudio) * 1000;
    let bestNote = null, bestDist = Infinity;
    for (const note of this.notes) {
      if (note.lane !== lane || note.hit || note.missed) continue;
      const dist = Math.abs(songTime - note.time);
      if (dist < GOOD_WIN && dist < bestDist) { bestDist = dist; bestNote = note; }
    }

    if (bestNote) {
      const offset = songTime - bestNote.time;
      let judgment, points;
      if (Math.abs(offset) <= PERFECT_WIN)  { judgment = 'perfect'; points = 300; }
      else if (Math.abs(offset) <= GREAT_WIN) { judgment = 'great';   points = 200; }
      else                                    { judgment = 'good';    points = 100; }

      bestNote.hit = true;
      const prevCombo = this.combo;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      const mult = this.combo >= 50 ? 4 : this.combo >= 30 ? 3 : this.combo >= 10 ? 2 : 1;
      this.score += points * mult;
      this.judgments[judgment]++;
      this.totalJudged++;

      this.audio.playHit(lane, judgment);
      this._animateNoteHit(bestNote);
      this._showJudgment(judgment, lane, offset);
      this._spawnParticles(lane, judgment);
      this._addRnaBase(lane);
      this._flashLane(lane);
      this._pulsePolymerase();
      this._checkComboMilestones(prevCombo);
    } else {
      this.audio.playMiss();
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
        (this.judgments.perfect * 100 + this.judgments.great * 80 + this.judgments.good * 50) /
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
    while (this.spawnedUpTo + 1 < this.beatmap.length) {
      const next = this.beatmap[this.spawnedUpTo + 1];
      const noteScreenX = HIT_X + (next.time - songTime) * this.noteSpeed;
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
      const x = HIT_X + (note.time - songTime) * this.noteSpeed;
      const scale = note._hitAnimated ? ' scale(1.3)' : '';
      note.el.setAttribute('transform', `translate(${x},${LANE_Y[note.lane]})${scale}`);
      note.screenX = x;

      const distToHit = Math.abs(x - HIT_X);
      if (distToHit < 40 && !note.hit && !note.missed) {
        note.useEl.setAttribute('filter', 'url(#glow)');
      } else if (note.useEl) {
        note.useEl.removeAttribute('filter');
      }

      // Miss detection
      if (this.state === 'playing' && !note.hit && !note.missed) {
        if (songTime > note.time + GOOD_WIN) {
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

    // Hidden miss-flash rect (shown on miss)
    const flash = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    flash.setAttribute('x', '-36'); flash.setAttribute('y', '-28');
    flash.setAttribute('width', '72'); flash.setAttribute('height', '56');
    flash.setAttribute('rx', '12'); flash.setAttribute('fill', '#ff0000');
    flash.setAttribute('opacity', '0'); flash.setAttribute('pointer-events', 'none');
    g.appendChild(flash);

    const initialX = SPAWN_X + 60;
    g.setAttribute('transform', `translate(${initialX},${LANE_Y[beat.lane]})`);
    this.gNotes.appendChild(g);

    const noteObj = {
      ...beat,
      el: g,           // the group
      useEl: useEl,    // the <use> inside it
      flashEl: flash,  // miss flash rect
      screenX: initialX,
      hit: false,
      missed: false,
    };
    this.notes.push(noteObj);
    // Fade in
    requestAnimationFrame(() => { g.setAttribute('opacity', '1'); });
  }

  _showJudgmentMiss(lane) {
    const el = document.getElementById('judgment-pop');
    el.textContent = 'MISS';
    el.style.color = '#ff6b6b';
    el.style.top = (LANE_Y[lane] - 20) + 'px';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    // Screen shake
    this._shakeScreen();
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
      (this.judgments.perfect * 100 + this.judgments.great * 80 + this.judgments.good * 50) / total
    );
    const accPct = Math.round(
      (this.judgments.perfect + this.judgments.great * 0.8 + this.judgments.good * 0.5) / total * 100
    );

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

    let grade, gradeClass;
    if (accPct > 95)      { grade = 'S'; gradeClass = 'S'; }
    else if (accPct > 85) { grade = 'A'; gradeClass = 'A'; }
    else if (accPct > 70) { grade = 'B'; gradeClass = 'B'; }
    else if (accPct > 50) { grade = 'C'; gradeClass = 'C'; }
    else                  { grade = 'D'; gradeClass = 'D'; }

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