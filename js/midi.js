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

// 智能 lane 分配：把 MIDI 音符映射到 4 条轨道，追求「均匀 + 顺滑」。
// 旧的固定取模(note % 4)和纯音高聚类都会导致分布不均：
//   - 取模随音高分布，某些道极密、某些道极疏；
//   - 音高线性映射又会把中间音高全挤到 1~2 条道。
// 这里改用「时间序贪心轮转 + 规避连打」算法：
//   1) 按时间升序逐个处理音符；
//   2) 候选道 = 累计负载最小的道，但优先排除「紧邻上一个音符用过」的道（避免同lane连打）；
//   3) 负载相同时，用「最久未用」(LRU) 的道让 4 道周转起来，达到天然均衡。
//
// 返回每个音符应落到的 lane 索引 (0..LANE_COUNT-1)。
function assignLanes(parsedNotes) {
  const n = parsedNotes.length;
  if (n === 0) return [];
  const laneCount = LANE_COUNT;

  // 按时间排序的索引序列（后面按这个顺序贪心分配）
  const sortedIdx = parsedNotes.map((_, i) => i).sort((a, b) => parsedNotes[a].startMs - parsedNotes[b].startMs);

  const laneLoad = new Array(laneCount).fill(0);     // 每道累计音符数
  const lastUseTime = new Array(laneCount).fill(-Infinity); // 每道最近一次被占用时间(ms)
  const minGap = 180;                                  // 同lane最小间隔，低于此视为连打应规避
  const lanes = new Array(n);

  for (const idx of sortedIdx) {
    const t = parsedNotes[idx].startMs;

    // 1) 找出「累计负载最小」的道（候选集合）
    let minLoad = Infinity;
    for (let c = 0; c < laneCount; c++) minLoad = Math.min(minLoad, laneLoad[c]);

    // 2) 在负载最小的候选里挑：优先避开「与上一音符时间过近的同lane令连打」的道
    //    若都连打，则退而求其次选「最久未用」(LRU) 的道保证周转。
    let best = -1;
    let bestLast = -Infinity; // 想要最久未用的(时间戳越大代表越久没用过)
    for (let c = 0; c < laneCount; c++) {
      if (laneLoad[c] > minLoad) continue;            // 只看负载最小的候选
      const avoid = (t - lastUseTime[c] < minGap);    // 是否构成连打
      if (avoid) continue;                            // 优先跳过连打道
      // 用 >= 保证首个相等(-Infinity)的候选也能被选中，避免 best 始终为 -1
      if (best === -1 || lastUseTime[c] > bestLast) { bestLast = lastUseTime[c]; best = c; }
    }

    // 3) 若所有最小负载道都在连打窗口内，放宽：挑全局「最久未用」的道
    if (best === -1) {
      bestLast = -Infinity;
      for (let c = 0; c < laneCount; c++) {
        if (best === -1 || lastUseTime[c] > bestLast) { bestLast = lastUseTime[c]; best = c; }
      }
    }

    lanes[idx] = best;
    laneLoad[best]++;
    lastUseTime[best] = t;
  }

  return lanes;
}

function buildBeatmap(parsedNotes) {
  const laneAssign = assignLanes(parsedNotes);
  const beatmap = [];
  for (let i = 0; i < parsedNotes.length; i++) {
    const n = parsedNotes[i];
    const lane = laneAssign[i];
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
