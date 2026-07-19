import { prisma } from "@/lib/prisma";

export async function deleteUserAndTransferGroups(userId: string) {
  const ownedGroups = await prisma.group.findMany({
    where: { createdById: userId },
    select: { id: true }
  });

  for (const group of ownedGroups) {
    const nextOwner = await prisma.groupMember.findFirst({
      where: { groupId: group.id, userId: { not: userId } },
      orderBy: { joinedAt: "asc" },
      select: { id: true, userId: true }
    });

    if (nextOwner) {
      await prisma.$transaction([
        prisma.groupMember.update({ where: { id: nextOwner.id }, data: { role: "OWNER" } }),
        prisma.group.update({ where: { id: group.id }, data: { createdById: nextOwner.userId } })
      ]);
    }
  }

  await prisma.user.delete({ where: { id: userId } });
}
