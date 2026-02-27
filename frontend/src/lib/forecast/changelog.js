export function makeChange({
  actor = "Neo",
  program,
  action,
  entityType,
  entityId,
  entityName,
  field,
  from,
  to,
  meta,
}) {
  return {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    actor,
    program,
    action,
    entityType,
    entityId,
    entityName,
    field,
    from,
    to,
    meta: meta ?? {},
  };
}