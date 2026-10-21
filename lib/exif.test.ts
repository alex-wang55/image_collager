import { describe, expect, it } from "vitest";
import { exifDateToIso, readTakenAt } from "./exif";

/** A tiny JPEG: SOI, an APP1 Exif block with DateTimeOriginal (+ optional offset), then SOS. */
function jpegWithExif(date: string, offset: string | null, little = true): ArrayBuffer {
  const tiff: number[] = [];
  const u16 = (n: number) => (little ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff]);
  const u32 = (n: number) => (little ? [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24] : [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat(0);

  const exifEntries = offset ? 2 : 1;
  const ifd0At = 8;
  const exifAt = ifd0At + 2 + 12 + 4;
  const dataAt = exifAt + 2 + exifEntries * 12 + 4;
  const dateBytes = ascii(date);
  const offBytes = offset ? ascii(offset) : [];

  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(0x2a), ...u32(ifd0At));
  tiff.push(...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(exifAt), ...u32(0));
  tiff.push(...u16(exifEntries), ...u16(0x9003), ...u16(2), ...u32(dateBytes.length), ...u32(dataAt));
  if (offset) tiff.push(...u16(0x9011), ...u16(2), ...u32(offBytes.length), ...u32(dataAt + dateBytes.length));
  tiff.push(...u32(0), ...dateBytes, ...offBytes);

  const app1Len = 2 + 6 + tiff.length;
  const bytes = [0xff, 0xd8, 0xff, 0xe1, app1Len >> 8, app1Len & 0xff, ...ascii("Exif"), 0, ...tiff, 0xff, 0xda, 0, 2];
  return new Uint8Array(bytes).buffer;
}

describe("readTakenAt", () => {
  it("reads DateTimeOriginal with its UTC offset", () => {
    expect(readTakenAt(jpegWithExif("2024:07:04 18:30:00", "-04:00"))).toBe("2024-07-04T22:30:00.000Z");
  });

  it("reads big-endian (Motorola) EXIF too", () => {
    expect(readTakenAt(jpegWithExif("2023:12:31 23:59:59", "+00:00", false))).toBe("2023-12-31T23:59:59.000Z");
  });

  it("treats a date without an offset as the phone's local time", () => {
    expect(readTakenAt(jpegWithExif("2022:01:15 09:05:00", null))).toBe(new Date(2022, 0, 15, 9, 5, 0).toISOString());
  });

  it("returns null for things that aren't JPEGs or have no EXIF", () => {
    expect(readTakenAt(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeNull();
    expect(readTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer)).toBeNull();
    expect(readTakenAt(new ArrayBuffer(0))).toBeNull();
  });
});

describe("exifDateToIso", () => {
  it("rejects blank camera dates and dates in the future", () => {
    expect(exifDateToIso("0000:00:00 00:00:00")).toBeNull();
    expect(exifDateToIso("2999:01:01 00:00:00", "+00:00")).toBeNull();
    expect(exifDateToIso("not a date")).toBeNull();
  });
});
