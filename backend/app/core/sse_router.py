"""
Server-Sent Events (SSE) Stream Router for Authorized Portal Synchronization.
Task T4.10
"""

import asyncio
import json
from typing import AsyncGenerator
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.core.dependencies import get_current_user
from app.db.models import User
from app.core.events import event_bus

router = APIRouter(prefix="/api/v1/events", tags=["events"])


async def event_generator(request: Request, user: User) -> AsyncGenerator[str, None]:
    """Streams real-time clinical and emergency events to authorized portals."""
    last_idx = len(event_bus.log)
    
    # Send initial handshake ping
    init_msg = {
        "event": "HANDSHAKE",
        "user_id": user.id,
        "role": user.role,
        "message": "Connected to FAME-GENIX real-time synchronization bus."
    }
    yield f"data: {json.dumps(init_msg)}\n\n"

    while True:
        if await request.is_disconnected():
            break

        current_len = len(event_bus.log)
        if current_len > last_idx:
            for i in range(last_idx, current_len):
                entry = event_bus.log[i]
                payload = entry.get("payload", {})

                # Tenant / Role isolation:
                # Patients only receive events where payload patient_id matches their own
                if user.role == "PATIENT":
                    from app.db.session import SessionLocal
                    from app.db.models import Patient
                    with SessionLocal() as s:
                        p = s.query(Patient).filter(Patient.user_id == user.id).first()
                        p_id = p.id if p else None
                    event_pid = payload.get("patient_id")
                    if event_pid and p_id and event_pid != p_id:
                        continue

                yield f"event: {entry.get('event', 'message')}\ndata: {json.dumps(payload)}\n\n"
            last_idx = current_len

        await asyncio.sleep(1.0)


@router.get("/stream")
async def stream_portal_events(request: Request, user: User = Depends(get_current_user)):
    """
    Subscribes the frontend to real-time clinical and emergency FSM transitions.
    Requires authenticated token.
    """
    return StreamingResponse(
        event_generator(request, user),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
