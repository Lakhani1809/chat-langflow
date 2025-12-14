/**
 * Avatar Upload API
 * POST /api/avatar/upload
 * 
 * Handles user avatar image upload:
 * 1. Receives user_id and image file
 * 2. Validates and processes image
 * 3. Uploads to Supabase Storage
 * 4. Updates user_profiles.avatar_image_url
 * 
 * Request: multipart/form-data
 * - userId: string
 * - image: File (image/jpeg, image/png, image/webp)
 * 
 * Response: { avatar_image_url: string, success: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { uploadToSupabaseStorage, deleteFromSupabaseStorage, checkBucketAccess } from "../../../../utils/supabaseStorage";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "";

// Configuration
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const STORAGE_BUCKET = "avatars"; // Supabase Storage bucket name

/**
 * Validate image file
 */
function validateImage(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Update user profile with avatar URL
 */
async function updateUserProfileAvatar(
  userId: string,
  avatarUrl: string
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase credentials not configured");
  }

  const updateUrl = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`;

  const response = await fetch(updateUrl, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      avatar_image_url: avatarUrl,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Failed to update user profile:", response.status, errorText);
    throw new Error(`Failed to update user profile: ${response.status}`);
  }
}

/**
 * Get existing avatar URL for user (to delete old one)
 */
async function getExistingAvatarUrl(userId: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return null;
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}&select=avatar_image_url`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (response.ok) {
      const profiles = await response.json();
      if (profiles.length > 0 && profiles[0].avatar_image_url) {
        return profiles[0].avatar_image_url;
      }
    }
  } catch (error) {
    console.debug("Error fetching existing avatar:", error);
  }

  return null;
}

/**
 * Extract file path from Supabase Storage URL
 */
function extractFilePathFromUrl(url: string): string | null {
  // URL format: https://xxx.supabase.co/storage/v1/object/public/avatars/user-123/avatar.jpg
  const match = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
  return match ? match[1] : null;
}

export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const userId = formData.get("userId") as string;
    const imageFile = formData.get("image") as File | null;

    // Validate input
    if (!userId || !userId.trim()) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (!imageFile) {
      return NextResponse.json(
        { error: "image file is required" },
        { status: 400 }
      );
    }

    // Validate image
    const validation = validateImage(imageFile);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    console.log(`📸 Uploading avatar for user ${userId}`);
    console.log(`   File: ${imageFile.name}, Size: ${(imageFile.size / 1024).toFixed(2)}KB, Type: ${imageFile.type}`);

    // Check bucket access
    const bucketAccessible = await checkBucketAccess(STORAGE_BUCKET);
    if (!bucketAccessible) {
      console.warn(`⚠️ Bucket "${STORAGE_BUCKET}" may not exist or is not accessible. Please create it in Supabase Dashboard.`);
      // Continue anyway - might work if bucket exists but check fails
    }

    // Get existing avatar to delete later
    const existingAvatarUrl = await getExistingAvatarUrl(userId);

    // Convert file to buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Generate file path: avatars/user-{userId}/avatar-{timestamp}.{ext}
    const timestamp = Date.now();
    const fileExtension = imageFile.name.split(".").pop() || "jpg";
    const filePath = `user-${userId}/avatar-${timestamp}.${fileExtension}`;

    // Upload to Supabase Storage
    const avatarUrl = await uploadToSupabaseStorage(
      STORAGE_BUCKET,
      filePath,
      fileBuffer,
      imageFile.type
    );

    console.log(`✅ Avatar uploaded: ${avatarUrl}`);

    // Update user profile
    await updateUserProfileAvatar(userId, avatarUrl);

    // Delete old avatar if exists
    if (existingAvatarUrl) {
      try {
        const oldFilePath = extractFilePathFromUrl(existingAvatarUrl);
        if (oldFilePath) {
          await deleteFromSupabaseStorage(STORAGE_BUCKET, oldFilePath);
          console.log(`🗑️ Deleted old avatar: ${oldFilePath}`);
        }
      } catch (error) {
        // Non-critical error - log but don't fail
        console.warn("⚠️ Failed to delete old avatar:", error);
      }
    }

    return NextResponse.json({
      success: true,
      avatar_image_url: avatarUrl,
      message: "Avatar uploaded successfully",
    });

  } catch (error) {
    console.error("❌ Avatar upload error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/avatar/upload?userId=xxx
 * Get current avatar URL for a user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId query parameter is required" },
        { status: 400 }
      );
    }

    const avatarUrl = await getExistingAvatarUrl(userId);

    return NextResponse.json({
      success: true,
      avatar_image_url: avatarUrl || null,
    });

  } catch (error) {
    console.error("❌ Error fetching avatar:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

