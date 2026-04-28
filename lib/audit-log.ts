import { prisma } from "@/lib/prisma";

type AuditInput = {
  tenantId: string;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  detail?: string | null;
};

export async function logAudit(input: AuditInput) {
  let safeActorId: string | null = null;
  if (input.actorId) {
    const actor = await prisma.user.findUnique({
      where: { id: input.actorId },
      select: { id: true },
    });
    safeActorId = actor?.id ?? null;
  }

  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorId: safeActorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      detail: input.detail ?? null,
    },
  });
}
