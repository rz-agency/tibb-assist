/**
 * Static weekly check-in question set.
 *
 * Pure data — no database access, no AI, no side effects (same pattern as
 * careMissionTemplates.js). Question and option ids are stable keys the
 * client maps to i18n copy (checkIn.questions.<id>.* in en.json / ur.json).
 *
 * SEVERITY TAGS ARE STATIC CONTENT PROPERTIES, NOT A RISK CALCULATION.
 * A tag only chooses which of two existing UI paths applies after a check-in:
 *   - NORMAL / MENTION_AT_VISIT → advisory copy only
 *   - ROUTE_TO_ASSESSMENT      → the answer's routingText is passed into the
 *     EXISTING AI extraction/assessment pipeline, whose deterministic
 *     riskAssessment.js — unchanged — decides GREEN/YELLOW/RED.
 */

const SEVERITY_TAGS = ['NORMAL', 'MENTION_AT_VISIT', 'ROUTE_TO_ASSESSMENT']

const WELLBEING = {
  id: 'wellbeing',
  options: [
    { id: 'wellbeing_good', tag: 'NORMAL' },
    { id: 'wellbeing_okay', tag: 'NORMAL' },
    { id: 'wellbeing_not_well', tag: 'MENTION_AT_VISIT' },
  ],
}

const NAUSEA_APPETITE = {
  id: 'nausea_appetite',
  options: [
    { id: 'nausea_eating_well', tag: 'NORMAL' },
    { id: 'nausea_some', tag: 'NORMAL' },
    { id: 'nausea_cannot_keep_food', tag: 'MENTION_AT_VISIT' },
  ],
}

const FATIGUE = {
  id: 'fatigue',
  options: [
    { id: 'fatigue_normal', tag: 'NORMAL' },
    { id: 'fatigue_more_tired', tag: 'MENTION_AT_VISIT' },
    { id: 'fatigue_exhausted', tag: 'MENTION_AT_VISIT' },
  ],
}

const SPOTTING_BLEEDING = {
  id: 'spotting_bleeding',
  options: [
    { id: 'spotting_none', tag: 'NORMAL' },
    { id: 'spotting_light', tag: 'MENTION_AT_VISIT' },
    {
      id: 'spotting_heavier',
      tag: 'ROUTE_TO_ASSESSMENT',
      routingText: 'I have had vaginal bleeding heavier than light spotting.',
    },
  ],
}

const SWELLING = {
  id: 'swelling',
  options: [
    { id: 'swelling_none', tag: 'NORMAL' },
    { id: 'swelling_mild_ankles', tag: 'NORMAL' },
    {
      id: 'swelling_face_hands',
      tag: 'ROUTE_TO_ASSESSMENT',
      routingText: 'I have swelling of my face and hands.',
    },
  ],
}

const HEADACHES = {
  id: 'headaches',
  options: [
    { id: 'headache_none', tag: 'NORMAL' },
    { id: 'headache_mild', tag: 'NORMAL' },
    {
      id: 'headache_severe',
      tag: 'ROUTE_TO_ASSESSMENT',
      routingText: 'I have a severe headache.',
    },
  ],
}

const BABY_MOVEMENT = {
  id: 'baby_movement',
  options: [
    { id: 'movement_as_usual', tag: 'NORMAL' },
    {
      id: 'movement_less',
      tag: 'ROUTE_TO_ASSESSMENT',
      routingText: 'My baby is moving less than usual.',
    },
    {
      id: 'movement_none_hours',
      tag: 'ROUTE_TO_ASSESSMENT',
      routingText: 'I have not felt my baby move in several hours.',
    },
  ],
}

const CONTRACTIONS = {
  id: 'contractions',
  options: [
    { id: 'contractions_none', tag: 'NORMAL' },
    { id: 'contractions_occasional', tag: 'NORMAL' },
    {
      id: 'contractions_regular',
      tag: 'ROUTE_TO_ASSESSMENT',
      routingText: 'I am having regular or painful contractions.',
    },
  ],
}

const VISION_CHANGES = {
  id: 'vision_changes',
  options: [
    { id: 'vision_none', tag: 'NORMAL' },
    { id: 'vision_slight_blurring', tag: 'MENTION_AT_VISIT' },
    {
      id: 'vision_blurred_flashes',
      tag: 'ROUTE_TO_ASSESSMENT',
      routingText: 'I have blurred vision or see flashing lights.',
    },
  ],
}

// ── Milestone additions (layered on top of the trimester set) ──────────────

const FIRST_MOVEMENT = {
  id: 'first_movement',
  options: [
    { id: 'first_movement_felt', tag: 'NORMAL' },
    { id: 'first_movement_not_yet', tag: 'NORMAL' },
    { id: 'first_movement_not_sure', tag: 'MENTION_AT_VISIT' },
  ],
}

const MOVEMENT_PATTERN = {
  id: 'movement_pattern',
  options: [
    { id: 'pattern_regular', tag: 'NORMAL' },
    { id: 'pattern_unclear', tag: 'MENTION_AT_VISIT' },
    {
      id: 'pattern_reduced',
      tag: 'ROUTE_TO_ASSESSMENT',
      routingText: 'My baby\u2019s movements are clearly reduced.',
    },
  ],
}

const BABY_POSITION = {
  id: 'baby_position',
  options: [
    { id: 'position_head_down', tag: 'NORMAL' },
    { id: 'position_unsure', tag: 'MENTION_AT_VISIT' },
    { id: 'position_breech_or_sideways', tag: 'MENTION_AT_VISIT' },
  ],
}

const CONTRACTION_FREQUENCY = {
  id: 'contraction_frequency',
  options: [
    { id: 'freq_none_yet', tag: 'NORMAL' },
    { id: 'freq_occasional', tag: 'NORMAL' },
    {
      id: 'freq_regular_10min',
      tag: 'ROUTE_TO_ASSESSMENT',
      routingText: 'I am having regular contractions about every 10 minutes.',
    },
  ],
}

/**
 * Build the check-in question set for a gestational week.
 *
 * Trimester boundaries (week < 14 → 1, < 28 → 2, else 3) mirror the
 * client-side dashboard calculation. Milestone questions are layered on top
 * of — never instead of — the trimester core set.
 *
 * @param {number} gestationalWeek
 * @returns {{ trimester: number, questions: Array, milestones: string[] }}
 */
function getCheckInQuestionSet(gestationalWeek) {
  const week = Number(gestationalWeek)
  const trimester = week < 14 ? 1 : week < 28 ? 2 : 3

  let questions
  if (trimester === 1) {
    questions = [WELLBEING, NAUSEA_APPETITE, FATIGUE, SPOTTING_BLEEDING]
  } else if (trimester === 2) {
    questions = [WELLBEING, SWELLING, HEADACHES, FATIGUE]
    if (week >= 18) {
      questions.push(BABY_MOVEMENT)
    }
  } else {
    questions = [WELLBEING, SWELLING, HEADACHES, BABY_MOVEMENT, CONTRACTIONS, VISION_CHANGES]
  }

  const milestones = []
  if (week >= 18 && week <= 20) {
    questions.push(FIRST_MOVEMENT)
    milestones.push('FIRST_MOVEMENT')
  }
  if (week >= 24 && week <= 25) {
    questions.push(MOVEMENT_PATTERN)
    milestones.push('VIABILITY')
  }
  if (week >= 36 && week <= 37) {
    questions.push(BABY_POSITION, CONTRACTION_FREQUENCY)
    milestones.push('TERM_PREP')
  }

  return { trimester, questions: questions.slice(), milestones }
}

module.exports = {
  SEVERITY_TAGS,
  getCheckInQuestionSet,
}
