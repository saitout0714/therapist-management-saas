import { supabase } from './supabase';

/**
 * Direct image upload to Supabase Storage bucket 'blog-images'.
 * Returns the public URL of the uploaded image.
 */
export async function uploadBlogImage(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const filePath = `articles/${fileName}`;

  const { data, error } = await supabase.storage
    .from('blog-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.warn('Storage upload warning:', error.message);
    // If bucket or storage upload policy has an issue, convert to local data URL for fallback seamless UX
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  const { data: publicUrlData } = supabase.storage
    .from('blog-images')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}
