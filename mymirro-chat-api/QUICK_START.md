# 🚀 Quick Start - 3 Commands

## 1. Install Dependencies
```bash
cd mymirro-chat-api
npm install
```

## 2. Start Server
```bash
npm run dev
```

## 3. Test It
```bash
# In another terminal:
./test-api.sh
```

**OR** test manually:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id-from-supabase",
    "message": "What should I wear for a date?"
  }'
```

---

## ⚠️ Important: Use Real User ID

Replace `"your-user-id-from-supabase"` with an actual `user_id` from your Supabase `wardrobe_items` table.

To find a user_id:
1. Go to your Supabase dashboard
2. Open the `wardrobe_items` table
3. Copy any `user_id` value
4. Use it in the API request

---

## ✅ What's Already Configured

- ✅ Gemini API key
- ✅ Supabase credentials  
- ✅ All code files
- ✅ Environment variables

**You're ready to go!** 🎉

