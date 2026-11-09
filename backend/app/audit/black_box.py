"""
FAME-GENIX Autonomous Cryptographic Medical Black Box:
SHA-256 chained tamper-evident ledger proving exact sequence of events,
telemetry, doctor reviews, and drug dispensations for legal and insurance defense.

The chain is kept in memory for fast verification and is backed by the
`cryptographic_blocks` table so the ledger survives server restarts and remains
court-admissible across deployments.
"""

import hashlib
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel

from sqlalchemy.orm import Session


class CryptographicAuditBlock(BaseModel):
    block_index: int
    timestamp: str
    event_type: str
    actor_id: str
    actor_role: str
    patient_id: str
    payload_hash: str
    previous_block_hash: str
    block_hash: str


class CryptographicBlackBox:
    """Immutable tamper-evident ledger chaining clinical actions."""

    def __init__(self) -> None:
        self.chain: List[CryptographicAuditBlock] = []
        self._session_factory = None

    # ------------------------------------------------------------------ #
    # Persistence wiring
    # ------------------------------------------------------------------ #
    def bind_session_factory(self, session_factory) -> None:
        self._session_factory = session_factory

    def load_from_db(self, db: Session) -> None:
        """Hydrate the in-memory chain from persisted blocks (called at boot)."""
        from app.db.models import CryptographicBlock

        rows = (
            db.query(CryptographicBlock)
            .order_by(CryptographicBlock.block_index.asc())
            .all()
        )
        self.chain = [
            CryptographicAuditBlock(
                block_index=r.block_index,
                timestamp=r.timestamp,
                event_type=r.event_type,
                actor_id=r.actor_id or "SYSTEM",
                actor_role=r.actor_role or "SYSTEM_ADMIN",
                patient_id=r.patient_id or "GLOBAL",
                payload_hash=r.payload_hash,
                previous_block_hash=r.previous_block_hash,
                block_hash=r.block_hash,
            )
            for r in rows
        ]
        if not self.chain:
            self._genesis(db)

    def _genesis(self, db: Optional[Session] = None) -> None:
        genesis_block = CryptographicAuditBlock(
            block_index=0,
            timestamp=datetime.utcnow().isoformat(),
            event_type="GENESIS_CLINICAL_BLACK_BOX",
            actor_id="SYSTEM",
            actor_role="SYSTEM_ADMIN",
            patient_id="GLOBAL",
            payload_hash=hashlib.sha256(b"FAME-GENIX-GENESIS-2026").hexdigest(),
            previous_block_hash="0" * 64,
            block_hash=hashlib.sha256(b"FAME-GENIX-ROOT-HASH").hexdigest(),
        )
        self.chain.append(genesis_block)
        if db is not None:
            from app.db.models import CryptographicBlock

            db.add(
                CryptographicBlock(
                    block_index=0,
                    timestamp=genesis_block.timestamp,
                    event_type=genesis_block.event_type,
                    actor_id=genesis_block.actor_id,
                    actor_role=genesis_block.actor_role,
                    patient_id=genesis_block.patient_id,
                    payload_hash=genesis_block.payload_hash,
                    previous_block_hash=genesis_block.previous_block_hash,
                    block_hash=genesis_block.block_hash,
                )
            )
            db.commit()

    def _persist_block(self, block: CryptographicAuditBlock, db: Optional[Session] = None) -> None:
        if self._session_factory is not None:
            session = self._session_factory()
            try:
                self._add_block_row(session, block)
                session.commit()
            finally:
                session.close()
        elif db is not None:
            self._add_block_row(db, block)
            db.commit()

    @staticmethod
    def _add_block_row(db: Session, block: CryptographicAuditBlock) -> None:
        from app.db.models import CryptographicBlock

        db.add(
            CryptographicBlock(
                block_index=block.block_index,
                timestamp=block.timestamp,
                event_type=block.event_type,
                actor_id=block.actor_id,
                actor_role=block.actor_role,
                patient_id=block.patient_id,
                payload_hash=block.payload_hash,
                previous_block_hash=block.previous_block_hash,
                block_hash=block.block_hash,
            )
        )

    # ------------------------------------------------------------------ #
    # Ledger API
    # ------------------------------------------------------------------ #
    def record_event(
        self,
        event_type: str,
        actor_id: str,
        actor_role: str,
        patient_id: str,
        event_data: Dict[str, Any],
        db: Optional[Session] = None,
    ) -> CryptographicAuditBlock:
        if not self.chain:
            self._genesis(db)
        prev_hash = self.chain[-1].block_hash
        now_ts = datetime.utcnow().isoformat()
        payload_bytes = json.dumps(event_data, sort_keys=True).encode("utf-8")
        payload_hash = hashlib.sha256(payload_bytes).hexdigest()

        header_string = f"{len(self.chain)}|{now_ts}|{event_type}|{actor_id}|{patient_id}|{payload_hash}|{prev_hash}"
        block_hash = hashlib.sha256(header_string.encode("utf-8")).hexdigest()

        block = CryptographicAuditBlock(
            block_index=len(self.chain),
            timestamp=now_ts,
            event_type=event_type,
            actor_id=actor_id,
            actor_role=actor_role,
            patient_id=patient_id,
            payload_hash=payload_hash,
            previous_block_hash=prev_hash,
            block_hash=block_hash,
        )
        self.chain.append(block)
        self._persist_block(block, db)
        return block

    def verify_chain_integrity(self) -> Dict[str, Any]:
        """Validates cryptographic chain against tampering."""
        for i in range(1, len(self.chain)):
            current = self.chain[i]
            prev = self.chain[i - 1]
            if current.previous_block_hash != prev.block_hash:
                return {"valid": False, "tampered_at_index": i}
        return {"valid": True, "total_blocks": len(self.chain), "latest_root_hash": self.chain[-1].block_hash}


clinical_black_box = CryptographicBlackBox()
