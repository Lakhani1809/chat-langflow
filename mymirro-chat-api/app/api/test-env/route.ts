/**
 * Test Environment Variables Endpoint
 * Use this to verify environment variables are set correctly on Vercel
 * 
 * ⚠️ REMOVE THIS FILE AFTER TESTING - It exposes configuration info
 */

import { NextResponse } from "next/server";

export async function GET() {
  // Only allow in development or with a secret key
  const secret = process.env.TEST_ENV_SECRET;
  const requestSecret = new URL(process.env.VERCEL_URL || "http://localhost:3000", "http://localhost:3000").searchParams.get("secret");
  
  // In production, require a secret to prevent unauthorized access
  if (process.env.NODE_ENV === "production" && secret && requestSecret !== secret) {
    return NextResponse.json(
      { error: "Unauthorized. Add ?secret=YOUR_SECRET to the URL" },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    hasSupabaseUrl: !!supabaseUrl,
    hasSupabaseKey: !!supabaseKey,
    hasGeminiKey: !!geminiKey,
    supabaseUrlPrefix: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : "NOT SET",
    supabaseKeyPrefix: supabaseKey ? `${supabaseKey.substring(0, 10)}...` : "NOT SET",
    geminiKeyPrefix: geminiKey ? `${geminiKey.substring(0, 10)}...` : "NOT SET",
    // Don't expose full values for security
  });
}

