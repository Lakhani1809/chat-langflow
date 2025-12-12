/**
 * Next.js API route: POST /api/chat-log
 * Analytics/logging endpoint for chat requests
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const logData = await request.json();

    // Log to console (in production, you'd save to database)
    console.log("Chat Request Log:", JSON.stringify(logData, null, 2));

    // TODO: Save to database if needed
    // Example:
    // await saveToDatabase(logData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to log chat request:", error);
    // Don't fail the main request if logging fails
    return NextResponse.json(
      { success: false, error: "Logging failed" },
      { status: 500 }
    );
  }
}

