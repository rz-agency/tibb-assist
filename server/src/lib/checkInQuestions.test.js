const test = require('node:test')
const assert = require('node:assert/strict')
const { getCheckInQuestionSet, SEVERITY_TAGS } = require('./checkInQuestions')

const ids = (set) => set.questions.map((q) => q.id)

// ─── Trimester 1 core ───────────────────────────────────────────

test('week 8 → trimester 1 core set: wellbeing, nausea/appetite, fatigue, spotting/bleeding', () => {
  const set = getCheckInQuestionSet(8)
  assert.equal(set.trimester, 1)
  assert.deepEqual(ids(set), ['wellbeing', 'nausea_appetite', 'fatigue', 'spotting_bleeding'])
  assert.deepEqual(set.milestones, [])
})

test('trimester boundaries match the dashboard rule (13→1, 14→2, 27→2, 28→3)', () => {
  assert.equal(getCheckInQuestionSet(13).trimester, 1)
  assert.equal(getCheckInQuestionSet(14).trimester, 2)
  assert.equal(getCheckInQuestionSet(27).trimester, 2)
  assert.equal(getCheckInQuestionSet(28).trimester, 3)
})

// ─── Trimester 2 core + week 18 movement boundary ────────────────

test('week 14 → trimester 2 core without baby movement yet', () => {
  const set = getCheckInQuestionSet(14)
  assert.deepEqual(ids(set), ['wellbeing', 'swelling', 'headaches', 'fatigue'])
})

test('week 17 → baby movement question still absent', () => {
  assert.equal(ids(getCheckInQuestionSet(17)).includes('baby_movement'), false)
})

test('week 18 boundary → baby movement appears and first-movement milestone layers on top of the full T2 core', () => {
  const set = getCheckInQuestionSet(18)
  assert.ok(ids(set).includes('baby_movement'))
  assert.ok(ids(set).includes('first_movement'))
  assert.deepEqual(set.milestones, ['FIRST_MOVEMENT'])
  // Milestone is layered ON TOP — the core set is not replaced.
  for (const coreId of ['wellbeing', 'swelling', 'headaches', 'fatigue']) {
    assert.ok(ids(set).includes(coreId), `${coreId} missing from week 18 set`)
  }
})

test('week 20 → first-movement milestone still present', () => {
  const set = getCheckInQuestionSet(20)
  assert.ok(ids(set).includes('first_movement'))
})

test('week 21 → first-movement milestone gone, core movement question remains', () => {
  const set = getCheckInQuestionSet(21)
  assert.equal(ids(set).includes('first_movement'), false)
  assert.ok(ids(set).includes('baby_movement'))
  assert.deepEqual(set.milestones, [])
})

// ─── Week ~24 viability milestone ────────────────────────────────

test('week 24 → movement-pattern milestone layered on T2 core', () => {
  const set = getCheckInQuestionSet(24)
  assert.ok(ids(set).includes('movement_pattern'))
  assert.deepEqual(set.milestones, ['VIABILITY'])
})

test('week 25 → movement-pattern milestone still present', () => {
  assert.ok(ids(getCheckInQuestionSet(25)).includes('movement_pattern'))
})

test('week 26 → movement-pattern milestone gone', () => {
  assert.equal(ids(getCheckInQuestionSet(26)).includes('movement_pattern'), false)
})

// ─── Trimester 3 core + term-prep milestone ──────────────────────

test('week 28 → trimester 3 core: no fatigue; movement, contractions, vision changes', () => {
  const set = getCheckInQuestionSet(28)
  assert.deepEqual(ids(set), ['wellbeing', 'swelling', 'headaches', 'baby_movement', 'contractions', 'vision_changes'])
})

test('weeks 36-37 → term-prep milestone (baby position + contraction frequency) layers on the full T3 core', () => {
  for (const week of [36, 37]) {
    const set = getCheckInQuestionSet(week)
    assert.ok(ids(set).includes('baby_position'), `baby_position missing at week ${week}`)
    assert.ok(ids(set).includes('contraction_frequency'), `contraction_frequency missing at week ${week}`)
    assert.deepEqual(set.milestones, ['TERM_PREP'])
    for (const coreId of ['wellbeing', 'swelling', 'headaches', 'baby_movement', 'contractions', 'vision_changes']) {
      assert.ok(ids(set).includes(coreId), `${coreId} missing from week ${week} set`)
    }
  }
})

test('week 38 → term-prep milestone gone', () => {
  const set = getCheckInQuestionSet(38)
  assert.equal(ids(set).includes('baby_position'), false)
  assert.equal(ids(set).includes('contraction_frequency'), false)
  assert.deepEqual(set.milestones, [])
})

// ─── Static content invariants ───────────────────────────────────

test('question and option ids are unique within every weekly set', () => {
  for (let week = 0; week <= 45; week++) {
    const set = getCheckInQuestionSet(week)
    const questionIds = ids(set)
    assert.equal(new Set(questionIds).size, questionIds.length, `duplicate question at week ${week}`)
    for (const question of set.questions) {
      const optionIds = question.options.map((option) => option.id)
      assert.equal(new Set(optionIds).size, optionIds.length, `duplicate option in ${question.id}`)
    }
  }
})

test('every option tag is one of the fixed severity tags', () => {
  for (let week = 0; week <= 45; week++) {
    const set = getCheckInQuestionSet(week)
    for (const question of set.questions) {
      for (const option of question.options) {
        assert.ok(SEVERITY_TAGS.includes(option.tag), `bad tag ${option.tag} on ${option.id}`)
      }
    }
  }
})

test('every ROUTE_TO_ASSESSMENT option carries routingText for the AI pipeline; no other option does', () => {
  for (let week = 0; week <= 45; week++) {
    const set = getCheckInQuestionSet(week)
    for (const question of set.questions) {
      for (const option of question.options) {
        if (option.tag === 'ROUTE_TO_ASSESSMENT') {
          assert.equal(typeof option.routingText, 'string', `${option.id} needs routingText`)
          assert.ok(option.routingText.length > 10, `${option.id} routingText too short`)
        } else {
          assert.equal(option.routingText, undefined, `${option.id} must not carry routingText`)
        }
      }
    }
  }
})

test('each set contains at least one ROUTE_TO_ASSESSMENT option somewhere in the trimester core', () => {
  for (const week of [8, 16, 22, 30, 40]) {
    const set = getCheckInQuestionSet(week)
    const hasRouteOption = set.questions.some((question) =>
      question.options.some((option) => option.tag === 'ROUTE_TO_ASSESSMENT'))
    assert.ok(hasRouteOption, `week ${week} set has no ROUTE_TO_ASSESSMENT option`)
  }
})
