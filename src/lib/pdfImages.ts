/**
 * Pull the photos out of a recipe-card PDF without a PDF library.
 *
 * Meal-kit PDFs (HelloFresh and similar) store their photos as JPEG image objects
 * (`/Subtype /Image` with `/Filter /DCTDecode`). A JPEG stream inside a PDF is a
 * complete JPEG file, so it can be cut out of the bytes and decoded by the browser.
 * Image objects can't live inside compressed object streams, so their headers are
 * always readable as plain text. Images using other filters are skipped.
 */

export interface PdfPhoto {
  /** The original JPEG, full size. */
  blob: Blob;
  width: number;
  height: number;
}

/** Smallest side (px) for something to count as a photo rather than an icon, logo or QR code. */
const MIN_SIDE = 180;
const MAX_PHOTOS = 12;

export async function extractPdfPhotos(file: File): Promise<PdfPhoto[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  // windows-1252 is one byte per character, so string indices line up with byte offsets.
  const text = new TextDecoder("windows-1252").decode(bytes);

  const found: PdfPhoto[] = [];
  const seenSizes = new Set<number>();
  const imageMarker = /\/Subtype\s*\/Image\b/g;

  for (let match = imageMarker.exec(text); match; match = imageMarker.exec(text)) {
    const objStart = text.lastIndexOf(" obj", match.index);
    const streamKeyword = text.indexOf("stream", match.index);
    if (objStart === -1 || streamKeyword === -1) continue;

    const dict = text.slice(objStart, streamKeyword);
    // A plain JPEG stream only: "/Filter /DCTDecode" or "/Filter [/DCTDecode]".
    if (!/\/Filter\s*(\[\s*)?\/DCTDecode\s*\]?/.test(dict)) continue;
    if (/\/ImageMask\s+true/.test(dict)) continue;

    // Stream data starts after the EOL that follows the "stream" keyword.
    let dataStart = streamKeyword + "stream".length;
    if (text[dataStart] === "\r") dataStart++;
    if (text[dataStart] === "\n") dataStart++;

    if (bytes[dataStart] !== 0xff || bytes[dataStart + 1] !== 0xd8) continue;

    // Find where the JPEG ends. Try a direct "/Length N" first (not "/Length N 0 R", which is a
    // reference to another object), then fall back to searching for "endstream".
    const directLength = /\/Length\s+(\d+)\b(?!\s+\d+\s+R)/.exec(dict);
    const endCandidates = [
      directLength ? dataStart + parseInt(directLength[1]!, 10) : -1,
      text.indexOf("endstream", dataStart),
    ];
    let dataEnd = -1;
    for (const candidate of endCandidates) {
      if (candidate <= dataStart + 2 || candidate > bytes.length) continue;
      // Step back over any trailing EOL to the JPEG end-of-image marker (FF D9), at most a few bytes.
      let end = candidate;
      while (end > candidate - 4 && end > dataStart + 2 && !(bytes[end - 2] === 0xff && bytes[end - 1] === 0xd9)) end--;
      if (bytes[end - 2] === 0xff && bytes[end - 1] === 0xd9) {
        dataEnd = end;
        break;
      }
    }
    if (dataEnd === -1) continue;

    const jpeg = bytes.slice(dataStart, dataEnd);
    // The same photo is often embedded more than once; skip exact-size repeats.
    if (seenSizes.has(jpeg.byteLength)) continue;
    seenSizes.add(jpeg.byteLength);

    const blob = new Blob([jpeg], { type: "image/jpeg" });
    try {
      const bitmap = await createImageBitmap(blob);
      const { width, height } = bitmap;
      bitmap.close();
      const ratio = width / height;
      if (Math.min(width, height) < MIN_SIDE || ratio < 0.4 || ratio > 2.8) continue;
      found.push({ blob, width, height });
    } catch {
      // Not decodable by the browser (e.g. an unusual colour space); skip it.
    }
    if (found.length >= MAX_PHOTOS) break;
  }

  return found;
}

/** A small JPEG copy for the AI to look at when matching photos to steps. */
export async function makePreview(photo: PdfPhoto, maxSide = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(photo.blob);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
}
