# Quick Start Guide

## What I Need From You

To get the chat API up and running, I need the following:

### 1. **Gemini API Key** ⚠️ REQUIRED

**How to get it:**
1. Go to https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key

**I'll need:** The API key string (looks like: `AIzaSy...`)

---

### 2. **Wardrobe Data Source** (Choose ONE)

#### Option A: You have a REST API
- **Endpoint URL:** `http://your-api.com/api/wardrobe` or similar
- **Format:** `GET /api/wardrobe?userId=xxx` returns JSON with wardrobe items

#### Option B: You use Supabase
- **Supabase URL:** `https://xxxxx.supabase.co`
- **Supabase Anon Key:** (from your Supabase dashboard)
- **RPC Function:** Does `get_user_wardrobe_and_profile(user_id uuid)` exist? (If not, I can create it)

#### Option C: Mock Data (For Testing)
- I can set it up with mock data so you can test immediately
- You can connect real data later

---

### 3. **Next.js Project Setup**

**Do you have a Next.js project already?**
- ✅ **Yes** → Tell me the path/location
- ❌ **No** → I'll create one for you

---

### 4. **Optional: Analytics/Logging**

Do you want to log chat requests?
- If yes, what's the endpoint? (e.g., `POST /api/chat-log`)
- If no, we'll just log to console

---

## What I'll Do Once You Provide This

1. ✅ Create/configure Next.js project
2. ✅ Set up environment variables
3. ✅ Configure wardrobe API integration
4. ✅ Create test script
5. ✅ Give you instructions to run it

---

## Quick Answers I Need

Just answer these:

1. **Gemini API Key:** `[your key here or "I need to get one"]`
2. **Wardrobe:** `[REST API URL]` OR `[Supabase URL + Key]` OR `[Use mock data for now]`
3. **Next.js:** `[Path to existing project]` OR `[Create new one]`
4. **Logging:** `[Endpoint URL]` OR `[Skip for now]`

---

## Or... Let's Start with Mock Data!

If you want to test immediately, I can:
- Set up everything with mock wardrobe data
- You just need to provide the Gemini API key
- Test the full workflow
- Connect real wardrobe data later

**Just say: "Let's use mock data for now"** and provide your Gemini API key! 🚀


