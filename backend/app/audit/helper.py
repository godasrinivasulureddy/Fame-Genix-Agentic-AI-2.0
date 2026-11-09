import json

from sqlalchemy.orm import Session

from app.audit.black_box import clinical_black_box
from app.db.models import AuditLog


def record_audit(
    db: Session,
    actor_id: str | None,
    actor_role: str | None,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    result: str = "SUCCESS",
    metadata: dict | None = None,
) -> None:
    entry = AuditLog(
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        target_type=target_type,
        target_id=target_id,
        result=result,
        metadata_json=json.dumps(metadata or {}),
    )
    db.add(entry)
    db.commit()

    # Mirror every platform audit action into the cryptographic black-box ledger
    # so the SHA-256 chain covers all clinical decisions (tamper-evident).
    try:
        clinical_black_box.record_event(
            event_type=action,
            actor_id=actor_id or "SYSTEM",
            actor_role=actor_role or "SYSTEM",
            patient_id=str(target_id or "GLOBAL"),
            event_data={
                "target_type": target_type,
                "target_id": target_id,
                "result": result,
                "metadata": metadata or {},
            },
            db=db,
        )
    except Exception:
        # Never let ledger recording break the primary audit-log write path.
        pass
