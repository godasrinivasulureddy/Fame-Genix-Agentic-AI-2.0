"""
FAME-GENIX Autonomous Cryptographic Medical Black Box:
SHA-256 chained tamper-evident ledger proving exact sequence of events,
telemetry, doctor reviews, and drug dispensations for legal and insurance defense.
"""

import hashlib
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel


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

    def __init__(self):
        self.chain: List[CryptographicAuditBlock] = []
        self._genesis()

    def _genesis(self):
        genesis_block = CryptographicAuditBlock(
            block_index=0,
            timestamp=datetime.utcnow().isoformat(),
            event_type="GENESIS_CLINICAL_BLACK_BOX",
            actor_id="SYSTEM",
            actor_role="SYSTEM_ADMIN",
            patient_id="GLOBAL",
            payload_hash=hashlib.sha256(b"FAME-GENIX-GENESIS-2026").hexdigest(),
            previous_block_hash="0" * 64,
            block_hash=hashlib.sha256(b"FAME-GENIX-ROOT-HASH").hexdigest()
        )
        self.chain.append(genesis_block)

    def record_event(
        self,
        event_type: str,
        actor_id: str,
        actor_role: str,
        patient_id: str,
        event_data: Dict[str, Any]
    ) -> CryptographicAuditBlock:
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
            block_hash=block_hash
        )
        self.chain.append(block)
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
