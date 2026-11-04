/* ZIP mínimo, sin dependencias: escribe archivos sin comprimir (los vídeos y las imágenes ya vienen comprimidos) y lee ZIP con o sin compresión.
   Lo usan el archivo de proyecto (.motioncomic) y la importación de carpetas en ZIP. */
(function () {
  const MC = window.MC;
  const Z = (MC.zip = {});

  let table = null;
  const crcTable = () => { if (table) return table; table = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } return table; };
  const crcOf = (u8, crc) => { const T = crcTable(); let c = crc ^ 0xffffffff; for (let i = 0; i < u8.length; i++) c = T[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  /* CRC de un Blob leyéndolo por trozos (no carga archivos grandes de golpe). */
  const crcBlob = async (blob) => {
    let crc = 0; const CH = 8 * 1048576;
    for (let o = 0; o < blob.size; o += CH) crc = crcOf(new Uint8Array(await blob.slice(o, Math.min(blob.size, o + CH)).arrayBuffer()), crc);
    return crc >>> 0;
  };
  const enc = new TextEncoder(), dec = new TextDecoder();
  const u16 = (v) => [v & 255, (v >> 8) & 255], u32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff, dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;

  /* entries: [{ name, blob | data (string o Uint8Array) }] → Blob .zip */
  Z.write = async (entries, onProgress) => {
    const parts = [], central = []; let offset = 0; const now = new Date(), tm = dosTime(now), dt = dosDate(now);
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i], blob = e.blob || new Blob([typeof e.data === 'string' ? enc.encode(e.data) : e.data]), name = enc.encode(e.name), crc = await crcBlob(blob), size = blob.size;
      if (size > 0xfffffffe || offset > 0xfffffffe) throw new Error('El archivo es demasiado grande para un ZIP sencillo');
      const local = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(tm), ...u16(dt), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0)]);
      parts.push(local, name, blob);
      central.push({ name, crc, size, offset });
      offset += local.length + name.length + size;
      if (onProgress) onProgress((i + 1) / entries.length);
    }
    const cdStart = offset; let cdSize = 0;
    central.forEach((c) => {
      const rec = new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(tm), ...u16(dt), ...u32(c.crc), ...u32(c.size), ...u32(c.size), ...u16(c.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(c.offset)]);
      parts.push(rec, c.name); cdSize += rec.length + c.name.length;
    });
    parts.push(new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(central.length), ...u16(central.length), ...u32(cdSize), ...u32(cdStart), 0, 0]));
    return new Blob(parts, { type: 'application/zip' });
  };

  /* Lee el directorio de un ZIP (File o Blob). Devuelve [{ name, size, dir, blob() }]. */
  Z.read = async (file) => {
    const size = file.size, tailLen = Math.min(size, 65557), tail = new Uint8Array(await file.slice(size - tailLen).arrayBuffer());
    let eocd = -1; for (let i = tail.length - 22; i >= 0; i--) { if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 5 && tail[i + 3] === 6) { eocd = i; break; } }
    if (eocd < 0) throw new Error('No es un archivo ZIP');
    const dv = new DataView(tail.buffer, tail.byteOffset + eocd), count = dv.getUint16(10, true), cdSize = dv.getUint32(12, true), cdOff = dv.getUint32(16, true);
    if (cdOff === 0xffffffff || count === 0xffff) throw new Error('ZIP de más de 4 GB no admitido');
    const cd = new Uint8Array(await file.slice(cdOff, cdOff + cdSize).arrayBuffer()), cv = new DataView(cd.buffer), out = []; let p = 0;
    for (let i = 0; i < count && p + 46 <= cd.length; i++) {
      if (cv.getUint32(p, true) !== 0x02014b50) break;
      const flags = cv.getUint16(p + 8, true), method = cv.getUint16(p + 10, true), csize = cv.getUint32(p + 20, true), usize = cv.getUint32(p + 24, true), nl = cv.getUint16(p + 28, true), el = cv.getUint16(p + 30, true), cl = cv.getUint16(p + 32, true), lo = cv.getUint32(p + 42, true);
      const name = dec.decode(cd.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl;
      const dir = name.endsWith('/');
      out.push({ name, size: usize, dir, encrypted: !!(flags & 1), blob: async () => {
        const lh = new DataView(await file.slice(lo, lo + 30).arrayBuffer()), start = lo + 30 + lh.getUint16(26, true) + lh.getUint16(28, true), raw = file.slice(start, start + csize);
        if (method === 0) return raw.slice(0, usize);
        if (method === 8 && typeof DecompressionStream !== 'undefined') return new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
        throw new Error('Compresión no admitida en ' + name);
      } });
    }
    return out;
  };
})();
