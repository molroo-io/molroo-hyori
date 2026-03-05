/**
 * Emotion Controller — Maps molroo SDK emotion data to Live2D expression commands.
 *
 * Three-layer approach:
 * 1. discrete_emotion.primary → expression name (most reliable)
 * 2. VAD coordinates → expression name (fallback)
 * 3. emotion intensity + body_budget → weight modulation
 */

import type { AgentResponse } from '@molroo-io/sdk'
import type { Live2DController } from '../../hooks/useLive2D'
import { vadToExpression } from './vad-expression'

/**
 * molroo-core discrete emotion labels → Hyori expression names.
 * Core labels (19): 8 positive, 7 negative, 4 neutral/mixed.
 */
const DISCRETE_TO_EXPRESSION: Record<string, string> = {
  joy: 'cheerful',
  excitement: 'excited',
  contentment: 'smile',
  love: 'blushing',
  pride: 'smug',
  gratitude: 'smile',
  amusement: 'laugh',
  relief: 'relaxed',
  anger: 'angry',
  fear: 'fear',
  sadness: 'sad',
  anxiety: 'frustrated',
  surprise: 'surprised',
  disgust: 'disgust',
  trust: 'smile',
  calm: 'relaxed',
  shame: 'shy',
  guilt: 'sad',
  numbness: 'sleepy',
}

/** Map numeric intensity to a weight range */
function intensityToWeight(intensity: number): number {
  if (intensity > 0.7) return 0.85
  if (intensity > 0.4) return 0.6
  return 0.35
}

/** Modulate expression weight by body_budget (fatigue reduces expression vividness) */
function modulateByBudget(weight: number, bodyBudget: number): number {
  // body_budget [0.05, 1.0] — low budget dampens expression
  if (bodyBudget > 0.5) return weight
  // Linear dampening: budget 0.5 → 1x, budget 0.05 → 0.6x
  const factor = 0.6 + (bodyBudget / 0.5) * 0.4
  return weight * factor
}

/** Emotion → reaction motion group for visual emphasis */
const EMOTION_TO_MOTION: Record<string, { group: string; index: number }> = {
  surprise: { group: 'Flick', index: 0 },
  excitement: { group: 'FlickUp', index: 0 },
  love: { group: 'FlickUp', index: 0 },
  amusement: { group: 'Flick', index: 0 },
  anger: { group: 'FlickDown', index: 0 },
  disgust: { group: 'FlickDown', index: 0 },
  fear: { group: 'FlickUp', index: 0 },
  sadness: { group: 'FlickDown', index: 0 },
  shame: { group: 'FlickDown', index: 0 },
}

export interface EmotionCommand {
  expression: string
  weight: number
  /** Apply sleepy overlay when body_budget is very low */
  fatigueOverlay: number
  /** Reaction motion to play on emotion change */
  motion?: { group: string; index: number }
}

/**
 * Resolve the best expression + weight from an AgentResponse.
 *
 * Priority:
 * 1. discrete_emotion.primary → direct name mapping + intensity weight
 * 2. VAD → vad-expression.ts range mapping (fallback)
 * 3. null if emotion is too neutral
 */
export function resolveExpression(
  discrete: { primary: string; intensity: number },
  vad: { V: number; A: number; D: number },
  bodyBudget: number,
): EmotionCommand | null {
  let expressionName: string | null = null
  let weight: number

  // 1. Discrete emotion mapping (primary)
  const mapped = DISCRETE_TO_EXPRESSION[discrete.primary]
  if (mapped) {
    expressionName = mapped
    weight = intensityToWeight(discrete.intensity)
  } else {
    // 2. VAD fallback
    const vadResult = vadToExpression(vad)
    if (vadResult) {
      expressionName = vadResult.name
      weight = vadResult.weight
    } else {
      // Too neutral — clear expression
      return null
    }
  }

  // Blend intensity into weight (intensity reflects distance from baseline)
  weight = weight * (0.5 + discrete.intensity * 0.5)

  // Modulate by body_budget
  weight = modulateByBudget(weight, bodyBudget)

  // Clamp final weight
  weight = Math.min(1, Math.max(0.15, weight))

  // Fatigue overlay: very low body_budget adds sleepy layer
  const fatigueOverlay = bodyBudget < 0.3
    ? (0.3 - bodyBudget) / 0.25 * 0.4  // 0 at 0.3, 0.4 at 0.05
    : 0

  return { expression: expressionName, weight, fatigueOverlay }
}

/**
 * Apply an AgentResponse to a Live2D controller.
 * Call this after each SDK chat() to update the character's expression + trigger motion.
 *
 * @param prevEmotion - Previous primary emotion for change detection (caller tracks this)
 */
export function applyEmotionToLive2D(
  controller: Live2DController,
  response: AgentResponse,
  prevEmotion?: string | null,
): void {
  const { emotion } = response
  const primary = emotion.discrete.primary
  const cmd = resolveExpression(
    emotion.discrete,
    emotion.vad,
    0.7, // Default body budget — PersonaState doesn't directly expose it
  )

  if (cmd) {
    controller.setExpression(cmd.expression, cmd.weight)
  } else {
    controller.clearExpression()
  }

  // Play reaction motion on emotion change
  if (prevEmotion && prevEmotion !== primary) {
    const motion = EMOTION_TO_MOTION[primary]
    if (motion) {
      controller.playMotion(motion.group, motion.index)
    }
  }
}
