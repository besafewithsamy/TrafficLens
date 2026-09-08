"""Network Engineering Mode endpoint (Module G)."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.captures import get_stored_path
from app.core.database import get_db
from app.db.orm import CaptureModel
from app.parsers import resolve_parser
from app.repositories import DNSRepository, FlowRepository
from app.services.engineer_metrics import compute_engineer_metrics
from app.services.flow_builder import FlowBuilder
from app.services.protocol_extractor import extract_dns
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/engineer", tags=["engineer"])


@router.get("/metrics")
def engineer_metrics(capture_id: str, db: Session = Depends(get_db)):
    """Network health metrics: throughput, reliability, latency, anomalies."""
    capture = db.get(CaptureModel, capture_id)
    if capture is None:
        raise HTTPException(404, "Capture not found")
    stored = get_stored_path(db, capture.id)
    if stored is None or not Path(stored).exists():
        raise HTTPException(410, "Capture file no longer available")

    parser = resolve_parser(None)
    parsed = parser.parse_file(str(stored))
    flows = FlowBuilder().build_from(parsed)
    dns_txns = extract_dns(parsed)

    metrics = compute_engineer_metrics(parsed, flows, dns_txns)
    return JSONResponse(metrics)
