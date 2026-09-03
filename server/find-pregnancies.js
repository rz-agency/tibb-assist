const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pregnancies = await prisma.pregnancy.findMany({
    where: { pregnancyStatus: 'ACTIVE' },
    include: { patient: { include: { user: true } } }
  });
  pregnancies.forEach(p => {
    console.log(`id: ${p.id}, LMP: ${p.lmpDate}, status: ${p.pregnancyStatus}, user: ${p.patient?.user?.email}`);
  });
  await prisma.$disconnect();
}

main();