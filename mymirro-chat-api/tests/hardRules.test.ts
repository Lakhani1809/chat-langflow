/**
 * Hard Rules Tests
 * Tests for deterministic outfit validation
 */

import { describe, it, expect } from 'vitest';
import { 
  evaluateOutfitHardRules, 
  isOutfitComplete, 
  getMissingSlots,
  DEFAULT_RULE_CONFIG,
} from '../rules/hardRules';
import type { OutfitDraft, RuleContext } from '../types';

// ============================================
// TEST HELPERS
// ============================================

function createOutfitDraft(overrides: Partial<OutfitDraft> = {}): OutfitDraft {
  return {
    id: 'test-outfit-1',
    title: 'Test Outfit',
    slots: {
      upper_wear: {
        hint: 'White cotton t-shirt',
        category: 'tops',
        formality: 'casual',
        silhouette: 'regular',
      },
      lower_wear: {
        hint: 'Blue denim jeans',
        category: 'bottoms',
        formality: 'casual',
        silhouette: 'regular',
      },
      footwear: {
        hint: 'White sneakers',
        category: 'footwear',
        subcategory: 'sneakers',
        formality: 'casual',
      },
    },
    why_it_works: 'Classic casual look',
    source: 'llm',
    ...overrides,
  };
}

function createRuleContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    responseMode: 'visual_outfit',
    hasWardrobeItems: true,
    ...overrides,
  };
}

// ============================================
// OUTFIT COMPLETENESS TESTS
// ============================================

describe('Outfit Completeness', () => {
  it('should pass with upper, lower, and footwear', () => {
    const outfit = createOutfitDraft();
    expect(isOutfitComplete(outfit)).toBe(true);
    expect(getMissingSlots(outfit)).toEqual([]);
  });

  it('should fail if missing footwear', () => {
    const outfit = createOutfitDraft({
      slots: {
        upper_wear: { hint: 'T-shirt', category: 'tops' },
        lower_wear: { hint: 'Jeans', category: 'bottoms' },
        // No footwear
      },
    });
    expect(isOutfitComplete(outfit)).toBe(false);
    expect(getMissingSlots(outfit)).toContain('footwear');
  });

  it('should fail if missing upper_wear', () => {
    const outfit = createOutfitDraft({
      slots: {
        lower_wear: { hint: 'Jeans', category: 'bottoms' },
        footwear: { hint: 'Sneakers', category: 'footwear' },
      },
    });
    expect(isOutfitComplete(outfit)).toBe(false);
    expect(getMissingSlots(outfit)).toContain('upper_wear');
  });

  it('should fail if missing lower_wear', () => {
    const outfit = createOutfitDraft({
      slots: {
        upper_wear: { hint: 'T-shirt', category: 'tops' },
        footwear: { hint: 'Sneakers', category: 'footwear' },
      },
    });
    expect(isOutfitComplete(outfit)).toBe(false);
    expect(getMissingSlots(outfit)).toContain('lower_wear');
  });

  it('should pass with dress + footwear (no lower_wear needed)', () => {
    const outfit = createOutfitDraft({
      slots: {
        upper_wear: { 
          hint: 'Black midi dress', 
          category: 'dresses',
        },
        footwear: { hint: 'Heels', category: 'footwear' },
      },
    });
    expect(isOutfitComplete(outfit)).toBe(true);
    expect(getMissingSlots(outfit)).toEqual([]);
  });

  it('should pass with jumpsuit + footwear', () => {
    const outfit = createOutfitDraft({
      slots: {
        upper_wear: { 
          hint: 'Navy jumpsuit', 
          category: 'tops', // Category might be wrong but hint has "jumpsuit"
        },
        footwear: { hint: 'Sandals', category: 'footwear' },
      },
    });
    expect(isOutfitComplete(outfit)).toBe(true);
  });
});

// ============================================
// FORMALITY COHERENCE TESTS
// ============================================

describe('Formality Coherence', () => {
  it('should block formal upper with flip-flops', () => {
    const outfit = createOutfitDraft({
      slots: {
        upper_wear: { 
          hint: 'Formal blazer', 
          category: 'tops',
          formality: 'formal',
        },
        lower_wear: { 
          hint: 'Dress pants', 
          category: 'bottoms',
          formality: 'formal',
        },
        footwear: { 
          hint: 'Flip-flops', 
          category: 'footwear',
          subcategory: 'flip-flops',
          formality: 'casual',
        },
      },
    });
    
    const result = evaluateOutfitHardRules(outfit, createRuleContext());
    
    expect(result.allowed).toBe(false);
    expect(result.violations.some(v => v.ruleId === 'formality_mismatch_footwear')).toBe(true);
  });

  it('should block smart upper with slides', () => {
    const outfit = createOutfitDraft({
      slots: {
        upper_wear: { 
          hint: 'Button-down shirt', 
          category: 'tops',
          formality: 'smart',
        },
        lower_wear: { 
          hint: 'Chinos', 
          category: 'bottoms',
          formality: 'smart',
        },
        footwear: { 
          hint: 'Slides', 
          category: 'footwear',
          subcategory: 'slides',
          formality: 'casual',
        },
      },
    });
    
    const result = evaluateOutfitHardRules(outfit, createRuleContext());
    
    expect(result.allowed).toBe(false);
    expect(result.violations.some(v => 
      v.ruleId === 'formality_mismatch_footwear' && v.severity === 'block'
    )).toBe(true);
  });

  it('should allow casual outfit with casual footwear', () => {
    const outfit = createOutfitDraft({
      slots: {
        upper_wear: { 
          hint: 'T-shirt', 
          category: 'tops',
          formality: 'casual',
        },
        lower_wear: { 
          hint: 'Shorts', 
          category: 'bottoms',
          formality: 'casual',
        },
        footwear: { 
          hint: 'Sneakers', 
          category: 'footwear',
          subcategory: 'sneakers',
          formality: 'casual',
        },
      },
    });
    
    const result = evaluateOutfitHardRules(outfit, createRuleContext());
    
    expect(result.allowed).toBe(true);
  });

  it('should block sports shorts for formal occasion', () => {
    const outfit = createOutfitDraft({
      slots: {
        upper_wear: { 
          hint: 'Dress shirt', 
          category: 'tops',
          formality: 'formal',
        },
        lower_wear: { 
          hint: 'Gym shorts', 
          category: 'bottoms',
          subcategory: 'gym-shorts',
          formality: 'casual',
        },
        footwear: { 
          hint: 'Dress shoes', 
          category: 'footwear',
          formality: 'formal',
        },
      },
    });
    
    const result = evaluateOutfitHardRules(
      outfit, 
      createRuleContext({ formality: 'formal' })
    );
    
    expect(result.allowed).toBe(false);
    expect(result.violations.some(v => v.ruleId === 'formality_occasion_mismatch')).toBe(true);
  });
});

// ============================================
// ETHNIC COHERENCE TESTS
// ============================================

describe('Ethnic Coherence', () => {
  it('should block ethnic upper with gym shorts', () => {
    const outfit = createOutfitDraft({
      slots: {
        upper_wear: { 
          hint: 'Traditional kurta', 
          category: 'ethnic',
        },
        lower_wear: { 
          hint: 'Gym shorts', 
          category: 'bottoms',
          subcategory: 'gym-shorts',
        },
        footwear: { 
          hint: 'Kolhapuris', 
          category: 'footwear',
        },
      },
    });
    
    const result = evaluateOutfitHardRules(outfit, createRuleContext());
    
    expect(result.allowed).toBe(false);
    expect(result.violations.some(v => v.ruleId === 'ethnic_coherence')).toBe(true);
  });

  it('should allow ethnic upper with appropriate bottoms', () => {
    const outfit = createOutfitDraft({
      slots: {
        upper_wear: { 
          hint: 'Kurta', 
          category: 'ethnic',
        },
        lower_wear: { 
          hint: 'White churidar', 
          category: 'bottoms',
        },
        footwear: { 
          hint: 'Mojaris', 
          category: 'footwear',
        },
      },
    });
    
    const result = evaluateOutfitHardRules(outfit, createRuleContext());
    
    expect(result.allowed).toBe(true);
    expect(result.violations.filter(v => v.ruleId === 'ethnic_coherence')).toHaveLength(0);
  });
});

// ============================================
// CLIMATE/SEASON TESTS
// ============================================

describe('Climate Sanity', () => {
  it('should warn about heavy puffer in hot climate', () => {
    const outfit = createOutfitDraft({
      slots: {
        upper_wear: { hint: 'T-shirt', category: 'tops' },
        lower_wear: { hint: 'Shorts', category: 'bottoms' },
        footwear: { hint: 'Sneakers', category: 'footwear' },
        layering: { 
          hint: 'Heavy puffer jacket', 
          category: 'outerwear',
          season: 'cold',
        },
      },
    });
    
    const result = evaluateOutfitHardRules(
      outfit, 
      createRuleContext({ climate: 'hot' })
    );
    
    // Should be allowed but with warning
    expect(result.allowed).toBe(true);
    expect(result.violations.some(v => 
      v.ruleId === 'climate_heavy_layering' && v.severity === 'warn'
    )).toBe(true);
    expect(result.scorePenalty).toBeGreaterThan(0);
  });

  it('should not warn about layering in cold climate', () => {
    const outfit = createOutfitDraft({
      slots: {
        upper_wear: { hint: 'Sweater', category: 'tops' },
        lower_wear: { hint: 'Jeans', category: 'bottoms' },
        footwear: { hint: 'Boots', category: 'footwear' },
        layering: { 
          hint: 'Puffer jacket', 
          category: 'outerwear',
          season: 'cold',
        },
      },
    });
    
    const result = evaluateOutfitHardRules(
      outfit, 
      createRuleContext({ climate: 'cold' })
    );
    
    expect(result.violations.filter(v => v.ruleId === 'climate_heavy_layering')).toHaveLength(0);
  });
});

// ============================================
// MANDATORY SLOTS BLOCKING TEST
// ============================================

describe('Mandatory Slots Blocking', () => {
  it('should block outfit missing mandatory slots', () => {
    const outfit = createOutfitDraft({
      slots: {
        upper_wear: { hint: 'T-shirt', category: 'tops' },
        // Missing lower_wear and footwear
      },
    });
    
    const result = evaluateOutfitHardRules(outfit, createRuleContext());
    
    expect(result.allowed).toBe(false);
    expect(result.violations.some(v => 
      v.ruleId === 'mandatory_slots' && v.severity === 'block'
    )).toBe(true);
  });
});

