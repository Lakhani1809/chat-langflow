"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ============================================
// TYPES
// ============================================

type VisualOutfitItem = {
  id: string;
  name: string;
  image_url: string;
  layer: string;
};

type VisualOutfit = {
  title: string;
  layout: "1x1" | "2x1" | "3x1" | "2x2";
  items: VisualOutfitItem[];
  why_it_works: string;
  occasion?: string;
  vibe?: string;
};

type LegacyOutfit = {
  title: string;
  items: string[];
  why_it_works: string;
  occasion?: string;
  vibe?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  outfits?: (VisualOutfit | LegacyOutfit)[];
  extraTips?: string[];
  brands?: string[];
  packingList?: string[];
  trendSummary?: string;
  suggestionPills?: string[];
  intent?: string;
  timestamp: Date;
};

// ============================================
// CONSTANTS
// ============================================

// Staged thinking messages - timed progression to simulate backend work
const THINKING_STAGES = [
  { message: "thinking...", duration: 800 },
  { message: "checking your wardrobe...", duration: 1500 },
  { message: "understanding your style...", duration: 2000 },
  { message: "styling outfits...", duration: 3000 },
  { message: "almost there...", duration: 5000 },
];

const INITIAL_SUGGESTIONS = [
  "what should I wear today?",
  "date night outfit",
  "casual brunch look",
  "office fit ideas",
  "pack for beach trip",
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function isVisualOutfit(outfit: VisualOutfit | LegacyOutfit): outfit is VisualOutfit {
  return "layout" in outfit && Array.isArray((outfit as VisualOutfit).items) && 
    (outfit as VisualOutfit).items.length > 0 && 
    typeof (outfit as VisualOutfit).items[0] === "object";
}

// ============================================
// COMPONENTS
// ============================================

function ThinkingBubble() {
  const [stageIndex, setStageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    // Update elapsed time every 100ms for smooth transitions
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 100);
    }, 100);

    return () => clearInterval(timer);
  }, []);

  // Progress through stages based on elapsed time
  useEffect(() => {
    let cumulativeTime = 0;
    for (let i = 0; i < THINKING_STAGES.length; i++) {
      cumulativeTime += THINKING_STAGES[i].duration;
      if (elapsedTime < cumulativeTime) {
        setStageIndex(i);
        return;
      }
    }
    // Stay on last stage if exceeded all
    setStageIndex(THINKING_STAGES.length - 1);
  }, [elapsedTime]);

  const currentStage = THINKING_STAGES[stageIndex];
  
  // Calculate progress within current stage for subtle animation
  let stageStartTime = 0;
  for (let i = 0; i < stageIndex; i++) {
    stageStartTime += THINKING_STAGES[i].duration;
  }
  const stageProgress = Math.min(
    100,
    ((elapsedTime - stageStartTime) / currentStage.duration) * 100
  );

  return (
    <div className="flex gap-3 max-w-2xl">
      <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center flex-shrink-0">
        <span className="text-xs">✨</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <span className="inline-flex gap-1">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
          <span className="text-gray-400 transition-all duration-300">{currentStage.message}</span>
        </div>
        {/* Subtle progress indicator */}
        <div className="mt-2 w-32 h-0.5 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gray-300 transition-all duration-100 ease-out"
            style={{ width: `${(stageIndex / (THINKING_STAGES.length - 1)) * 100 + (stageProgress / THINKING_STAGES.length)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function OutfitCard({ outfit }: { outfit: VisualOutfit | LegacyOutfit }) {
  const isVisual = isVisualOutfit(outfit);

  // Build a collage-friendly set of images (max 4)
  const images = isVisual ? (outfit as VisualOutfit).items.slice(0, 4) : [];

  // Decide grid spans to keep a single grouped canvas feel
  const getCellClass = (idx: number, count: number) => {
    if (count === 1) return "col-span-2 row-span-2"; // one big image
    if (count === 2) return "row-span-2"; // split vertically
    return ""; // default 2x2 cells
  };

  return (
    <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
      {/* Title */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">✨</span>
          <h4 className="font-medium text-gray-900">{outfit.title}</h4>
        </div>
      </div>

      {/* Image Grid or Items List */}
      <div className="px-4 pb-3">
        {isVisual && images.length > 0 ? (
          <div className="grid grid-cols-2 grid-rows-2 gap-1.5 rounded-xl overflow-hidden">
            {images.map((item, idx) => (
              <div
                key={item.id || idx}
                className={`relative bg-white border border-gray-100 overflow-hidden ${getCellClass(
                  idx,
                  images.length
                )}`}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <span className="text-2xl">👔</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {(outfit as LegacyOutfit).items.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Why it works */}
      <div className="px-4 py-3 bg-white border-t border-gray-100">
        <p className="text-sm text-gray-500">{outfit.why_it_works}</p>
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-gray-100 rounded-2xl px-4 py-2.5">
          <p className="text-gray-900 text-sm">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 max-w-2xl">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center flex-shrink-0">
        <span className="text-xs">✨</span>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4 min-w-0">
        {/* Main message */}
        <p className="text-gray-800 text-sm leading-relaxed">{message.content}</p>

        {/* Outfits */}
        {message.outfits && message.outfits.length > 0 && (
          <div className="space-y-3">
            {message.outfits.map((outfit, idx) => (
              <OutfitCard key={idx} outfit={outfit} />
            ))}
          </div>
        )}

        {/* Brands */}
        {message.brands && message.brands.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.brands.map((brand, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600"
              >
                {brand}
              </span>
            ))}
          </div>
        )}

        {/* Packing List */}
        {message.packingList && message.packingList.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">packing list</p>
            <div className="space-y-1.5">
              {message.packingList.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-4 h-4 rounded border border-gray-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trend Summary */}
        {message.trendSummary && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-1">trend insight</p>
            <p className="text-sm text-gray-700">{message.trendSummary}</p>
          </div>
        )}

        {/* Tips */}
        {message.extraTips && message.extraTips.length > 0 && (
          <div className="text-xs text-gray-400 space-y-1">
            {message.extraTips.map((tip, idx) => (
              <p key={idx}>💡 {tip}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState("57a8edc1-e661-463c-8bf3-7ca88c9ae2eb");
  const [isLoading, setIsLoading] = useState(false);
  const [currentPills, setCurrentPills] = useState<string[]>(INITIAL_SUGGESTIONS);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Send message
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setCurrentPills([]); // Hide pills while loading

    try {
      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          message: text.trim(),
          history,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const assistantMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: data.message,
          outfits: data.outfits,
          extraTips: data.extra_tips,
          brands: data.brands,
          packingList: data.packing_list,
          trendSummary: data.trend_summary,
          suggestionPills: data.suggestion_pills,
          intent: data.intent,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        
        // Update pills from response
        if (data.suggestion_pills && data.suggestion_pills.length > 0) {
          setCurrentPills(data.suggestion_pills);
        } else {
          setCurrentPills(["more outfits", "different style", "shopping ideas"]);
        }
      } else {
        const errorMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: `oops, something went wrong. try again?`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setCurrentPills(["try again", "different question"]);
      }
    } catch {
      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: `couldn't connect. check your internet?`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setCurrentPills(["try again"]);
    }

    setIsLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handlePillClick = (pill: string) => {
    sendMessage(pill);
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header - minimal */}
      <header className="flex-shrink-0 border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
              <span className="text-sm">✨</span>
            </div>
            <span className="font-medium text-gray-900">mymirro</span>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>
        </div>
        
        {/* Settings dropdown */}
        {showSettings && (
          <div className="border-t border-gray-100 bg-gray-50">
            <div className="max-w-3xl mx-auto px-4 py-3">
              <label className="block text-xs text-gray-500 mb-1">user id</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>
        )}
      </header>

      {/* Chat area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center mb-6">
                <span className="text-2xl">✨</span>
              </div>
              <h1 className="text-xl font-medium text-gray-900 mb-2">hey, i'm your stylist</h1>
              <p className="text-gray-500 text-sm text-center max-w-sm">
                tell me what you're dressing for and i'll help you look amazing
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="space-y-6">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            
            {isLoading && <ThinkingBubble />}
            
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      {/* Input area - ChatGPT style */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {/* Suggestion pills - above input */}
          {currentPills.length > 0 && !isLoading && (
            <div className="flex flex-wrap gap-2 mb-3">
              {currentPills.map((pill, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePillClick(pill)}
                  className="px-3 py-1.5 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-200 transition-colors"
                >
                  {pill}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="what are you dressing for?"
                disabled={isLoading}
                className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:bg-white disabled:opacity-50 transition-all"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </div>
          </form>

          {/* Footer text */}
          <p className="text-center text-xs text-gray-400 mt-3">
            mymirro uses ai to suggest outfits from your wardrobe
          </p>
        </div>
      </div>
    </div>
  );
}
