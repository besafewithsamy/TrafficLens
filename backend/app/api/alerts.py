"""Alert endpoints: list, detail, acknowledge."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.db.orm import CaptureModel
from app.repositories import AlertRepository
from app.schemas.api import AlertOut, MessageOut

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


def _capture_or_404(db: Session, capture_id: str) -> CaptureModel:
    capture = db.get(CaptureModel, capture_id)
    if capture is None:
        raise HTTPException(404, "Capture not found")
    return capture


@router.get("", response_model=list[AlertOut])
def list_alerts(
    capture_id: str,
    severity: str | None = None,
    min_score: int | None = None,
    rule: str | None = None,
    db: Session = Depends(get_db),
):
    _capture_or_404(db, capture_id)
    alerts = AlertRepository(db).list_for_capture(capture_id)
    if severity:
        alerts = [a for a in alerts if a.severity == severity.lower()]
    if min_score is not None:
        alerts = [a for a in alerts if a.score >= min_score]
    if rule:
        alerts = [a for a in alerts if a.rule_name == rule]
    return alerts


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
