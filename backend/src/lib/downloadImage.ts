import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { safeFetch } from "./safeFetch";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Download an image from a creator-supplied URL. The URL comes from the
 * request body, so the fetch goes through safeFetch (public addresses only,
 * redirects re-validated, size capped while streaming).
 */
export async function downloadAndInspectImage(url: string) {
  try {
    const { buffer } = await safeFetch(url, { maxBytes: MAX_BYTES, timeoutMs: 5000 });

    const extractFileType = await fileTypeFromBuffer(buffer);
    if (!extractFileType) throw new Error("unknown file type");
    if (!extractFileType.mime.startsWith("image/"))
      throw new Error("Not an image");

    const meta = await sharp(buffer).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    const fileName = `img_${Date.now()}.${extractFileType.ext}`;

    return {
      buffer,
      contentType: extractFileType.mime,
      sizeBytes: buffer.length,
      width,
      height,
      fileName,
      fileNameNoExt: fileName.replace(/\.[^.]+$/, ""),
    };
  } catch (e) {
    console.warn("[import] image download rejected:", (e as Error).message);
    throw e;
  }
}
