const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  buildNearbyFacilityData,
  resolveNearbyFacility,
  mapCategoryToFacilityType,
  phonesMatch,
  coordinatesMatch,
} = require('./nearbyFacilityResolver')

// ── mapCategoryToFacilityType ───────────────────────────────────────────────

describe('mapCategoryToFacilityType', () => {
  it('maps OSM categories onto FacilityType enum values', () => {
    assert.equal(mapCategoryToFacilityType('hospital'), 'HOSPITAL')
    assert.equal(mapCategoryToFacilityType('clinic'), 'CLINIC')
    assert.equal(mapCategoryToFacilityType('doctors'), 'CLINIC')
    assert.equal(mapCategoryToFacilityType('pharmacy'), 'OTHER')
  })

  it('is case-insensitive and trims whitespace', () => {
    assert.equal(mapCategoryToFacilityType(' Hospital '), 'HOSPITAL')
    assert.equal(mapCategoryToFacilityType('CLINIC'), 'CLINIC')
  })

  it('falls back to OTHER for unknown or missing categories', () => {
    assert.equal(mapCategoryToFacilityType('school'), 'OTHER')
    assert.equal(mapCategoryToFacilityType(null), 'OTHER')
    assert.equal(mapCategoryToFacilityType(undefined), 'OTHER')
    assert.equal(mapCategoryToFacilityType(42), 'OTHER')
  })
})

// ── buildNearbyFacilityData ─────────────────────────────────────────────────

describe('buildNearbyFacilityData', () => {
  it('normalises a Nearby Help (OSM) payload with lat/lng keys', () => {
    const result = buildNearbyFacilityData({
      name: '  Aga Khan University Hospital  ',
      address: ' Stadium Road, Karachi ',
      phone: '+92 21 111 911 911',
      lat: 24.8918,
      lng: 67.0742,
      category: 'hospital',
      isOpenNow: null, // extra OSM field must be dropped
    })

    assert.deepEqual(result.data, {
      name: 'Aga Khan University Hospital',
      facilityType: 'HOSPITAL',
      address: 'Stadium Road, Karachi',
      city: null,
      latitude: 24.8918,
      longitude: 67.0742,
      phone: '+92 21 111 911 911',
    })
  })

  it('accepts latitude/longitude key spellings too', () => {
    const result = buildNearbyFacilityData({
      name: 'Clinic',
      latitude: '31.5497',
      longitude: '74.3436',
    })
    assert.equal(result.data.latitude, 31.5497)
    assert.equal(result.data.longitude, 74.3436)
  })

  it('rejects a payload without a name', () => {
    assert.ok(buildNearbyFacilityData({ phone: '+9221' }).error)
    assert.ok(buildNearbyFacilityData({ name: '   ' }).error)
    assert.ok(buildNearbyFacilityData(null).error)
    assert.ok(buildNearbyFacilityData('Aga Khan').error)
    assert.ok(buildNearbyFacilityData([{ name: 'Aga Khan' }]).error)
  })

  it('nulls out missing optional fields instead of storing undefined', () => {
    const result = buildNearbyFacilityData({ name: 'Unnamed facility', lat: 24.86, lng: 67.0 })
    assert.equal(result.data.address, null)
    assert.equal(result.data.phone, null)
    assert.equal(result.data.city, null)
  })

  it('rejects out-of-range or non-numeric coordinates to null', () => {
    const result = buildNearbyFacilityData({ name: 'X', lat: 999, lng: 'not-a-number' })
    assert.equal(result.data.latitude, null)
    assert.equal(result.data.longitude, null)
  })

  it('truncates over-long strings to the column limits', () => {
    const long = 'A'.repeat(400)
    const result = buildNearbyFacilityData({ name: long, address: long, phone: long })
    assert.equal(result.data.name.length, 255)
    assert.equal(result.data.address.length, 255)
    assert.equal(result.data.phone.length, 30)
  })
})

// ── phonesMatch / coordinatesMatch ──────────────────────────────────────────

describe('phonesMatch', () => {
  it('matches phones regardless of formatting characters', () => {
    assert.equal(phonesMatch('+92 21 992 15100', '00922199215100'), true)
    assert.equal(phonesMatch('+922199215100', '(+92) 21-99215100'), true)
  })

  it('does not match different or missing phones', () => {
    assert.equal(phonesMatch('+922199215100', '+924299211100'), false)
    assert.equal(phonesMatch(null, '+922199215100'), false)
    assert.equal(phonesMatch('', ''), false)
  })
})

describe('coordinatesMatch', () => {
  it('matches coordinates within ~100 m', () => {
    // ~11 m apart at this latitude
    assert.equal(coordinatesMatch(24.8607, 67.0011, 24.8608, 67.0011), true)
  })

  it('does not match coordinates far apart', () => {
    // Karachi vs Lahore — hundreds of km apart
    assert.equal(coordinatesMatch(24.8607, 67.0011, 31.5497, 74.3436), false)
  })

  it('returns false when either side lacks coordinates', () => {
    assert.equal(coordinatesMatch(null, null, 24.8607, 67.0011), false)
    assert.equal(coordinatesMatch(24.8607, 67.0011, null, null), false)
  })
})

// ── resolveNearbyFacility (find-or-create with stubbed prisma) ──────────────

function makeStubPrisma({ candidates = [], created = { id: 99 } } = {}) {
  const calls = { findMany: [], create: [] }
  return {
    calls,
    healthcareFacility: {
      findMany: async (args) => {
        calls.findMany.push(args)
        return candidates
      },
      create: async (args) => {
        calls.create.push(args)
        return created
      },
    },
  }
}

describe('resolveNearbyFacility', () => {
  const data = {
    name: 'Aga Khan University Hospital',
    facilityType: 'HOSPITAL',
    address: 'Stadium Road, Karachi',
    city: null,
    latitude: 24.8918,
    longitude: 67.0742,
    phone: '+92 21 111 911 911',
  }

  it('creates an unverified facility when no same-named row exists', async () => {
    const prisma = makeStubPrisma({ candidates: [] })
    const facility = await resolveNearbyFacility(prisma, data)

    assert.equal(facility.id, 99)
    assert.equal(prisma.calls.create.length, 1)
    assert.equal(prisma.calls.create[0].data.isVerified, false)
    assert.equal(prisma.calls.create[0].data.name, data.name)
  })

  it('reuses an existing row whose phone matches', async () => {
    const prisma = makeStubPrisma({
      candidates: [{ id: 7, phone: '009221111911911', latitude: null, longitude: null }],
    })
    const facility = await resolveNearbyFacility(prisma, data)

    assert.equal(facility.id, 7)
    assert.equal(prisma.calls.create.length, 0)
  })

  it('reuses an existing row whose coordinates are within 100 m', async () => {
    const prisma = makeStubPrisma({
      candidates: [{ id: 8, phone: '+92515551234', latitude: 24.8918, longitude: 67.0742 }],
    })
    const facility = await resolveNearbyFacility(prisma, data)

    assert.equal(facility.id, 8)
    assert.equal(prisma.calls.create.length, 0)
  })

  it('creates a new row when a same-named facility is clearly a different place', async () => {
    const prisma = makeStubPrisma({
      candidates: [{ id: 9, phone: '+924299211100', latitude: 31.5497, longitude: 74.3436 }],
    })
    const facility = await resolveNearbyFacility(prisma, data)

    assert.equal(facility.id, 99)
    assert.equal(prisma.calls.create.length, 1)
  })

  it('looks candidates up by name', async () => {
    const prisma = makeStubPrisma()
    await resolveNearbyFacility(prisma, data)
    assert.deepEqual(prisma.calls.findMany[0].where, { name: data.name })
  })
})
