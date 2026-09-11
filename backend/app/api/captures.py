"""Capture endpoints: upload, list, detail, analyze."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.parsers import registry, resolve_parser
from app.repositories import CaptureRepository, JobRepository
from app.schemas.api import AnalyzeRequest, CaptureOut, JobOut, MessageOut
from app.services.jobs import job_manager

router = APIRouter(prefix="/api/captures", tags=["captures"])

ALLOWED_EXTENSIONS = {".pcap", ".pcapng", ".cap"}


@router.post("", response_model=CaptureOut, status_code=201)
async def create_capture(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a PCAP/PCAPNG file and register a capture (metadata only; analysis is separate)."""
    filename = file.filename or "capture.pcap"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type {suffix!r}; allowed: {sorted(ALLOWED_EXTENSIONS)}")

    settings.ensure_dirs()
    data = await file.read()
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(413, "File too large")

    dest = settings.upload_dir / f"{_unique_name(filename)}"
    dest.write_bytes(data)

    repo = CaptureRepository(db)
    capture = repo.create(filename=filename, source="upload", size_bytes=len(data))
    capture = repo.update(capture, stored_path=str(dest))
    return capture


def _unique_name(filename: str) -> str:
    import uuid

    safe = Path(filename).name.replace("/", "_")
    return f"{uuid.uuid4().hex[:8]}_{safe}"


def get_stored_path(db: Session, capture_id: str) -> Path | None:
    from app.db.orm import CaptureModel

    capture = db.get(CaptureModel, capture_id)
    if capture is None or not capture.stored_path:
        return None
    return Path(capture.stored_path)


@router.get("", response_model=list[CaptureOut])
def list_captures(limit: int = 100, db: Session = Depends(get_db)):
    return CaptureRepository(db).list(limit)


@router.get("/{capture_id}", response_model=CaptureOut)
def get_capture(capture_id: str, db: Session = Depends(get_db)):
    capture = CaptureRepository(db).get(capture_id)
    if capture is None:
        raise HTTPException(404, "Capture not found")
    return capture


@router.post("/{capture_id}/analyze", response_model=JobOut, status_code=202)
def analyze_capture(
    capture_id: str,
    body: AnalyzeRequest | None = None,
    db: Session = Depends(get_db),
):
    """Start background analysis for a capture. Returns the created job (poll /api/jobs/{id})."""
    capture_repo = CaptureRepository(db)
    capture = capture_repo.get(capture_id)
    if capture is None:
        raise HTTPException(404, "Capture not found")
    if capture.status in ("analyzing", "queued"):
        existing = JobRepository(db).running_for_capture(capture_id)
        if existing:
            raise HTTPException(409, f"Analysis already running (job {existing.id})")

    # validate requested parser up-front (fail fast, before creating the job)
    requested = body.parser if body else None
    try:
        if requested not in (None, "", "auto"):
            resolve_parser(requested)
    except Exception as exc:
        raise HTTPException(400, str(exc))

    stored_path = get_stored_path(db, capture_id)
    if stored_path is None or not stored_path.exists():
        raise HTTPException(410, "Uploaded file no longer exists on disk")

    job = JobRepository(db).create(capture_id)
    capture_repo.update(capture, status="queued")
    job_manager.submit(capture_id, job.id, str(stored_path), requested)
    return job


@router.get("/meta/parsers", response_model=dict[str, bool])
def list_parsers():
    """Parser availability (scapy default; tshark optional)."""
    return registry.available()


@router.get("/{capture_id}/report")
def capture_report(capture_id: str, db: Session = Depends(get_db)):
    """Download a self-contained HTML investigation report (printable to PDF)."""
    from fastapi.responses import HTMLResponse

    from app.services.report import build_report

    capture = CaptureRepository(db).get(capture_id)
    if capture is None:
        raise HTTPException(404, "Capture not found")
    if capture.status != "completed":
        raise HTTPException(409, "Capture must be analyzed before a report can be generated")

    safe_name = capture.filename.replace("/", "_").replace(".", "_")
    html_body = build_report(db, capture)
    return HTMLResponse(
        content=html_body,
        headers={
            "Content-Disposition": f'inline; filename="packetsleuth_report_{safe_name}.html"',
        },
    )
