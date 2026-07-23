import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Downloads an image from a URL and saves it to a temporary file.
 * Returns the local file path.
 */
export async function downloadImageToTemp(url: string, prefix = 'therapist_img_'): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[downloadImage] Failed to fetch image: ${response.statusText}`);
      return null;
    }
    const buffer = await response.arrayBuffer();
    
    // 拡張子の判別
    const contentType = response.headers.get('content-type') || '';
    let ext = '.jpg';
    if (contentType.includes('png')) ext = '.png';
    else if (contentType.includes('gif')) ext = '.gif';
    else if (contentType.includes('webp')) ext = '.webp';
    
    const tmpDir = os.tmpdir();
    const fileName = `${prefix}${Date.now()}${ext}`;
    const filePath = path.join(tmpDir, fileName);
    
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return filePath;
  } catch (error) {
    console.error(`[downloadImage] Error downloading image:`, error);
    return null;
  }
}
