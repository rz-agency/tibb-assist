const test = require('node:test')
const assert = require('node:assert/strict')
const { getContactData, isValidPhoneNumber } = require('../controllers/emergencyContactController')

// ── isValidPhoneNumber ──

test('accepts a standard Pakistani mobile number', () => {
  assert.equal(isValidPhoneNumber('+923001234567'), true)
})

test('accepts a local number without country code', () => {
  assert.equal(isValidPhoneNumber('03001234567'), true)
})

test('accepts a number with spaces and dashes', () => {
  assert.equal(isValidPhoneNumber('+92 300-123-4567'), true)
})

test('accepts a number with parentheses', () => {
  assert.equal(isValidPhoneNumber('(051) 5551234'), true)
})

test('rejects an empty string', () => {
  assert.equal(isValidPhoneNumber(''), false)
})

test('rejects a non-string value', () => {
  assert.equal(isValidPhoneNumber(12345), false)
})

test('rejects a string that is too short', () => {
  assert.equal(isValidPhoneNumber('12'), false)
})

test('rejects a string with letters', () => {
  assert.equal(isValidPhoneNumber('+92-CALL-NOW'), false)
})

// ── getContactData validation ──

test('returns data for valid input with all fields', () => {
  const result = getContactData({
    name: 'Ali Khan',
    relationship: 'Husband',
    phoneNumber: '+923001234567',
    isPrimary: true,
  })
  assert.deepEqual(result, {
    data: {
      name: 'Ali Khan',
      relationship: 'Husband',
      phoneNumber: '+923001234567',
      isPrimary: true,
    },
  })
})

test('defaults isPrimary to false when not provided', () => {
  const result = getContactData({
    name: 'Fatima',
    relationship: 'Mother',
    phoneNumber: '+923001234567',
  })
  assert.equal(result.data.isPrimary, false)
})

test('defaults isPrimary to false when explicitly set to non-true', () => {
  const result = getContactData({
    name: 'Fatima',
    relationship: 'Mother',
    phoneNumber: '+923001234567',
    isPrimary: 'yes',
  })
  assert.equal(result.data.isPrimary, false)
})

test('returns error when name is missing', () => {
  const result = getContactData({
    relationship: 'Husband',
    phoneNumber: '+923001234567',
  })
  assert.equal(result.error, 'name is required.')
})

test('returns error when name is whitespace-only', () => {
  const result = getContactData({
    name: '   ',
    relationship: 'Husband',
    phoneNumber: '+923001234567',
  })
  assert.equal(result.error, 'name is required.')
})

test('returns error when relationship is missing', () => {
  const result = getContactData({
    name: 'Ali Khan',
    phoneNumber: '+923001234567',
  })
  assert.equal(result.error, 'relationship is required.')
})

test('returns error when phoneNumber is missing', () => {
  const result = getContactData({
    name: 'Ali Khan',
    relationship: 'Husband',
  })
  assert.equal(result.error, 'phoneNumber is required.')
})

test('returns error when phoneNumber format is invalid', () => {
  const result = getContactData({
    name: 'Ali Khan',
    relationship: 'Husband',
    phoneNumber: 'CALL-NOW',
  })
  assert.equal(result.error, 'phoneNumber format is invalid.')
})

test('trims whitespace from name and relationship', () => {
  const result = getContactData({
    name: '  Ali Khan  ',
    relationship: '  Husband  ',
    phoneNumber: ' +923001234567 ',
  })
  assert.equal(result.data.name, 'Ali Khan')
  assert.equal(result.data.relationship, 'Husband')
  assert.equal(result.data.phoneNumber, '+923001234567')
})
