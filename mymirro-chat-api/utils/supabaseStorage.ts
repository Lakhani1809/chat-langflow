/**
 * Supabase Storage Client for Image Uploads
 * Handles avatar image storage in Supabase Storage
 */

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "";

/**
 * Upload image to Supabase Storage
 * @param bucketName - Storage bucket name (e.g., "avatars")
 * @param filePath - Path where file should be stored (e.g., "user-123/avatar.jpg")
 * @param fileBuffer - File content as Buffer
 * @param contentType - MIME type (e.g., "image/jpeg")
 * @returns Public URL of uploaded file
 */
export async function uploadToSupabaseStorage(
  bucketName: string,
  filePath: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase credentials not configured");
  }

  // Upload file to Supabase Storage
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucketName}/${filePath}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "x-upsert": "true", // Overwrite if exists
    },
    body: fileBuffer as unknown as BodyInit,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Supabase Storage upload error:", response.status, errorText);
    throw new Error(`Failed to upload to Supabase Storage: ${response.status} - ${errorText}`);
  }

  // Get public URL
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`;
  return publicUrl;
}

/**
 * Delete image from Supabase Storage
 * @param bucketName - Storage bucket name
 * @param filePath - Path to file to delete
 */
export async function deleteFromSupabaseStorage(
  bucketName: string,
  filePath: string
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase credentials not configured");
  }

  const deleteUrl = `${SUPABASE_URL}/storage/v1/object/${bucketName}/${filePath}`;

  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    // 404 is okay (file doesn't exist)
    const errorText = await response.text();
    console.error("❌ Supabase Storage delete error:", response.status, errorText);
    throw new Error(`Failed to delete from Supabase Storage: ${response.status}`);
  }
}

/**
 * Check if bucket exists and is accessible
 * @param bucketName - Storage bucket name
 */
export async function checkBucketAccess(bucketName: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return false;
  }

  try {
    const listUrl = `${SUPABASE_URL}/storage/v1/bucket/${bucketName}`;
    const response = await fetch(listUrl, {
      method: "GET",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error("❌ Error checking bucket access:", error);
    return false;
  }
}

