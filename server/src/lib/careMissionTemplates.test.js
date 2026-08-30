const test = require('node:test')
const assert = require('node:assert/strict')
const {
  YELLOW_CHECKLIST,
  RED_CHECKLIST,
  getChecklistForRiskLevel,
} = require('./careMissionTemplates')

// ---------- Static checklist constants ----------

test('YELLOW_CHECKLIST has exactly 3 items', () => {
  assert.equal(YELLOW_CHECKLIST.length, 3)
})

test('YELLOW_CHECKLIST items are in correct order', () => {
  assert.equal(YELLOW_CHECKLIST[0].taskKey, 'YELLOW_CONTACT_HEALTHCARE_PROVIDER')
  assert.equal(YELLOW_CHECKLIST[1].taskKey, 'YELLOW_CONFIRM_TRANSPORT_PLAN')
  assert.equal(YELLOW_CHECKLIST[2].taskKey, 'YELLOW_SCHEDULE_FOLLOW_UP')
})

test('YELLOW_CHECKLIST sortOrder is 1, 2, 3', () => {
  assert.deepEqual(
    YELLOW_CHECKLIST.map((item) => item.sortOrder),
    [1, 2, 3],
  )
})

test('RED_CHECKLIST has exactly 4 items', () => {
  assert.equal(RED_CHECKLIST.length, 4)
})

test('RED_CHECKLIST items are in correct order', () => {
  assert.equal(RED_CHECKLIST[0].taskKey, 'RED_IMMEDIATE_FACILITY_CONTACT')
  assert.equal(RED_CHECKLIST[1].taskKey, 'RED_ARRANGE_EMERGENCY_TRANSPORT')
  assert.equal(RED_CHECKLIST[2].taskKey, 'RED_NOTIFY_EMERGENCY_CONTACT')
  assert.equal(RED_CHECKLIST[3].taskKey, 'RED_CONFIRM_LHW_FOLLOW_UP')
})

test('RED_CHECKLIST sortOrder is 1, 2, 3, 4', () => {
  assert.deepEqual(
    RED_CHECKLIST.map((item) => item.sortOrder),
    [1, 2, 3, 4],
  )
})

test('every checklist item has taskKey, taskLabel, and sortOrder', () => {
  for (const item of [...YELLOW_CHECKLIST, ...RED_CHECKLIST]) {
    assert.ok(typeof item.taskKey === 'string' && item.taskKey.length > 0)
    assert.ok(typeof item.taskLabel === 'string' && item.taskLabel.length > 0)
    assert.ok(typeof item.sortOrder === 'number')
  }
})

// ---------- getChecklistForRiskLevel ----------

test('getChecklistForRiskLevel returns YELLOW checklist for YELLOW', () => {
  const result = getChecklistForRiskLevel('YELLOW')
  assert.equal(result.length, 3)
  assert.equal(result[0].taskKey, 'YELLOW_CONTACT_HEALTHCARE_PROVIDER')
})

test('getChecklistForRiskLevel returns RED checklist for RED', () => {
  const result = getChecklistForRiskLevel('RED')
  assert.equal(result.length, 4)
  assert.equal(result[0].taskKey, 'RED_IMMEDIATE_FACILITY_CONTACT')
})

test('getChecklistForRiskLevel returns empty array for GREEN', () => {
  assert.deepEqual(getChecklistForRiskLevel('GREEN'), [])
})

test('getChecklistForRiskLevel returns empty array for unknown level', () => {
  assert.deepEqual(getChecklistForRiskLevel('PURPLE'), [])
})

test('getChecklistForRiskLevel returns a copy, not the original', () => {
  const a = getChecklistForRiskLevel('YELLOW')
  const b = getChecklistForRiskLevel('YELLOW')
  assert.notEqual(a, b)
  a.push({ taskKey: 'MUTATION' })
  assert.equal(getChecklistForRiskLevel('YELLOW').length, 3)
})
