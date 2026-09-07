const prisma = require('../lib/prisma')

// Same active-mission definition as profileController.js.
const activeCareMissionStatuses = ['OPEN', 'IN_PROGRESS', 'ESCALATED']

function handleDatabaseError(error, res) {
  if (error.code === 'P2002') {
    return res.status(409).json({ error: 'A duplicate record was submitted.' })
  }
  if (error.code === 'P2025') {
    return res.status(404).json({ error: 'A related record was not found.' })
  }
  console.error(error)
  return res.status(500).json({ error: 'A database error occurred.' })
}

/**
 * Computes workload stats for a single LHW — same query shape as
 * profileController.getLhwStats, extracted here so the admin overview
 * can reuse it across every LHW without duplicating the logic.
 */
async function computeLhwStats(lhwId) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const patientFilter = { assignedLhwId: lhwId }

  const [
    assignedPatients,
    openRedCareMissions,
    overdueFollowUps,
    homeVisitsThisMonth,
    referralsClosedThisMonth,
  ] = await Promise.all([
    prisma.patientProfile.count({ where: patientFilter }),
    prisma.careMission.count({
      where: {
        riskLevel: 'RED',
        status: { in: activeCareMissionStatuses },
        assessment: { patient: patientFilter },
      },
    }),
    prisma.followUp.count({
      where: { lhwId, status: 'PENDING', dueDate: { lt: todayStart } },
    }),
    prisma.homeVisit.count({
      where: { lhwId, visitDate: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.referralStatusHistory.count({
      where: {
        toStatus: 'CLOSED',
        createdAt: { gte: monthStart, lt: monthEnd },
        referral: { patient: patientFilter },
      },
    }),
  ])

  return {
    assignedPatients,
    openRedCareMissions,
    overdueFollowUps,
    homeVisitsThisMonth,
    referralsClosedThisMonth,
  }
}

// ── GET /api/admin/lhw-overview ───────────────────────────────────────────

async function getLhwOverview(req, res) {
  try {
    const lhws = await prisma.lhw.findMany({
      select: {
        id: true,
        userId: true,
        fullName: true,
        phone: true,
        region: true,
        createdAt: true,
        user: { select: { email: true, isActive: true } },
      },
      orderBy: { fullName: 'asc' },
    })

    const overview = await Promise.all(
      lhws.map(async (lhw) => {
        const stats = await computeLhwStats(lhw.id)
        return {
          lhwId: lhw.id,
          userId: lhw.userId,
          fullName: lhw.fullName,
          phone: lhw.phone,
          region: lhw.region,
          email: lhw.user.email,
          isActive: lhw.user.isActive,
          createdAt: lhw.createdAt,
          ...stats,
        }
      }),
    )

    return res.json({ lhws: overview })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

// ── GET /api/admin/monthly-report/:userId ──────────────────────────────────
//
// Detailed monthly data for a single LHW's print-friendly report.
// Reuses the same aggregate counts as getLhwStats and adds the actual
// records (visits, assessments, referrals, follow-ups) for the month.

async function getMonthlyReport(req, res) {
  const userId = parseInt(req.params.userId, 10)
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'userId must be a positive integer.' })
  }

  try {
    const lhw = await prisma.lhw.findUnique({
      where: { userId },
      select: { id: true, fullName: true, phone: true, region: true },
    })

    if (!lhw) return res.status(404).json({ error: 'LHW profile not found.' })

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const patientFilter = { assignedLhwId: lhw.id }

    // Run all queries in parallel.
    const [
      stats,
      homeVisits,
      assessments,
      referrals,
      completedFollowUps,
    ] = await Promise.all([
      computeLhwStats(lhw.id),
      prisma.homeVisit.findMany({
        where: { lhwId: lhw.id, visitDate: { gte: monthStart, lt: monthEnd } },
        select: {
          id: true,
          visitDate: true,
          visitType: true,
          patient: { select: { id: true, fullName: true } },
        },
        orderBy: { visitDate: 'desc' },
      }),
      prisma.assessment.findMany({
        where: {
          assessmentDate: { gte: monthStart, lt: monthEnd },
          patient: patientFilter,
        },
        select: {
          id: true,
          assessmentDate: true,
          riskLevel: true,
          resultCode: true,
          patient: { select: { id: true, fullName: true } },
        },
        orderBy: { assessmentDate: 'desc' },
      }),
      prisma.referral.findMany({
        where: {
          referralDate: { gte: monthStart, lt: monthEnd },
          patient: patientFilter,
        },
        select: {
          id: true,
          referralDate: true,
          status: true,
          facility: { select: { id: true, name: true, city: true } },
          patient: { select: { id: true, fullName: true } },
        },
        orderBy: { referralDate: 'desc' },
      }),
      prisma.followUp.findMany({
        where: {
          lhwId: lhw.id,
          status: 'COMPLETED',
          completedAt: { gte: monthStart, lt: monthEnd },
        },
        select: {
          id: true,
          type: true,
          dueDate: true,
          completedAt: true,
          patient: { select: { id: true, fullName: true } },
        },
        orderBy: { completedAt: 'desc' },
      }),
    ])

    const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' })

    return res.json({
      lhw: {
        id: lhw.id,
        fullName: lhw.fullName,
        phone: lhw.phone,
        region: lhw.region,
      },
      month: monthLabel,
      monthStart: monthStart.toISOString().slice(0, 10),
      stats,
      homeVisits,
      assessments,
      referrals,
      completedFollowUps,
    })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

module.exports = {
  getLhwOverview,
  getMonthlyReport,
  computeLhwStats,
}
