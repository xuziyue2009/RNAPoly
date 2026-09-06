// ============================================================
//  RNA Polymerase 4K Rhythm Game — Configuration & Utilities
//  (Malody 机制参照升级版)
// ============================================================

// ---------- Game Constants ----------
const LANE_COUNT = 4;
const DNA_BASES  = ['T', 'A', 'C', 'G'];
const RNA_BASES  = ['A', 'U', 'G', 'C'];
const BASE_COLORS = ['#ff6b6b', '#51cf66', '#339af0', '#fcc419'];
const RNA_COLORS  = ['#ff9999', '#7bdb8e', '#74b9ff', '#ffe066'];
const LANE_Y      = [312, 375, 438, 501];
const HIT_X       = 195;
const SPAWN_X     = 1180;
const BASE_NOTE_SPEED = 0.45;

// ---------- Judgment Windows (Malody 5-tier, PC values) ----------
// BEST / COOL / GOOD windows scale with difficulty tier; MISS stays fixed.
// Tier index 0..4 → A(EASY) B C D E(HARD). Lower tier = harder = narrower window.
const JUDGE_TIERS = [
  { name: 'EASY',   gradeMult: 0.78, best: 52, great: 92, good: 126 },
  { name: 'EASY+',  gradeMult: 0.85, best: 44, great: 84, good: 118 },
  { name: 'NORMAL', gradeMult: 1.00, best: 36, great: 76, good: 110 },
  { name: 'HARD',   gradeMult: 1.10, best: 28, great: 68, good: 102 },
  { name: 'EXTRA',  gradeMult: 1.20, best: 20, great: 60, good: 94 },
];
const MISS_WIN = 150;  // fixed miss window (widest)

// ---------- Judgment naming ----------
// Malody uses BEST/COOL/GOOD; we keep PERFECT/GREAT/GOOD for continuity.
let JUDGE = {};

// ---------- Accuracy weights (Malody: BEST=100 / COOL=75 / GOOD=40) ----------
const ACC_WEIGHTS = { perfect: 100, great: 75, good: 40 };

// ---------- Base points per judgment (Malody: BEST=1000/COOL=750/GOOD=400/MISS=0) ----------
const BASE_POINTS = { perfect: 1000, great: 750, good: 400, miss: 0 };

// ---------- Combo multiplier model (initial 1, cap 1, floor 0) ----------
// Malody: each BEST +0.01, COOL -0.02, GOOD -0.08, MISS -0.32
const COMBO_MOD = { perfect: 0.01, great: -0.02, good: -0.08, miss: -0.32 };

// ---------- Grade thresholds (M1~M5, Malody) ----------
// Based on accuracy %; M5 requires 100% acc.
const GRADES = [
  { id: 'S',  name: 'M5', min: 100, perfectOnly: true },  // all PERFECT
  { id: 'A',  name: 'M4', min: 95,  noMiss: true },
  { id: 'B',  name: 'M3', min: 90 },
  { id: 'C',  name: 'M2', min: 80 },
  { id: 'D',  name: 'M1', min: 70 },
  { id: 'F',  name: 'M0', min: 0 },
];

// ---------- Speed (exponential mapping 2^(0.1x), Malody) ----------
// Speed level 0..20 → real speed = 2^(0.1 * offset). 0 = standard.
// We use a simple integer index for the UI but map exponentially.
const SPEED_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const DEFAULT_KEYS    = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
const DEFAULT_JUDGE_TIER = 2;   // NORMAL

// ---------- Offset calibration (ms, ±) ----------
const DEFAULT_OFFSET = 0;

// ---------- Utility Functions ----------
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function midiToFreq(note) { return 440 * Math.pow(2, (note - 69) / 12); }

// Current judgment windows (depends on selected tier)
function getJudgeWindows(tierIndex) {
  const t = JUDGE_TIERS[tierIndex] || JUDGE_TIERS[DEFAULT_JUDGE_TIER];
  return {
    perfect: t.best,   // 36ms default (NORMAL)
    great:   t.great,  // 76ms
    good:    t.good,   // 110ms
    miss:    MISS_WIN, // 150ms fixed
    gradeMult: t.gradeMult,
  };
}

// Grade from accuracy + judgments
function computeGrade(acc, judgments) {
  const allPerfect = judgments.miss === 0 && judgments.great === 0 && judgments.good === 0 && judgments.perfect > 0;
  if (allPerfect) return 'S';
  if (acc >= 95 && judgments.miss === 0) return 'A';
  if (acc >= 90) return 'B';
  if (acc >= 80) return 'C';
  if (acc >= 70) return 'D';
  return 'F';
}

// ---------- MIDI VLQ Encoding ----------
function encodeVLQ(value) {
  if (value === 0) return [0];
  const b = [];
  while (value > 0) { b.unshift(value & 0x7F); value >>= 7; }
  for (let i = 0; i < b.length - 1; i++) b[i] |= 0x80;
  return b;
}

function writeBE32(v) {
  return [(v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];
}

function writeBE16(v) {
  return [(v >> 8) & 0xFF, v & 0xFF];
}
