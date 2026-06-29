import { processNotificationQueue } from "../src/lib/notifications/process";
import { prisma } from "../src/lib/prisma";

const limit = Number(process.argv[2] || 50);
processNotificationQueue(limit)
  .then((summary) => { console.log(JSON.stringify(summary, null, 2)); })
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
