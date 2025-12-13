# Next.js Chat API Implementation

This directory contains the implementation of the `/api/chat` endpoint for the MyMirro fashion stylist AI workflow.

## Structure

```
nextjs-api/
├── app/
│   └── api/
│       └── chat/
│           └── route.ts          # Main API route handler
├── lib/
│   ├── llm-helpers.ts            # LLM call helper functions
│   ├── wardrobe-client.ts        # Wardrobe/profile API client
│   ├── safety-checks.ts          # Outfit validation
│   └── logger.ts                 # Logging utilities
├── utils/
│   ├── gemini-client.ts          # Gemini API client with retries
│   └── json-parser.ts            # Robust JSON parsing
└── types.ts                      # TypeScript type definitions
```

## Environment Variables

Create a `.env.local` file in your Next.js project root:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Wardrobe API (choose one)
WARDROBE_API_URL=http://localhost:3000/api/wardrobe
# OR
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Analytics/Logging
CHAT_LOG_API_URL=http://localhost:3000/api/chat-log
```

## Installation

1. Copy the `nextjs-api` directory to your Next.js project
2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

## Usage

The API endpoint is available at `POST /api/chat`:

```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    userId: 'user-123',
    message: 'What should I wear for a date?',
    conversationId: 'conv-456', // optional
    history: [ // optional
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi! How can I help?' }
    ],
  }),
});

const data = await response.json();
```

## Response Format

```typescript
{
  intent: "outfit_generation",
  message: "Here's a winter date-night look...",
  outfits: [
    {
      title: "Clean Winter Date Look",
      items: ["White oversized shirt", "Black slim jeans", "White sneakers"],
      why_it_works: "The monochrome base keeps it minimal..."
    }
  ],
  extra_tips: [
    "Add a structured jacket to sharpen the silhouette.",
    "Keep accessories minimal..."
  ],
  // Debug info (only in development)
  debug?: {
    colorAnalysis: {...},
    silhouetteAnalysis: {...},
    bodyTypeAnalysis: {...},
    reasoning: {...}
  }
}
```

## Workflow Steps

1. **Intent Classification**: Determines if the message is styling-related or general chat
2. **Wardrobe Retrieval**: Fetches user's wardrobe and profile data
3. **Parallel Analysis**: Runs color, silhouette, and body type analysis in parallel
4. **Reasoning Composition**: Combines the three analyses into a summary
5. **Final Response**: Generates the user-facing stylist response

## Error Handling

- All LLM calls have timeout protection (5-8 seconds)
- Retries with exponential backoff for transient errors
- Fallback responses for failed analysis modules
- Safety checks to ensure outfits only reference wardrobe items

## Testing

Test the endpoint with curl:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "message": "What should I wear for a date?"
  }'
```

## Notes

- The implementation follows the exact sequential/parallel flow specified
- All helper functions are modular and can be tested independently
- JSON parsing is robust and handles markdown code fences
- Outfit validation ensures only wardrobe items are suggested


