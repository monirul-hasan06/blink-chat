import { prisma } from "@/lib/prisma";

export function directScopeKey(firstUserId: string, secondUserId: string) {
  return `direct:${[firstUserId, secondUserId].sort().join(":")}`;
}

export function groupScopeKey(groupId: string) {
  return `group:${groupId}`;
}

export async function getBlockState(firstUserId: string, secondUserId: string) {
  const blocks = await prisma.block.findMany({
    where: {
      OR: [
        { blockerId: firstUserId, blockedId: secondUserId },
        { blockerId: secondUserId, blockedId: firstUserId }
      ]
    },
    select: { blockerId: true }
  });

  return {
    blockedByMe: blocks.some((block: { blockerId: string }) => block.blockerId === firstUserId),
    blockedMe: blocks.some((block: { blockerId: string }) => block.blockerId === secondUserId),
    blocked: blocks.length > 0
  };
}

export async function markGroupMessagesSeen(groupId: string, userId: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await prisma.groupMessageReceipt.updateMany({
    where: {
      userId,
      seenAt: null,
      message: { groupId }
    },
    data: { seenAt: now }
  });

  const candidates = await prisma.groupMessage.findMany({
    where: {
      groupId,
      expiresAt: null,
      receipts: { every: { seenAt: { not: null } } }
    },
    select: { id: true }
  });

  if (candidates.length > 0) {
    await prisma.groupMessage.updateMany({
      where: { id: { in: candidates.map((message: { id: string }) => message.id) } },
      data: { expiresAt }
    });
  }
}
