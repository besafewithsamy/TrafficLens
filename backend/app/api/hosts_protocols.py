"""Host + protocol endpoints: hosts list/detail, DNS/HTTP/TLS transactions, protocol stats."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.captures import get_stored_path
from app.core.database import get_db
from app.db.orm import CaptureModel
from app.parsers import resolve_parser
from app.repositories import (
    DNSRepository,
    HTTPRepository,
    HostRepository,
    TLSRepository,
)
from app.schemas.api import (
    DNSTransactionOut,
    HTTPTransactionOut,
    HostOut,
    ProtocolStatsOut,
    TLSSessionOut,
)
from app.services.protocol_extractor import protocol_statistics

router = APIRouter(prefix="/api", tags=["hosts-protocols"])


def _capture_or_404(db: Session, capture_id: str) -> CaptureModel:
    capture = db.get(CaptureModel, capture_id)
    if capture is None:
        raise HTTPException(404, "Capture not found")
    return capture


# ---------------- Hosts ----------------


@router.get("/hosts", response_model=list[HostOut])
def list_hosts(
    capture_id: str,
    internal: bool | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    _capture_or_404(db, capture_id)
    hosts = HostRepository(db).list_for_capture(capture_id)
    if internal is not None:
        hosts = [h for h in hosts if bool(h.is_internal) == internal]
    hosts = sorted(hosts, key=lambda h: -(h.bytes_sent + h.bytes_received))
    return hosts[:limit]


@router.get("/hosts/{host_id}", response_model=HostOut)
def get_host(host_id: str, db: Session = Depends(get_db)):
    host = HostRepository(db).get(host_id)
    if host is None:
        raise HTTPException(404, "Host not found")
    return host


# ---------------- DNS ----------------


@router.get("/protocols/dns", response_model=list[DNSTransactionOut])
def list_dns(
    capture_id: str,
    domain: str | None = None,
    rcode: int | None = None,
    limit: int = 500,
    db: Session = Depends(get_db),
):
    _capture_or_404(db, capture_id)
    txns = DNSRepository(db).list_for_capture(capture_id)
    if domain:
        txns = [t for t in txns if domain.lower() in t.query_name.lower()]
    if rcode is not None:
        txns = [t for t in txns if t.rcode == rcode]
    return txns[:limit]


# ---------------- HTTP ----------------


@router.get("/protocols/http", response_model=list[HTTPTransactionOut])
def list_http(
    capture_id: str,
    host: str | None = None,
    status: int | None = None,
    limit: int = 500,
    db: Session = Depends(get_db),
):
    _capture_or_404(db, capture_id)
    txns = HTTPRepository(db).list_for_capture(capture_id)
    if host:
        txns = [t for t in txns if t.host and host.lower() in t.host.lower()]
    if status is not None:
        txns = [t for t in txns if t.status_code == status]
    return txns[:limit]


# ---------------- TLS ----------------


@router.get("/protocols/tls", response_model=list[TLSSessionOut])
def list_tls(
    capture_id: str,
    sni: str | None = None,
    limit: int = 500,
    db: Session = Depends(get_db),
):
    _capture_or_404(db, capture_id)
    sessions = TLSRepository(db).list_for_capture(capture_id)
    if sni:
        sessions = [s for s in sessions if s.sni and sni.lower() in s.sni.lower()]
    return sessions[:limit]


# ---------------- Protocol stats (Module J) ----------------


@router.get("/protocols/stats", response_model=ProtocolStatsOut)
def protocol_stats(capture_id: str, db: Session = Depends(get_db)):
    """Protocol-centric 'what is this protocol doing?' summary."""
    capture = _capture_or_404(db, capture_id)
    stored = get_stored_path(db, capture.id)
    if stored is None or not Path(stored).exists():
        raise HTTPException(410, "Capture file no longer available for protocol stats")
    parser = resolve_parser(None)
    parsed = parser.parse_file(str(stored))
    stats = protocol_statistics(parsed)
    return stats
