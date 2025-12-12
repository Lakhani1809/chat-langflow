# Setup Instructions

## ✅ Everything is Ready!

Your Next.js chat API project is set up with:
- ✅ Gemini API key configured
- ✅ Supabase credentials configured
- ✅ All code files in place
- ✅ Analytics endpoint created

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
cd mymirro-chat-api
npm install
```

### Step 2: Start the Development Server

```bash
npm run dev
```

The API will be available at: `http://localhost:3000`

### Step 3: Test the API

Open a new terminal and run:

```bash
cd mymirro-chat-api
./test-api.sh
```

Or test manually:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id-from-supabase",
    "message": "What should I wear for a date?"
  }'
```

## 📋 Important Notes

### Supabase Table Structure

The API expects your `wardrobe_items` table to have these columns:
- `id` (string or number)
- `user_id` (string) - matches the `userId` in API requests
- `category` (string, optional) - e.g., "shirt", "jeans", "sneakers"
- `color` (string, optional) - e.g., "white", "black"
- `fit` (string, optional) - e.g., "oversized", "slim"
- `style` (string, optional) - e.g., "minimal", "street"

### Testing with Real Data

1. **Get a user_id from your Supabase `wardrobe_items` table:**
   ```sql
   SELECT DISTINCT user_id FROM wardrobe_items LIMIT 1;
   ```

2. **Use that user_id in your API request:**
   ```bash
   curl -X POST http://localhost:3000/api/chat \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "actual-user-id-from-supabase",
       "message": "What should I wear?"
     }'
   ```

### Optional: User Profiles Table

If you want to include `body_type` and `style_keywords`, create a `user_profiles` table:

```sql
CREATE TABLE user_profiles (
  id TEXT PRIMARY KEY,  -- matches user_id
  body_type TEXT,
  style_keywords TEXT[]  -- array of strings
);
```

The API will automatically use this if it exists.

## 🐛 Troubleshooting

### "Cannot find module" errors
- Make sure you ran `npm install`
- Check that all files are in the correct directories

### Supabase connection errors
- Verify your Supabase URL and key in `.env.local`
- Check that your `wardrobe_items` table exists and has the correct columns
- Make sure Row Level Security (RLS) allows reads (or disable RLS for testing)

### Gemini API errors
- Check that your API key is correct
- Verify you have quota/credits in Google AI Studio

### Port already in use
- Change the port: `npm run dev -- -p 3001`

## 📝 Next Steps

1. Test with a real user_id from your Supabase table
2. Check the console logs for any errors
3. Review the API responses - debug info is included in development mode
4. Customize prompts in `lib/llm-helpers.ts` if needed

## 🎉 You're Ready!

Run `npm install` and `npm run dev` to start testing!

