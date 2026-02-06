interface AuditEvent {
  action: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
  sourceIp?: string;
  status: "success" | "failure";
  userId?: string;
}

export const logAuditEvent = (event: AuditEvent) => {
  const payload = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  console.info(`[AUDIT] ${JSON.stringify(payload)}`);
};
