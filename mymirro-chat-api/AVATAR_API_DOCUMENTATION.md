# Avatar Upload API Documentation

## Overview

The Avatar Upload API allows you to upload and manage user avatar images. Images are stored in Supabase Storage and the URL is saved in the `user_profiles` table.

## Endpoints

### POST /api/avatar/upload

Upload a new avatar image for a user.

#### Request

**Content-Type**: `multipart/form-data`

**Form Fields**:
- `userId` (string, required): User ID
- `image` (File, required): Image file (JPEG, PNG, or WebP)

**File Requirements**:
- Maximum size: 5MB
- Allowed formats: JPEG, JPG, PNG, WebP
- MIME types: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`

#### Response

**Success (200)**:
```json
{
  "success": true,
  "avatar_image_url": "https://xxx.supabase.co/storage/v1/object/public/avatars/user-123/avatar-1234567890.jpg",
  "message": "Avatar uploaded successfully"
}
```

**Error (400)**:
```json
{
  "success": false,
  "error": "userId is required"
}
```

**Error (500)**:
```json
{
  "success": false,
  "error": "Internal server error"
}
```

#### Example Usage

**cURL**:
```bash
curl -X POST https://your-api.com/api/avatar/upload \
  -F "userId=user-123" \
  -F "image=@/path/to/avatar.jpg"
```

**JavaScript (Fetch)**:
```javascript
const formData = new FormData();
formData.append('userId', 'user-123');
formData.append('image', fileInput.files[0]);

const response = await fetch('https://your-api.com/api/avatar/upload', {
  method: 'POST',
  body: formData,
});

const data = await response.json();
console.log(data.avatar_image_url);
```

**React Example**:
```typescript
const uploadAvatar = async (userId: string, file: File) => {
  const formData = new FormData();
  formData.append('userId', userId);
  formData.append('image', file);

  const response = await fetch('/api/avatar/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  return response.json();
};
```

---

### GET /api/avatar/upload?userId=xxx

Get the current avatar URL for a user.

#### Request

**Query Parameters**:
- `userId` (string, required): User ID

#### Response

**Success (200)**:
```json
{
  "success": true,
  "avatar_image_url": "https://xxx.supabase.co/storage/v1/object/public/avatars/user-123/avatar-1234567890.jpg"
}
```

If no avatar exists:
```json
{
  "success": true,
  "avatar_image_url": null
}
```

#### Example Usage

**cURL**:
```bash
curl "https://your-api.com/api/avatar/upload?userId=user-123"
```

**JavaScript**:
```javascript
const response = await fetch(`/api/avatar/upload?userId=user-123`);
const data = await response.json();
console.log(data.avatar_image_url);
```

---

## Supabase Setup

### 1. Create Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage**
3. Click **New bucket**
4. Name: `avatars`
5. **Public bucket**: ✅ Yes (so images are publicly accessible)
6. Click **Create bucket**

### 2. Set Bucket Policies

For the `avatars` bucket, set these policies:

**Policy 1: Allow authenticated uploads**
```sql
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'user-' || auth.uid()::text
);
```

**Policy 2: Allow public read access**
```sql
CREATE POLICY "Public avatar access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

**Policy 3: Allow users to update their own avatars**
```sql
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'user-' || auth.uid()::text
);
```

**Policy 4: Allow users to delete their own avatars**
```sql
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'user-' || auth.uid()::text
);
```

### 3. Add Database Column

Add the `avatar_image_url` column to the `user_profiles` table:

```sql
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS avatar_image_url TEXT;

-- Optional: Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_avatar_url 
ON user_profiles(avatar_image_url) 
WHERE avatar_image_url IS NOT NULL;
```

---

## File Storage Structure

Images are stored in Supabase Storage with the following structure:

```
avatars/
  └── user-{userId}/
      └── avatar-{timestamp}.{ext}
```

**Example**:
```
avatars/
  └── user-123/
      └── avatar-1703123456789.jpg
```

---

## Features

### Automatic Old Avatar Cleanup

When a user uploads a new avatar, the old avatar is automatically deleted from storage to save space.

### Image Validation

- File size validation (max 5MB)
- MIME type validation (JPEG, PNG, WebP only)
- Automatic file extension detection

### Error Handling

- Comprehensive error messages
- Graceful handling of missing buckets
- Non-critical errors logged but don't fail the request

---

## Environment Variables

Required environment variables (already set for chat API):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Integration with Chat API

The avatar URL is automatically included when fetching user profiles:

```typescript
// In utils/supabaseClient.ts
const profile = await fetchUserProfile(userId);
console.log(profile.avatar_image_url); // Avatar URL if exists
```

---

## Error Codes

| Status Code | Description |
|------------|-------------|
| 200 | Success |
| 400 | Bad Request (missing userId or image, invalid file) |
| 500 | Internal Server Error (upload failed, database error) |

---

## Security Considerations

1. **File Size Limit**: 5MB maximum to prevent abuse
2. **File Type Validation**: Only image formats allowed
3. **User Isolation**: Each user's avatars are stored in separate folders
4. **Public Access**: Avatars are publicly accessible (consider authentication if needed)

---

## Troubleshooting

### "Bucket not accessible" warning

- **Cause**: The `avatars` bucket doesn't exist or has incorrect permissions
- **Solution**: Create the bucket in Supabase Dashboard and set public access

### Upload fails with 500 error

- **Check**: Supabase credentials are set correctly
- **Check**: Bucket exists and is public
- **Check**: Database column `avatar_image_url` exists
- **Check**: Network connectivity to Supabase

### Old avatar not deleted

- **Cause**: Non-critical error during deletion
- **Impact**: Old avatars remain in storage (manual cleanup may be needed)
- **Note**: This doesn't affect new uploads

---

## Testing

### Test Upload

```bash
# Upload avatar
curl -X POST http://localhost:3000/api/avatar/upload \
  -F "userId=test-user-123" \
  -F "image=@./test-avatar.jpg"
```

### Test Get Avatar

```bash
# Get avatar URL
curl "http://localhost:3000/api/avatar/upload?userId=test-user-123"
```

---

## Next Steps

After setting up the API:

1. ✅ Create `avatars` bucket in Supabase
2. ✅ Add `avatar_image_url` column to `user_profiles` table
3. ✅ Set bucket policies (optional, for authenticated access)
4. ✅ Test the API endpoints
5. ✅ Integrate into your consumer application

