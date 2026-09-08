"""Flow endpoints: list flows for a capture, flow detail with packet evidence."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.captures import get_stored_path
from app.core.database import get_db
from app.db.orm import CaptureModel
from app.parsers import registry, resolve_parser
from app.repositories import FlowRepository
from app.schemas.api import FlowDetailOut, FlowOut, PacketEvidence

router = APIRouter(prefix="/api/flows", tags=["flows"])


def _get_capture_or_404(db: Session, capture_id: str) -> CaptureModel:
    capture = db.get(CaptureModel, capture_id)
    if capture is None:
        raise HTTPException(404, "Capture not found")
    return capture


@router.get("", response_model=list[FlowOut])
def list_flows(
    capture_id: str,
    transport: str | None = None,
    direction: str | None = None,
    limit: int = 500,
    db: Session = Depends(get_db),
):
    """List reconstructed flows for a capture (newest captures' flows)."""
    _get_capture_or_404(db, capture_id)
    flows = FlowRepository(db).list_for_capture(capture_id)
    if transport:
        flows = [f for f in flows if f.transport_protocol == transport.upper()]
    if direction:
        flows = [f for f in flows if f.direction == direction.lower()]
    return flows[:limit]


@router.get("/{flow_id}", response_model=FlowDetailOut)
def get_flow(flow_id: str, db: Session = Depends(get_db)):
    """Flow detail including the underlying packet evidence (Flow → packets drill-down)."""
    flow = FlowRepository(db).get(flow_id)
    if flow is None:
        raise HTTPException(404, "Flow not found")

    capture = db.get(CaptureModel, flow.capture_id)
    evidence: list[PacketEvidence] = []
    if capture is not None:
        stored = get_stored_path(db, capture.id)
        if stored is not None and Path(stored).exists():
            parser = resolve_parser(None)
            try:
                parsed = parser.parse_file(str(stored))
                wanted = set(flow.packet_refs or [])
                evidence = [
                    PacketEvidence(
                        timestamp=p.timestamp,
                        source_ip=p.source_ip,
                        destination_ip=p.destination_ip,
                        protocol=p.protocol,
                        transport=p.transport,
                        source_port=p.source_port,
                        destination_port=p.destination_port,
                        length=p.length,
                        flags=p.flags,
                        metadata=p.metadata,
                        packet_reference=p.packet_reference,
                    )
                    for p in parsed.packets
                    if p.packet_reference in wanted
                ]
                evidence.sort(key=lambda e: e.timestamp)
            except Exception:
                evidence = []  # evidence is best-effort; flow data remains valid

    detail = FlowDetailOut.model_validate(flow)
    detail.packet_evidence = evidence
    return detail
