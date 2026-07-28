// ============================================================
//  RNA Polymerase 4K Rhythm Game — Configuration & Utilities
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
const PERFECT_WIN     = 40;
const GREAT_WIN       = 80;
const GOOD_WIN        = 120;
const SPEED_LEVELS    = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const DEFAULT_KEYS    = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];

// ---------- Utility Functions ----------
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function midiToFreq(note) { return 440 * Math.pow(2, (note - 69) / 12); }

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
