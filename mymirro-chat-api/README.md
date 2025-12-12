# MyMirro Chat API

Next.js API for the MyMirro fashion stylist chat workflow.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment variables are already configured** in `.env.local`:
   - Gemini API key
   - Supabase credentials
   - Logging endpoint

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Test the API:**
   ```bash
   # Test general chat
   curl -X POST http://localhost:3000/api/chat \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "test-user-123",
       "message": "Hello!"
     }'

   # Test outfit generation
   curl -X POST http://localhost:3000/api/chat \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "your-user-id-from-supabase",
       "message": "What should I wear for a date?"
     }'
   ```

## API Endpoints

### POST /api/chat

Main chat endpoint.

**Request:**
```json
{
  "userId": "string",
  "message": "string",
  "conversationId": "string (optional)",
  "history": [
    { "role": "user" | "assistant", "content": "string" }
  ]
}
```

**Response:**
```json
{
  "intent": "outfit_generation",
  "message": "Here's a winter date-night look...",
  "outfits": [
    {
      "title": "Clean Winter Date Look",
      "items": ["White oversized shirt", "Black slim jeans"],
      "why_it_works": "..."
    }
  ],
  "extra_tips": ["..."]
}
```

### POST /api/chat-log

Analytics/logging endpoint (called automatically).

## Supabase Setup

The API queries the `wardrobe_items` table:
- Filters by `user_id` column
- Expects columns: `id`, `category`, `color`, `fit`, `style`

If you have a `user_profiles` table with `body_type` and `style_keywords`, it will be used automatically.

## Notes

- Make sure your Supabase `wardrobe_items` table has the correct columns
- The `user_id` in the API request should match the `user_id` in your Supabase table
- Debug info is included in responses when `NODE_ENV=development`

