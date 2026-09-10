"""Alert endpoints: list, detail, acknowledge."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.common import capture_or_404
from app.core.database import get_db
from app.repositories import AlertRepository
from app.schemas.api import AlertOut, Page

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=Page)
def list_alerts(
    capture_id: str,
    severity: str | None = None,
    min_score: int | None = None,
    rule: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    capture_or_404(db, capture_id)
    alerts, total = AlertRepository(db).page_for_capture(
        capture_id,
        limit=limit,
        offset=offset,
        severity=severity,
        min_score=min_score,
        rule=rule,
    )
    return Page.of(
        [AlertOut.model_validate(a) for a in alerts],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/{alert_id}", response_model=AlertOut)
def get_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = AlertRepository(db).get(alert_id)
    if alert is None:
        raise HTTPException(404, "Alert not found")
    return alert


class AckBody(BaseModel):
    acknowledged: bool


@router.post("/{alert_id}/ack", response_model=AlertOut)
def acknowledge_alert(alert_id: str, body: AckBody, db: Session = Depends(get_db)):
    alert = AlertRepository(db).set_acknowledged(alert_id, body.acknowledged)
    if alert is None:
        raise HTTPException(404, "Alert not found")
    return alert
