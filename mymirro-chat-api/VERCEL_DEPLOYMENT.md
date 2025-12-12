# Vercel Deployment Guide for MyMirro Chat API

This guide will walk you through deploying your MyMirro Chat API to Vercel step by step.

## Prerequisites

- ✅ Vercel account (sign up at [vercel.com](https://vercel.com) if you don't have one)
- ✅ GitHub account (or GitLab/Bitbucket)
- ✅ Your project code pushed to a Git repository
- ✅ Environment variables ready (Gemini API key, Supabase credentials)

---

## Step 1: Prepare Your Repository

### 1.1 Ensure your code is committed and pushed to Git

```bash
cd /Users/mayanklakhani/Documents/MyMirro_new/Chat_langflow/mymirro-chat-api

# Check git status
git status

# If not initialized, initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Prepare for Vercel deployment"

# Create a GitHub repository (if you haven't already)
# Then push:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### 1.2 Verify .gitignore includes sensitive files

Make sure `.env.local` and `node_modules` are in `.gitignore` (they should be by default in Next.js projects).

---

## Step 2: Deploy via Vercel Dashboard (Recommended)

### 2.1 Import Your Project

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Click **"Import Git Repository"**
4. Select your repository (GitHub/GitLab/Bitbucket)
5. If prompted, authorize Vercel to access your Git provider

### 2.2 Configure Project Settings

Vercel will auto-detect Next.js. Verify these settings:

- **Framework Preset**: Next.js (should be auto-detected)
- **Root Directory**: `mymirro-chat-api` (if your repo root is the parent folder)
  - OR leave blank if `mymirro-chat-api` is the repo root
- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)

### 2.3 Add Environment Variables

**CRITICAL**: Add these environment variables in Vercel dashboard before deploying:

1. In the project import screen, expand **"Environment Variables"**
2. Add each variable:

   ```
   GEMINI_API_KEY = your_actual_gemini_api_key
   SUPABASE_URL = https://your-project.supabase.co
   SUPABASE_ANON_KEY = your_supabase_anon_key
   ```

   **OR** if you're using service role key:
   ```
   SUPABASE_SERVICE_ROLE_KEY = your_service_role_key
   ```

3. Make sure to set them for **Production**, **Preview**, and **Development** environments

### 2.4 Deploy

1. Click **"Deploy"**
2. Wait for the build to complete (usually 2-3 minutes)
3. Once deployed, you'll get a URL like: `https://your-project.vercel.app`

---

## Step 3: Deploy via Vercel CLI (Alternative)

### 3.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 3.2 Login to Vercel

```bash
vercel login
```

### 3.3 Navigate to Project Directory

```bash
cd /Users/mayanklakhani/Documents/MyMirro_new/Chat_langflow/mymirro-chat-api
```

### 3.4 Deploy

```bash
# First deployment (will prompt for configuration)
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account/team)
# - Link to existing project? No (for first time)
# - Project name? mymirro-chat-api (or your choice)
# - Directory? ./ (current directory)
# - Override settings? No
```

### 3.5 Add Environment Variables via CLI

```bash
# Add environment variables
vercel env add GEMINI_API_KEY
# Paste your key when prompted
# Select: Production, Preview, Development

vercel env add SUPABASE_URL
# Paste your Supabase URL

vercel env add SUPABASE_ANON_KEY
# Paste your Supabase anon key
```

### 3.6 Deploy to Production

```bash
# Deploy to production
vercel --prod
```

---

## Step 4: Verify Deployment

### 4.1 Test the API Endpoint

Your API will be available at:
```
https://your-project.vercel.app/api/chat
```

Test it with:

```bash
curl -X POST https://your-project.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id",
    "message": "what should I wear today?"
  }'
```

### 4.2 Test the Frontend

Visit:
```
https://your-project.vercel.app
```

You should see the chat interface.

---

## Step 5: Configure Custom Domain (Optional)

1. Go to your project in Vercel dashboard
2. Click **Settings** → **Domains**
3. Add your custom domain
4. Follow DNS configuration instructions
5. Wait for SSL certificate (automatic, usually < 1 minute)

---

## Step 6: Monitor and Debug

### 6.1 View Logs

- **Vercel Dashboard**: Go to your project → **Deployments** → Click a deployment → **Functions** tab
- **CLI**: `vercel logs`

### 6.2 Common Issues

**Issue**: Build fails with "Module not found"
- **Solution**: Ensure all dependencies are in `package.json` (not just devDependencies)

**Issue**: Environment variables not working
- **Solution**: 
  1. Check variables are set in Vercel dashboard
  2. Redeploy after adding variables
  3. Verify variable names match exactly (case-sensitive)

**Issue**: API returns 500 errors
- **Solution**: 
  1. Check Vercel function logs
  2. Verify all environment variables are set
  3. Check Supabase and Gemini API keys are valid

**Issue**: CORS errors
- **Solution**: Next.js API routes handle CORS automatically, but if you need custom headers, add them in `next.config.js`

---

## Step 7: Continuous Deployment

Once connected to Git, Vercel will automatically:
- ✅ Deploy on every push to `main` branch (production)
- ✅ Create preview deployments for pull requests
- ✅ Run builds automatically

### 7.1 Branch Protection (Recommended)

1. Go to **Settings** → **Git**
2. Configure which branches trigger production deployments
3. Enable **"Production Branch"** protection

---

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `GEMINI_API_KEY` | ✅ Yes | Your Google Gemini API key | `AIzaSy...` |
| `SUPABASE_URL` | ✅ Yes | Your Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | ✅ Yes | Supabase anonymous key | `eyJhbGc...` |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Optional | Service role key (for RLS bypass) | `eyJhbGc...` |
| `NODE_ENV` | ❌ Auto | Automatically set to `production` by Vercel | - |

---

## Project Structure for Vercel

Vercel expects:
```
mymirro-chat-api/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts  ← API endpoint
│   └── page.tsx           ← Frontend
├── package.json
├── next.config.js
├── tsconfig.json
└── ... (other files)
```

---

## Quick Deploy Checklist

- [ ] Code pushed to Git repository
- [ ] Vercel account created
- [ ] Project imported in Vercel
- [ ] Environment variables added:
  - [ ] `GEMINI_API_KEY`
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] Build successful
- [ ] API endpoint tested
- [ ] Frontend tested
- [ ] Custom domain configured (optional)

---

## Support

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Next.js Deployment**: [nextjs.org/docs/deployment](https://nextjs.org/docs/deployment)
- **Vercel Status**: [vercel-status.com](https://vercel-status.com)

---

## Next Steps After Deployment

1. ✅ Test all API endpoints
2. ✅ Monitor function execution times in Vercel dashboard
3. ✅ Set up error tracking (optional: Sentry, LogRocket)
4. ✅ Configure rate limiting if needed
5. ✅ Set up monitoring/alerts for API health

---

**🎉 Congratulations! Your MyMirro Chat API is now live on Vercel!**

