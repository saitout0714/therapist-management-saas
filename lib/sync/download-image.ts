import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Downloads an image from a URL and saves it to a temporary file.
 * Returns the local file path.
 */
export async function downloadImageToTemp(url: string, prefix = 'therapist_img_', page?: any): Promise<string | null> {
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
    let isWebp = contentType.includes('webp');
    let ext = '.jpg';
    if (contentType.includes('png') && !isWebp) ext = '.png';
    else if (contentType.includes('gif') && !isWebp) ext = '.gif';
    
    const tmpDir = os.tmpdir();
    const fileName = `${prefix}${Date.now()}${ext}`;
    const filePath = path.join(tmpDir, fileName);
    
    if (isWebp && page) {
      const base64 = Buffer.from(buffer).toString('base64');
      const dataUrl = `data:image/webp;base64,${base64}`;
      const jpegDataUrl = await page.evaluate(async (imgUrl: string) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/jpeg", 0.9));
            } else {
                reject("No context");
            }
          };
          img.onerror = () => reject("Failed to load image");
          img.src = imgUrl;
        });
      }, dataUrl);
      
      const base64Data = (jpegDataUrl as string).replace(/^data:image\/jpeg;base64,/, "");
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    } else {
      fs.writeFileSync(filePath, Buffer.from(buffer));
    }
    
    return filePath;
  } catch (error) {
    console.error(`[downloadImage] Error downloading image:`, error);
    return null;
  }
}
