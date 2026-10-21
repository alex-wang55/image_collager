/**
 * Just enough EXIF to know when a JPEG was taken. Photos picked from the
 * library keep their original date this way instead of "the day you uploaded it".
 */

const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_OFFSET_TIME_ORIGINAL = 0x9011;

/** Returns an ISO timestamp, or null if there's no usable date. */
export function readTakenAt(buf: ArrayBuffer): string | null {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
  let off = 2;
  while (off + 4 <= v.byteLength) {
    if (v.getUint8(off) !== 0xff) return null;
    const marker = v.getUint8(off + 1);
    if (marker === 0xda || marker === 0xd9) return null; // image data starts, no EXIF before it
    const size = v.getUint16(off + 2);
    if (marker === 0xe1 && off + 10 <= v.byteLength && ascii(v, off + 4, 4) === "Exif") {
      try {
        return parseTiff(v, off + 10, Math.min(v.byteLength, off + 2 + size));
      } catch {
        return null;
      }
    }
    off += 2 + size;
  }
  return null;
}

function parseTiff(v: DataView, start: number, end: number): string | null {
  const order = ascii(v, start, 2);
  if (order !== "II" && order !== "MM") return null;
  const le = order === "II";
  const u16 = (o: number) => v.getUint16(start + o, le);
  const u32 = (o: number) => v.getUint32(start + o, le);
  if (u16(2) !== 0x2a) return null;

  const readIfd = (ifdOff: number) => {
    const tags = new Map<number, { type: number; count: number; valueOff: number }>();
    if (start + ifdOff + 2 > end) return tags;
    const n = u16(ifdOff);
    for (let i = 0; i < n; i++) {
      const e = ifdOff + 2 + i * 12;
      if (start + e + 12 > end) break;
      tags.set(u16(e), { type: u16(e + 2), count: u32(e + 4), valueOff: e + 8 });
    }
    return tags;
  };
  const str = (t: { type: number; count: number; valueOff: number } | undefined) => {
    if (!t || t.type !== 2) return null;
    const at = t.count > 4 ? u32(t.valueOff) : t.valueOff;
    if (start + at + t.count > end) return null;
    return ascii(v, start + at, t.count).replace(/\0+$/, "");
  };

  const ifd0 = readIfd(u32(4));
  let date: string | null = null;
  let tz: string | null = null;
  const exifPtr = ifd0.get(TAG_EXIF_IFD);
  if (exifPtr) {
    const exif = readIfd(u32(exifPtr.valueOff));
    date = str(exif.get(TAG_DATETIME_ORIGINAL));
    tz = str(exif.get(TAG_OFFSET_TIME_ORIGINAL));
  }
  date ??= str(ifd0.get(TAG_DATETIME));
  return date ? exifDateToIso(date, tz) : null;
}

/** "2024:07:04 18:30:00" (+ optional "-04:00") to ISO. No offset means the phone's local time. */
export function exifDateToIso(date: string, tz?: string | null): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(date.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  let t: Date;
  if (tz && /^[+-]\d{2}:\d{2}$/.test(tz.trim())) {
    t = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${tz.trim()}`);
  } else {
    t = new Date(+y, +mo - 1, +d, +h, +mi, +s);
  }
  const year = t.getUTCFullYear();
  if (Number.isNaN(t.getTime()) || year < 1900 || t.getTime() > Date.now() + 86_400_000) return null;
  return t.toISOString();
}

function ascii(v: DataView, at: number, len: number): string {
  let s = "";
  for (let i = 0; i < len && at + i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(at + i));
  return s;
}
