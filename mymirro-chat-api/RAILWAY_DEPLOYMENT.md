# Railway Deployment Guide for MyMirro Chat API

## Problem
Railway is trying to build from the root directory (`Chat_langflow/`) which contains multiple Dockerfiles and a complex structure. The actual Next.js API is in the `mymirro-chat-api/` subdirectory.

## Solution

### Option 1: Set Root Directory in Railway Dashboard (Recommended)

1. **Go to your Railway project settings**
2. **Navigate to "Settings" → "Source"**
3. **Set the "Root Directory" to**: `mymirro-chat-api`
4. **Save the changes**
5. **Redeploy**

This tells Railway to build from the `mymirro-chat-api/` directory instead of the root.

### Option 2: Use Railway CLI

If you're using Railway CLI, you can specify the root directory:

```bash
railway link
railway set ROOT_DIR=mymirro-chat-api
railway up
```

### Option 3: Move Repository Root

If you want Railway to automatically detect the Next.js app, you could:
1. Create a separate repository with only the `mymirro-chat-api/` folder
2. Connect that repository to Railway

## Environment Variables

Make sure to set these environment variables in Railway:

```
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
NODE_ENV=production
PORT=3000
```

## Build Configuration

The project includes:
- `railway.json` - Railway-specific configuration
- `nixpacks.toml` - Nixpacks build configuration (used by Railway)

Both files are configured to:
1. Install dependencies with `npm ci`
2. Build with `npm run build`
3. Start with `npm start`

## Verification

After deployment, test the API:

```bash
curl https://your-app.railway.app/api/test-env
```

This should return a JSON response confirming environment variables are set.

## Troubleshooting

### Build Fails with "Could not determine how to build"
- **Solution**: Make sure the root directory is set to `mymirro-chat-api` in Railway settings

### Build Fails with Module Not Found
- **Solution**: Check that `package.json` has all required dependencies

### Runtime Errors
- **Solution**: Check Railway logs for specific error messages
- Verify all environment variables are set correctly

## Next Steps

After successful deployment:
1. Test the `/api/chat` endpoint
2. Verify Supabase connection
3. Test with a sample request

