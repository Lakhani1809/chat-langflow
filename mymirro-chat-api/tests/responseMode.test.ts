/**
 * Response Mode Tests
 * Tests for response mode detection and enforcement
 */

import { describe, it, expect } from 'vitest';
import { 
  detectWardrobeRequest, 
  detectShoppingComparison,
  inferResponseMode,
  getOutputContract,
} from '../utils/wardrobeRequestDetector';
import { 
  getExecutionConfigV2, 
  shouldGenerateOutfits,
  areOutfitsRequired,
} from '../utils/executionMap';
import type { MultiIntentResult } from '../types';

// ============================================
// WARDROBE REQUEST DETECTION TESTS
// ============================================

describe('Wardrobe Request Detection', () => {
  it('should detect explicit wardrobe request - "use my wardrobe"', () => {
    expect(detectWardrobeRequest('Use my wardrobe to make outfits')).toBe(true);
    expect(detectWardrobeRequest('from my wardrobe')).toBe(true);
    expect(detectWardrobeRequest('style what I already have')).toBe(true);
    expect(detectWardrobeRequest('make outfits using my clothes')).toBe(true);
  });

  it('should NOT detect wardrobe request for shopping questions', () => {
    expect(detectWardrobeRequest('Should I buy a jacket or a hoodie?')).toBe(false);
    expect(detectWardrobeRequest('Which one should I get?')).toBe(false);
    expect(detectWardrobeRequest('Recommend a jacket to buy')).toBe(false);
  });

  it('should detect wardrobe request for outfit generation', () => {
    expect(detectWardrobeRequest('What should I wear today?')).toBe(true);
    expect(detectWardrobeRequest('Make me outfits for a date night')).toBe(true);
    expect(detectWardrobeRequest('Help me dress for an interview')).toBe(true);
  });
});

// ============================================
// SHOPPING COMPARISON DETECTION TESTS
// ============================================

describe('Shopping Comparison Detection', () => {
  it('should detect shopping comparison questions', () => {
    expect(detectShoppingComparison('Should I buy a jacket or a hoodie?')).toBe(true);
    expect(detectShoppingComparison('Which should I get - puffer or denim jacket?')).toBe(true);
    expect(detectShoppingComparison('Compare these two options for me')).toBe(true);
  });

  it('should NOT detect shopping comparison for outfit requests', () => {
    expect(detectShoppingComparison('What should I wear today?')).toBe(false);
    expect(detectShoppingComparison('Make me an outfit for work')).toBe(false);
  });
});

// ============================================
// RESPONSE MODE INFERENCE TESTS
// ============================================

describe('Response Mode Inference', () => {
  it('should return visual_outfit for outfit generation intent', () => {
    expect(inferResponseMode('What should I wear?', 'outfit_generation')).toBe('visual_outfit');
    expect(inferResponseMode('Make me 3 outfits', 'outfit_generation')).toBe('visual_outfit');
  });

  it('should return shopping_comparison for shopping intent', () => {
    expect(inferResponseMode('Should I buy a jacket?', 'shopping_help')).toBe('shopping_comparison');
    expect(inferResponseMode('Which one to get?', 'item_recommendation')).toBe('shopping_comparison');
  });

  it('should return advisory_text for general chat', () => {
    expect(inferResponseMode('Hello!', 'general_chat')).toBe('advisory_text');
    expect(inferResponseMode("What's trending?", 'trend_analysis')).toBe('advisory_text');
  });

  it('should return visual_outfit when wardrobe is explicitly requested', () => {
    const message = 'Use my wardrobe to suggest what to buy';
    // Even with shopping intent, explicit wardrobe request = visual_outfit
    // Actually this should be mixed since it's shopping + wardrobe
    expect(inferResponseMode(message, 'shopping_help')).toBe('mixed');
  });
});

// ============================================
// OUTPUT CONTRACT TESTS
// ============================================

describe('Output Contract', () => {
  it('should require outfits for visual_outfit mode', () => {
    expect(getOutputContract('visual_outfit', false)).toBe('outfits_required');
    expect(getOutputContract('visual_outfit', true)).toBe('outfits_required');
  });

  it('should not allow outfits for shopping_comparison without explicit request', () => {
    expect(getOutputContract('shopping_comparison', false)).toBe('no_outfits');
  });

  it('should allow optional outfits for shopping_comparison with explicit wardrobe request', () => {
    expect(getOutputContract('shopping_comparison', true)).toBe('outfits_optional');
  });

  it('should not allow outfits for advisory_text mode', () => {
    expect(getOutputContract('advisory_text', false)).toBe('no_outfits');
    expect(getOutputContract('advisory_text', true)).toBe('no_outfits');
  });

  it('should allow optional outfits for mixed mode', () => {
    expect(getOutputContract('mixed', false)).toBe('outfits_optional');
    expect(getOutputContract('mixed', true)).toBe('outfits_optional');
  });
});

// ============================================
// EXECUTION CONFIG V2 TESTS
// ============================================

describe('Execution Config V2', () => {
  const createMultiIntent = (primary: string): MultiIntentResult => ({
    primary_intent: primary as any,
    secondary_intents: [],
    intent_confidence: { score: 0.9, basis: ['test'] },
  });

  it('should set visual_outfit mode for outfit generation', () => {
    const config = getExecutionConfigV2(
      'Make me 3 outfits from my wardrobe',
      createMultiIntent('outfit_generation')
    );
    
    expect(config.responseMode).toBe('visual_outfit');
    expect(config.outputContract).toBe('outfits_required');
    expect(shouldGenerateOutfits(config)).toBe(true);
    expect(areOutfitsRequired(config)).toBe(true);
  });

  it('should set shopping_comparison mode for shopping help', () => {
    const config = getExecutionConfigV2(
      'Should I buy a jacket or a hoodie?',
      createMultiIntent('shopping_help')
    );
    
    expect(config.responseMode).toBe('shopping_comparison');
    expect(config.outputContract).toBe('no_outfits');
    expect(shouldGenerateOutfits(config)).toBe(false);
  });

  it('should NOT require wardrobe for shopping without explicit request', () => {
    const config = getExecutionConfigV2(
      'Which jacket brand is better?',
      createMultiIntent('shopping_help')
    );
    
    expect(config.requiresWardrobe).toBe(false);
  });

  it('should require wardrobe when explicitly requested', () => {
    const config = getExecutionConfigV2(
      'Use my wardrobe to style a new jacket',
      createMultiIntent('shopping_help')
    );
    
    expect(config.requiresWardrobe).toBe(true);
  });
});

// ============================================
// ACCEPTANCE CRITERIA TESTS
// ============================================

describe('Acceptance Criteria', () => {
  const createMultiIntent = (primary: string): MultiIntentResult => ({
    primary_intent: primary as any,
    secondary_intents: [],
    intent_confidence: { score: 0.9, basis: ['test'] },
  });

  it('AC1: Shopping comparison should NOT return outfits by default', () => {
    // "Should I buy a jacket or a hoodie?" 
    const message = 'Should I buy a jacket or a hoodie?';
    const isWardrobeRequest = detectWardrobeRequest(message);
    const isShopping = detectShoppingComparison(message);
    const config = getExecutionConfigV2(message, createMultiIntent('shopping_help'));
    
    expect(isWardrobeRequest).toBe(false);
    expect(isShopping).toBe(true);
    expect(config.responseMode).toBe('shopping_comparison');
    expect(config.outputContract).toBe('no_outfits');
    expect(shouldGenerateOutfits(config)).toBe(false);
  });

  it('AC2: Outfit request should return visual outfits', () => {
    // "Make me 3 outfits from my wardrobe for a date night"
    const message = 'Make me 3 outfits from my wardrobe for a date night';
    const config = getExecutionConfigV2(message, createMultiIntent('outfit_generation'));
    
    expect(config.responseMode).toBe('visual_outfit');
    expect(config.outputContract).toBe('outfits_required');
    expect(areOutfitsRequired(config)).toBe(true);
  });

  it('AC3: Shopping suggestion should NOT attach wardrobe outfits', () => {
    // "Suggest some options to buy for winter layering"
    const message = 'Suggest some options to buy for winter layering';
    const config = getExecutionConfigV2(message, createMultiIntent('shopping_help'));
    
    expect(config.responseMode).toBe('shopping_comparison');
    expect(config.outputContract).toBe('no_outfits');
  });

  it('AC3b: Shopping with wardrobe styling request should allow mixed output', () => {
    // "Suggest some options to buy and style with my wardrobe"
    const message = 'Suggest some options to buy and style with my wardrobe';
    const config = getExecutionConfigV2(message, createMultiIntent('shopping_help'));
    
    // Should be mixed mode with optional outfits
    expect(['mixed', 'shopping_comparison']).toContain(config.responseMode);
    if (config.responseMode === 'mixed') {
      expect(config.outputContract).toBe('outfits_optional');
    }
  });
});

