"""Jobs endpoints: status polling (SSE progress events land in a later step)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.db.orm import AnalysisJobModel
from app.repositories import JobRepository
from app.schemas.api import JobOut

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("", response_model=list[JobOut])
def list_jobs(limit: int = 50, db: Session = Depends(get_db)):
    stmt = select(AnalysisJobModel).order_by(desc(AnalysisJobModel.created_at)).limit(limit)
    return list(db.scalars(stmt))


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = JobRepository(db).get(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    return job
