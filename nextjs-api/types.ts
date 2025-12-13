// Type definitions for the chat API workflow

export type ChatRequest = {
  userId: string;
  message: string;
  conversationId?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type IntentResult = {
  intent:
    | "wardrobe_query"
    | "outfit_generation"
    | "color_analysis"
    | "body_type_advice"
    | "event_styling"
    | "shopping_request"
    | "general_chat";
};

export type WardrobeItem = {
  id: string | number;
  category: string;
  color?: string;
  fit?: string;
  style?: string;
  [key: string]: unknown;
};

export type WardrobeContext = {
  userId: string;
  body_type?: string;
  style_keywords?: string[];
  wardrobe_items: WardrobeItem[];
};

export type ColorAnalysis = {
  color_direction: string;
  combos: string[];
  reason: string;
};

export type SilhouetteAnalysis = {
  silhouette_verdict: string;
  structures: string[];
  notes: string;
};

export type BodyTypeAnalysis = {
  body_type: string;
  rules: string[];
  application: string;
};

export type ReasoningSummary = {
  summary: string;
  core_outfit_direction: string;
  key_color_approach: string;
  key_silhouette_rules: string[];
  key_body_type_adaptations: string[];
};

export type Outfit = {
  title: string;
  items: string[];
  why_it_works: string;
};

export type FinalStylistOutput = {
  message: string;
  outfits: Outfit[];
  extra_tips: string[];
};

export type ChatResponse = {
  intent: IntentResult["intent"];
  message: string;
  outfits?: Outfit[];
  extra_tips?: string[];
  debug?: {
    colorAnalysis?: ColorAnalysis;
    silhouetteAnalysis?: SilhouetteAnalysis;
    bodyTypeAnalysis?: BodyTypeAnalysis;
    reasoning?: ReasoningSummary;
  };
};


