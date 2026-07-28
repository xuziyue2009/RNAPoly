// ============================================================
//  RNA Polymerase 4K Rhythm Game — Song Library
//  MIDI data embedded as base64 (source files in midi/ directory)
// ============================================================

const SONGS = [
  {
    id: "twinkle",
    title: "小星星",
    titleEn: "Twinkle Twinkle Little Star",
    bpm: 120,
    notes: [[60,480],[60,480],[67,480],[67,480],[69,480],[69,480],[67,960],[65,480],[65,480],[64,480],[64,480],[62,480],[62,480],[60,960],[67,480],[67,480],[65,480],[65,480],[64,480],[64,480],[62,960],[67,480],[67,480],[65,480],[65,480],[64,480],[64,480],[62,960],[60,480],[60,480],[67,480],[67,480],[69,480],[69,480],[67,960],[65,480],[65,480],[64,480],[64,480],[62,480],[62,480],[60,960]],
    midiBase64: "TVRoZAAAAAYAAAABAeBNVHJrAAABiwD/UQMHoSAAkDxQgxiAPABIkDxQgxiAPABIkENQgxiAQwBIkENQgxiAQwBIkEVQgxiARQBIkEVQgxiARQBIkENQhjCAQwCBEJBBUIMYgEEASJBBUIMYgEEASJBAUIMYgEAASJBAUIMYgEAASJA+UIMYgD4ASJA+UIMYgD4ASJA8UIYwgDwAgRCQQ1CDGIBDAEiQQ1CDGIBDAEiQQVCDGIBBAEiQQVCDGIBBAEiQQFCDGIBAAEiQQFCDGIBAAEiQPlCGMIA+AIEQkENQgxiAQwBIkENQgxiAQwBIkEFQgxiAQQBIkEFQgxiAQQBIkEBQgxiAQABIkEBQgxiAQABIkD5QhjCAPgCBEJA8UIMYgDwASJA8UIMYgDwASJBDUIMYgEMASJBDUIMYgEMASJBFUIMYgEUASJBFUIMYgEUASJBDUIYwgEMAgRCQQVCDGIBBAEiQQVCDGIBBAEiQQFCDGIBAAEiQQFCDGIBAAEiQPlCDGIA+AEiQPlCDGIA+AEiQPFCGMIA8AIEQ/y8A",
  },
  {
    id: "tigers",
    title: "两只老虎",
    titleEn: "Frère Jacques",
    bpm: 120,
    notes: [[60,480],[62,480],[64,480],[60,480],[60,480],[62,480],[64,480],[60,480],[64,480],[65,480],[67,960],[64,480],[65,480],[67,960],[67,480],[69,480],[67,480],[65,480],[64,480],[60,480],[67,480],[69,480],[67,480],[65,480],[64,480],[60,480],[60,480],[55,480],[60,960],[60,480],[55,480],[60,960]],
    midiBase64: "TVRoZAAAAAYAAAABAeBNVHJrAAABLwD/UQMHoSAAkDxQgxiAPABIkD5QgxiAPgBIkEBQgxiAQABIkDxQgxiAPABIkDxQgxiAPABIkD5QgxiAPgBIkEBQgxiAQABIkDxQgxiAPABIkEBQgxiAQABIkEFQgxiAQQBIkENQhjCAQwCBEJBAUIMYgEAASJBBUIMYgEEASJBDUIYwgEMAgRCQQ1CDGIBDAEiQRVCDGIBFAEiQQ1CDGIBDAEiQQVCDGIBBAEiQQFCDGIBAAEiQPFCDGIA8AEiQQ1CDGIBDAEiQRVCDGIBFAEiQQ1CDGIBDAEiQQVCDGIBBAEiQQFCDGIBAAEiQPFCDGIA8AEiQPFCDGIA8AEiQN1CDGIA3AEiQPFCGMIA8AIEQkDxQgxiAPABIkDdQgxiANwBIkDxQhjCAPACBEP8vAA==",
  },
  {
    id: "birthday",
    title: "生日快乐",
    titleEn: "Happy Birthday",
    bpm: 120,
    notes: [[67,480],[67,240],[69,240],[67,480],[72,480],[71,960],[67,480],[67,240],[69,240],[67,480],[74,480],[72,960],[67,480],[67,480],[79,480],[76,480],[72,480],[71,480],[69,960],[77,480],[77,240],[76,240],[72,480],[74,480],[72,960]],
    midiBase64: "TVRoZAAAAAYAAAABAeBNVHJrAAAA8AD/UQMHoSAAkENQgxiAQwBIkENQgUyAQwAkkEVQgUyARQAkkENQgxiAQwBIkEhQgxiASABIkEdQhjCARwCBEJBDUIMYgEMASJBDUIFMgEMAJJBFUIFMgEUAJJBDUIMYgEMASJBKUIMYgEoASJBIUIYwgEgAgRCQQ1CDGIBDAEiQQ1CDGIBDAEiQT1CDGIBPAEiQTFCDGIBMAEiQSFCDGIBIAEiQR1CDGIBHAEiQRVCGMIBFAIEQkE1QgxiATQBIkE1QgUyATQAkkExQgUyATAAkkEhQgxiASABIkEpQgxiASgBIkEhQhjCASACBEP8vAA==",
  },
  {
    id: "jasmine",
    title: "茉莉花",
    titleEn: "Jasmine Flower",
    bpm: 100,
    notes: [[64,480],[64,480],[67,480],[69,480],[67,480],[64,960],[67,480],[69,480],[72,480],[69,480],[67,480],[64,960],[62,480],[64,480],[67,480],[69,480],[67,480],[64,480],[62,480],[60,960],[64,480],[64,480],[67,480],[69,480],[67,480],[64,960],[67,480],[69,480],[72,480],[69,480],[67,480],[64,960],[62,480],[64,480],[67,480],[69,480],[67,480],[64,480],[62,480],[60,960]],
    midiBase64: "TVRoZAAAAAYAAAABAeBNVHJrAAABeQD/UQMJJ8AAkEBQgxiAQABIkEBQgxiAQABIkENQgxiAQwBIkEVQgxiARQBIkENQgxiAQwBIkEBQhjCAQACBEJBDUIMYgEMASJBFUIMYgEUASJBIUIMYgEgASJBFUIMYgEUASJBDUIMYgEMASJBAUIYwgEAAgRCQPlCDGIA+AEiQQFCDGIBAAEiQQ1CDGIBDAEiQRVCDGIBFAEiQQ1CDGIBDAEiQQFCDGIBAAEiQPlCDGIA+AEiQPFCGMIA8AIEQkEBQgxiAQABIkEBQgxiAQABIkENQgxiAQwBIkEVQgxiARQBIkENQgxiAQwBIkEBQhjCAQACBEJBDUIMYgEMASJBFUIMYgEUASJBIUIMYgEgASJBFUIMYgEUASJBDUIMYgEMASJBAUIYwgEAAgRCQPlCDGIA+AEiQQFCDGIBAAEiQQ1CDGIBDAEiQRVCDGIBFAEiQQ1CDGIBDAEiQQFCDGIBAAEiQPlCDGIA+AEiQPFCGMIA8AIEQ/y8A",
  },
];

let currentSongIndex = 0;

function getCurrentSong() {
  return SONGS[currentSongIndex];
}

function selectSong(index) {
  if (index >= 0 && index < SONGS.length) {
    currentSongIndex = index;
    try { localStorage.setItem("rnapoly-song", String(index)); } catch (e) {}
    return true;
  }
  return false;
}

function loadSongSelection() {
  try {
    const saved = localStorage.getItem("rnapoly-song");
    if (saved !== null) {
      const idx = parseInt(saved);
      if (idx >= 0 && idx < SONGS.length) currentSongIndex = idx;
    }
  } catch (e) {}
}

function decodeMidiBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
