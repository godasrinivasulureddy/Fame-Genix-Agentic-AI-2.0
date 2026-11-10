import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.response import ok
from app.db.models import AuditLog, Role
from app.db.session import get_db

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


@router.get("/logs")
def list_logs(
    limit: int = 50,
    offset: int = 0,
    user=Depends(require_role(Role.SYSTEM_ADMIN)),
    db: Session = Depends(get_db)
):
    total = db.query(AuditLog).count()
    rows = db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(offset).limit(min(100, limit)).all()
    items = [{
        "id": r.id, "actor_id": r.actor_id, "actor_role": r.actor_role, "action": r.action,
        "target_type": r.target_type, "target_id": r.target_id, "result": r.result,
        "metadata": json.loads(r.metadata_json or "{}"), "created_at": r.created_at,
    } for r in rows]
    return ok({
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": (offset + len(items)) < total
    })


@router.get("/black-box/verify")
def verify_cryptographic_black_box(
    user=Depends(require_role(Role.SYSTEM_ADMIN))
):
    """Verifies cryptographic chain of custody & returns latest root hash."""
    from app.audit.black_box import clinical_black_box
    res = clinical_black_box.verify_chain_integrity()
    # Expose the chain tail so admin portals can visualize the SHA-256 ledger.
    res["chain"] = [b.model_dump() for b in clinical_black_box.chain[-20:]]
    return ok(res)
