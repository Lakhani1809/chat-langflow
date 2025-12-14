# Railway Deployment Setup Guide

## Quick Setup

### Option 1: Using Railway Dashboard (Recommended)

1. **Connect Repository**
   - Go to [Railway Dashboard](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - **IMPORTANT**: Set **Root Directory** to `mymirro-chat-api`

2. **Set Environment Variables**
   - Go to your project → Variables
   - Add these variables:
     ```
     GEMINI_API_KEY=your_gemini_api_key
     SUPABASE_URL=https://your-project.supabase.co
     SUPABASE_ANON_KEY=your_supabase_anon_key
     NODE_ENV=production
     PORT=3000
     ```

3. **Deploy**
   - Railway will automatically detect the Dockerfile or use Nixpacks
   - The build will start automatically
   - Wait for deployment to complete

### Option 2: Using Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Set root directory
railway set ROOT_DIR=mymirro-chat-api

# Set environment variables
railway variables set GEMINI_API_KEY=your_key
railway variables set SUPABASE_URL=https://your-project.supabase.co
railway variables set SUPABASE_ANON_KEY=your_key
railway variables set NODE_ENV=production

# Deploy
railway up
```

## Build Configuration

Railway will use one of these methods (in order of preference):

1. **Dockerfile** (if present) - We've created one
2. **Nixpacks** (automatic detection) - We have `nixpacks.toml`
3. **railway.json** - We have configuration

## Verification

After deployment, test your API:

```bash
# Test the API endpoint
curl -X POST https://your-app.railway.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "message": "What should I wear today?"
  }'

# Test environment variables
curl https://your-app.railway.app/api/test-env
```

## Troubleshooting

### Build Fails: "Could not determine how to build"
- **Solution**: Make sure Root Directory is set to `mymirro-chat-api` in Railway settings

### Build Fails: "Module not found"
- **Solution**: Check that `package.json` has all dependencies
- Run `npm install` locally to verify

### Runtime Error: "Environment variable not set"
- **Solution**: Check all environment variables are set in Railway dashboard
- Verify variable names match exactly (case-sensitive)

### Port Issues
- Railway automatically sets `PORT` environment variable
- Next.js will use `PORT` if available, otherwise defaults to 3000
- Our Dockerfile and config handle this automatically

### API Returns 404
- **Check**: Make sure you're using the correct endpoint: `/api/chat`
- **Check**: Verify the deployment completed successfully
- **Check**: Check Railway logs for errors

## Monitoring

- **Logs**: View real-time logs in Railway dashboard
- **Metrics**: Check CPU, Memory, and Network usage
- **Deployments**: View deployment history and rollback if needed

## Production Checklist

- [ ] Root directory set to `mymirro-chat-api`
- [ ] All environment variables set
- [ ] Build completes successfully
- [ ] API endpoint responds correctly
- [ ] Supabase connection works
- [ ] Gemini API key is valid
- [ ] Test with a real request

## Next Steps

1. Set up custom domain (optional)
2. Configure auto-deploy from main branch
3. Set up monitoring/alerts
4. Review and optimize build times

