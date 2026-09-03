 const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const womanEmail = 'demo.woman@tibbassist.local'
  const lhwEmail = 'sania@gmail.com'

  const womanPasswordHash = await bcrypt.hash('DemoPassword123!', 10)
  const lhwPasswordHash = await bcrypt.hash('DemoPassword123!', 10)

  const womanUser = await prisma.user.upsert({
    where: { email: womanEmail },
    update: {},
    create: {
      email: womanEmail,
      passwordHash: womanPasswordHash,
      role: 'WOMAN',
      isActive: true,
    },
  })

  const lhwUser = await prisma.user.upsert({
    where: { email: lhwEmail },
    update: {},
    create: {
      email: lhwEmail,
      passwordHash: lhwPasswordHash,
      role: 'LHW',
      isActive: true,
    },
  })

  const lhw = await prisma.lhw.upsert({
    where: { userId: lhwUser.id },
    update: {},
    create: {
      userId: lhwUser.id,
      fullName: 'Demo LHW Ayesha',
      phone: '+923001112233',
      region: 'PUNJAB',
    },
  })

  const patient = await prisma.patientProfile.upsert({
    where: { userId: womanUser.id },
    update: { assignedLhwId: lhw.id },
    create: {
      userId: womanUser.id,
      fullName: 'Demo Woman Sara',
      phone: '+923004445566',
      age: 28,
      villageOrArea: 'Demo Village',
      district: 'Rawalpindi',
      province: 'Punjab',
      assignedLhwId: lhw.id,
    },
  })

  const pregnancy = await prisma.pregnancy.upsert({
    where: { id: 1 },
    update: {},
    create: {
      patientId: patient.id,
      pregnancyStatus: 'ACTIVE',
      lmpDate: new Date('2026-02-10'),
      dueDate: new Date('2026-11-17'),
      gestationalWeek: 28,
      notes: 'Demo pregnancy record',
    },
  })

  const symptomHeavyBleeding = await prisma.symptom.upsert({
    where: { code: 'heavy_bleeding' },
    update: {},
    create: {
      code: 'heavy_bleeding',
      name: 'Heavy bleeding',
      category: 'warning_sign',
      isActive: true,
    },
  })

  const symptomHeadache = await prisma.symptom.upsert({
    where: { code: 'severe_headache' },
    update: {},
    create: {
      code: 'severe_headache',
      name: 'Severe headache',
      category: 'warning_sign',
      isActive: true,
    },
  })

  // --- New labor-related symptoms (added for Feature 2: LMP / gestational-age risk engine) ---

  const symptomContractions = await prisma.symptom.upsert({
    where: { code: 'contractions' },
    update: {},
    create: {
      code: 'contractions',
      name: 'Contractions',
      category: 'labor_sign',
      isActive: true,
    },
  })

  const symptomFluidLeak = await prisma.symptom.upsert({
    where: { code: 'fluid_leak' },
    update: {},
    create: {
      code: 'fluid_leak',
      name: 'Fluid leak / water breaking',
      category: 'labor_sign',
      isActive: true,
    },
  })

  const symptomAbdominalPain = await prisma.symptom.upsert({
    where: { code: 'severe_abdominal_pain' },
    update: {},
    create: {
      code: 'severe_abdominal_pain',
      name: 'Severe abdominal pain',
      category: 'labor_sign',
      isActive: true,
    },
  })

  const facility = await prisma.healthcareFacility.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Demo Rural Clinic',
      facilityType: 'CLINIC',
      address: 'Demo Street 12',
      city: 'Rawalpindi',
      latitude: 33.5651,
      longitude: 73.0169,
      phone: '+92515551234',
      isVerified: false,
    },
  })

  // ── Additional healthcare facilities across Pakistan ──────────────
  const extraFacilities = [
    { name: 'DHQ Hospital - Lahore', facilityType: 'HOSPITAL', city: 'Lahore', address: 'Hospital Road, Lahore', phone: '+924299211100', latitude: 31.5497, longitude: 74.3436 },
    { name: 'Civil Hospital - Karachi', facilityType: 'HOSPITAL', city: 'Karachi', address: 'Mission Road, Karachi', phone: '+922199215100', latitude: 24.8607, longitude: 67.0011 },
    { name: 'Rural Health Center - Multan', facilityType: 'HEALTH_CENTER', city: 'Multan', address: 'Rural Health Road, Multan', phone: '+92619201234', latitude: 30.1575, longitude: 71.5249 },
    { name: 'Basic Health Unit - Peshawar', facilityType: 'HEALTH_CENTER', city: 'Peshawar', address: 'University Road, Peshawar', phone: '+92919210234', latitude: 34.0151, longitude: 71.5249 },
    { name: 'Combined Military Hospital - Quetta', facilityType: 'HOSPITAL', city: 'Quetta', address: 'CMH Road, Quetta', phone: '+92819201234', latitude: 30.1798, longitude: 66.9750 },
  ]

  for (const f of extraFacilities) {
    const existing = await prisma.healthcareFacility.findFirst({ where: { name: f.name } })
    if (!existing) {
      await prisma.healthcareFacility.create({ data: { ...f, isVerified: true } })
    }
  }

  const emergencyContact = await prisma.emergencyContact.create({
    data: {
      patientId: patient.id,
      name: 'Demo Husband Ali',
      relationship: 'Husband',
      phoneNumber: '+923001234567',
      isPrimary: true,
    },
  })

  const assessment = await prisma.assessment.create({
    data: {
      patientId: patient.id,
      pregnancyId: pregnancy.id,
      assessedByUserId: womanUser.id,
      assessmentDate: new Date(),
      inputMethod: 'VISUAL',
      riskLevel: 'YELLOW',
      triageNotes: 'Demo assessment created for testing.',
      assessmentSymptoms: {
        create: [
          {
            symptomId: symptomHeavyBleeding.id,
            answerStatus: 'PRESENT',
            severity: 'MODERATE',
            notes: 'Demo symptom record',
          },
          {
            symptomId: symptomHeadache.id,
            answerStatus: 'PRESENT',
            severity: 'MILD',
            notes: 'Demo symptom record',
          },
        ],
      },
    },
  })

  await prisma.referral.create({
    data: {
      patientId: patient.id,
      assessmentId: assessment.id,
      facilityId: facility.id,
      status: 'RECOMMENDED',
      referralDate: new Date(),
      notes: 'Demo referral created for testing.',
    },
  })

  console.log('Demo data seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })