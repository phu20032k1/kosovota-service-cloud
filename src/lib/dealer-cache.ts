import { prisma } from "@/lib/prisma";
import { getDealerCacheVersion } from "@/lib/redis";

export async function getDealerCacheFingerprint() {
  const [version, meta] = await Promise.all([
    getDealerCacheVersion(),
    prisma.dealer.aggregate({
      _count: true,
      _max: { updatedAt: true },
    }),
  ]);

  return `${version}:${meta._count}:${meta._max.updatedAt?.getTime() || 0}`;
}
