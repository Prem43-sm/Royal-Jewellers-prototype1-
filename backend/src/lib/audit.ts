import prisma from './prisma';

export interface AuditEntry {
  userId?: number | null;
  action: string;
  entity: string;
  recordId?: number | null;
  oldValue?: string | null;
  newValue?: string | null;
}

export async function logAudit(entry: AuditEntry) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        recordId: entry.recordId ?? null,
        oldValue: entry.oldValue ?? null,
        newValue: entry.newValue ?? null,
      },
    });
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}