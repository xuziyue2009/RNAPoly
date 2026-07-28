// ============================================================
//  RNA Polymerase 4K Rhythm Game — MIDI Parser
//  Handles Type 0 (single-track) and Type 1 (multi-track) files.
//  MIDI files stored in midi/ directory, embedded as base64 in songs.js.
// ============================================================

// ---------- MIDI Parser: Uint8Array → [{midiNote, startMs, durationMs}, ...] ----------
function parseMidi(bytes) {
  const view = new DataView(bytes.buffer);
  const len = bytes.length;
  let pos = 0;

  if (pos + 4 > len) throw new Error('File too short: no header');
  const headerId = String.fromCharCode(...bytes.slice(pos, pos + 4)); pos += 4;
  if (headerId !== 'MThd') throw new Error('Not a MIDI file (missing MThd)');
  if (pos + 4 > len) throw new Error('Header truncated');
  const headerLen = view.getUint32(pos); pos += 4;
  const headerEnd = pos + headerLen;
  if (headerEnd > len) throw new Error('Header exceeds file length');

  const format   = view.getUint16(pos); pos += 2;
  const nTracks  = view.getUint16(pos); pos += 2;
  const division = view.getUint16(pos); pos += 2;
  pos = headerEnd; // skip any extra header bytes

  // Detect SMPTE division (bit 15 set) — not supported for game use
  if (division & 0x8000) throw new Error('SMPTE time division not supported');

  // ---- VLQ decoder ----
  function readVLQ() {
    let val = 0, b;
    do {
      if (pos >= len) throw new Error('Unexpected end of file in VLQ');
      b = bytes[pos++];
      val = (val << 7) | (b & 0x7F);
      // Guard against overflow (MIDI spec max is 0x0FFFFFFF)
      if (val > 0x0FFFFFFF) throw new Error('VLQ overflow');
    } while (b & 0x80);
    return val;
  }

  // ---- Variable-length data skipper (SysEx, arbitrary meta) ----
  function skipVLQBytes() {
    let b;
    do { b = bytes[pos++]; } while ((b & 0x80) && pos < len);
  }

  // ---- Read all tracks ----
  let tempo = 500000; // default 120 BPM
  const parsedNotes = [];

  for (let trackIdx = 0; trackIdx < nTracks; trackIdx++) {
    if (pos + 8 > len) throw new Error('Track ' + trackIdx + ' header truncated');
    const trackId = String.fromCharCode(...bytes.slice(pos, pos + 4)); pos += 4;
    if (trackId !== 'MTrk') throw new Error('Expected MTrk at track ' + trackIdx);
    const trackLen = view.getUint32(pos); pos += 4;
    const trackEnd = Math.min(pos + trackLen, len); // don't read past file end

    let absTick = 0;
    let runningStatus = 0;
    const activeNotes = {}; // per-track note tracking

    while (pos < trackEnd) {
      const delta = readVLQ();
      absTick += delta;

      let status = bytes[pos];
      let evtType;

      if (status === undefined) break; // EOF guard

      if (status & 0x80) {
        evtType = bytes[pos++];
        // Running status only for voice messages (0x80–0xEF)
        if (evtType < 0xF0) runningStatus = evtType;
      } else {
        if (runningStatus === 0) throw new Error('Data byte without running status at track ' + trackIdx);
        evtType = runningStatus;
        // pos NOT incremented — status was implied
      }

      // ---- Dispatch by event type ----
      const hiNibble = evtType & 0xF0;

      if (evtType === 0xFF) {                       // Meta Event
        const metaType = bytes[pos++];
        const metaLen = readVLQ();
        if (pos + metaLen > trackEnd) break;        // truncated meta
        if (metaType === 0x51 && metaLen === 3) {   // Tempo (use first found)
          const t = (bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2];
          if (tempo === 500000) tempo = t;           // keep first explicit tempo
        }
        if (metaType === 0x2F) { pos += metaLen; break; } // End of Track
        pos += metaLen;
      } else if (evtType === 0xF0 || evtType === 0xF7) { // SysEx
        skipVLQBytes();                             // skip variable-length payload
      } else if (hiNibble === 0x90 || hiNibble === 0x80) { // Note On / Note Off
        if (pos + 2 > trackEnd) break;
        const note = bytes[pos++];
        const velocity = bytes[pos++];

        if (hiNibble === 0x90 && velocity > 0) {    // Note On
          activeNotes[note] = absTick;
        } else {                                     // Note Off (or Note On vel=0)
          if (activeNotes[note] !== undefined) {
            parsedNotes.push({
              note,
              startTick: activeNotes[note],
              endTick: absTick,
            });
            delete activeNotes[note];
          }
        }
      } else if (hiNibble === 0xA0 || hiNibble === 0xB0 || hiNibble === 0xE0) {
        pos += 2;                                   // KeyPressure / CC / PitchBend
      } else if (hiNibble === 0xC0 || hiNibble === 0xD0) {
        pos += 1;                                   // ProgramChange / ChannelPressure
      } else {
        // Unknown — skip 2 bytes as safest default
        pos += 2;
      }
    }

    // Close any still-active notes at end of this track
    for (const [n, start] of Object.entries(activeNotes)) {
      parsedNotes.push({ note: Number(n), startTick: start, endTick: absTick });
    }
  }

  // ---- Tick → milliseconds conversion ----
  const usPerTick = tempo / division;
  return parsedNotes.map(n => ({
    midiNote: n.note,
    startMs: n.startTick * usPerTick / 1000,
    durationMs: Math.max(1, (n.endTick - n.startTick) * usPerTick / 1000),
  }));
}

// ---------- Beatmap Builder ----------
function buildBeatmap(parsedNotes) {
  const beatmap = [];
  for (const n of parsedNotes) {
    const lane = n.midiNote % LANE_COUNT;
    beatmap.push({
      time: n.startMs,
      lane: lane,
      dnaBase: DNA_BASES[lane],
      rnaBase: RNA_BASES[lane],
      midiNote: n.midiNote,
      durationMs: n.durationMs,
      id: beatmap.length,
    });
  }
  beatmap.sort((a, b) => a.time - b.time);
  return beatmap;
}
