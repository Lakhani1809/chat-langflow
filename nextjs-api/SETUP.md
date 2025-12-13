# Setup Guide for MyMirro Chat API

## What You Need

To get the chat API working, I need the following information from you:

### 1. **Gemini API Key** (Required)
- Get it from: https://aistudio.google.com/app/apikey
- This is used for all LLM calls (intent, color, silhouette, body type, reasoning, final response)

### 2. **Wardrobe/Profile API** (Choose one option)

**Option A: REST API Endpoint**
- Do you have an existing API endpoint that returns wardrobe data?
- Format: `GET /api/wardrobe?userId=...`
- Returns: `{ userId, body_type, style_keywords, wardrobe_items: [...] }`

**Option B: Supabase**
- Do you have a Supabase project?
- I'll need:
  - Supabase URL (e.g., `https://xxxxx.supabase.co`)
  - Supabase Anon Key
  - Does the RPC function `get_user_wardrobe_and_profile(user_id uuid)` exist, or should I create it?

**Option C: Mock/Test Data**
- For testing, I can create a mock wardrobe service that returns sample data

### 3. **Next.js Project Location**
- Do you have an existing Next.js project, or should I create a new one?
- If existing, where is it located?
- If new, should I create it in a separate directory?

### 4. **Analytics/Logging** (Optional)
- Do you want to log chat requests to a database?
- If yes, what's the endpoint? (e.g., `POST /api/chat-log`)

## Quick Setup Options

### Option 1: Standalone Next.js Project
I can create a complete Next.js project with just the chat API.

### Option 2: Integrate into Existing Next.js Project
If you have an existing Next.js project, I can integrate the code into it.

### Option 3: Test with Mock Data
I can set up everything with mock wardrobe data so you can test immediately.

## What I'll Do Next

Once you provide the information above, I will:

1. ✅ Set up the Next.js project structure (if needed)
2. ✅ Create `.env.local` with your API keys
3. ✅ Set up the wardrobe API integration (or mock it)
4. ✅ Create a test script to verify everything works
5. ✅ Provide instructions to run and test the API

## Questions for You

1. **Do you have a Gemini API key?** (Yes/No - if no, I can guide you to get one)
2. **How do you want to handle wardrobe data?** (REST API / Supabase / Mock for now)
3. **Do you have an existing Next.js project?** (Yes/No - if yes, where?)
4. **Do you want to test immediately?** (I can set up with mock data)

Let me know and I'll proceed! 🚀


