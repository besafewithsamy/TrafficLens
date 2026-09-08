"""Repository layer — isolates persistence from business logic."""
from __future__ import annotations

from sqlalchemy import delete, desc, select
from sqlalchemy.orm import Session

from app.core.database import new_id
from app.db.orm import (
    AlertModel,
    AnalysisJobModel,
    CaptureModel,
    DNSTransactionModel,
    FlowModel,
    HTTPTransactionModel,
    HostModel,
    TLSSessionModel,
    TimelineEventModel,
)


class CaptureRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, filename: str, source: str, size_bytes: int) -> CaptureModel:
        capture = CaptureModel(
            id=new_id(),
            filename=filename,
            source=source,
            size_bytes=size_bytes,
            status="created",
        )
        self.db.add(capture)
        self.db.commit()
        self.db.refresh(capture)
        return capture

    def get(self, capture_id: str) -> CaptureModel | None:
        return self.db.get(CaptureModel, capture_id)

    def list(self, limit: int = 100) -> list[CaptureModel]:
        stmt = select(CaptureModel).order_by(desc(CaptureModel.created_at)).limit(limit)
        return list(self.db.scalars(stmt))

    def update(self, capture: CaptureModel, **fields) -> CaptureModel:
        for key, value in fields.items():
            setattr(capture, key, value)
        self.db.commit()
        self.db.refresh(capture)
        return capture


class FlowRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_many(self, capture_id: str, flow_dicts: list[dict]) -> list[FlowModel]:
        models = [
            FlowModel(id=new_id(), capture_id=capture_id, **fd) for fd in flow_dicts
        ]
        self.db.add_all(models)
        self.db.commit()
        return models

    def get(self, flow_id: str) -> FlowModel | None:
        return self.db.get(FlowModel, flow_id)

    def list_for_capture(self, capture_id: str) -> list[FlowModel]:
        stmt = (
            select(FlowModel)
            .where(FlowModel.capture_id == capture_id)
            .order_by(FlowModel.first_seen)
        )
        return list(self.db.scalars(stmt))

    def delete_for_capture(self, capture_id: str) -> int:
        from sqlalchemy import delete

        result = self.db.execute(delete(FlowModel).where(FlowModel.capture_id == capture_id))
        self.db.commit()
        return result.rowcount or 0


class HostRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_many(self, capture_id: str, host_dicts: list[dict]) -> list[HostModel]:
        models = [HostModel(id=new_id(), capture_id=capture_id, **hd) for hd in host_dicts]
        self.db.add_all(models)
        self.db.commit()
        return models

    def get(self, host_id: str) -> HostModel | None:
        return self.db.get(HostModel, host_id)

    def list_for_capture(self, capture_id: str) -> list[HostModel]:
        stmt = select(HostModel).where(HostModel.capture_id == capture_id)
        return list(self.db.scalars(stmt))

    def delete_for_capture(self, capture_id: str) -> int:
        result = self.db.execute(delete(HostModel).where(HostModel.capture_id == capture_id))
        self.db.commit()
        return result.rowcount or 0


class DNSRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_many(self, capture_id: str, txns: list[dict]) -> list[DNSTransactionModel]:
        models = [DNSTransactionModel(id=new_id(), capture_id=capture_id, **t) for t in txns]
        self.db.add_all(models)
        self.db.commit()
        return models

    def list_for_capture(self, capture_id: str) -> list[DNSTransactionModel]:
        stmt = (
            select(DNSTransactionModel)
            .where(DNSTransactionModel.capture_id == capture_id)
            .order_by(DNSTransactionModel.timestamp)
        )
        return list(self.db.scalars(stmt))

    def delete_for_capture(self, capture_id: str) -> int:
        result = self.db.execute(
            delete(DNSTransactionModel).where(DNSTransactionModel.capture_id == capture_id)
        )
        self.db.commit()
        return result.rowcount or 0


class HTTPRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_many(self, capture_id: str, txns: list[dict]) -> list[HTTPTransactionModel]:
        models = [HTTPTransactionModel(id=new_id(), capture_id=capture_id, **t) for t in txns]
        self.db.add_all(models)
        self.db.commit()
        return models

    def list_for_capture(self, capture_id: str) -> list[HTTPTransactionModel]:
        stmt = (
            select(HTTPTransactionModel)
            .where(HTTPTransactionModel.capture_id == capture_id)
            .order_by(HTTPTransactionModel.timestamp)
        )
        return list(self.db.scalars(stmt))

    def delete_for_capture(self, capture_id: str) -> int:
        result = self.db.execute(
            delete(HTTPTransactionModel).where(HTTPTransactionModel.capture_id == capture_id)
        )
        self.db.commit()
        return result.rowcount or 0


class TLSRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_many(self, capture_id: str, sessions: list[dict]) -> list[TLSSessionModel]:
        models = [TLSSessionModel(id=new_id(), capture_id=capture_id, **s) for s in sessions]
        self.db.add_all(models)
        self.db.commit()
        return models

    def list_for_capture(self, capture_id: str) -> list[TLSSessionModel]:
        stmt = (
            select(TLSSessionModel)
            .where(TLSSessionModel.capture_id == capture_id)
            .order_by(TLSSessionModel.first_seen)
        )
        return list(self.db.scalars(stmt))

    def delete_for_capture(self, capture_id: str) -> int:
        result = self.db.execute(
            delete(TLSSessionModel).where(TLSSessionModel.capture_id == capture_id)
        )
        self.db.commit()
        return result.rowcount or 0


class AlertRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_many(self, capture_id: str, alerts: list[dict]) -> list[AlertModel]:
        models = [AlertModel(id=new_id(), capture_id=capture_id, **a) for a in alerts]
        self.db.add_all(models)
        self.db.commit()
        return models

    def get(self, alert_id: str) -> AlertModel | None:
        return self.db.get(AlertModel, alert_id)

    def list_for_capture(self, capture_id: str) -> list[AlertModel]:
        stmt = (
            select(AlertModel)
            .where(AlertModel.capture_id == capture_id)
            .order_by(desc(AlertModel.score))
        )
        return list(self.db.scalars(stmt))

    def delete_for_capture(self, capture_id: str) -> int:
        result = self.db.execute(delete(AlertModel).where(AlertModel.capture_id == capture_id))
        self.db.commit()
        return result.rowcount or 0

    def set_acknowledged(self, alert_id: str, ack: bool) -> AlertModel | None:
        alert = self.get(alert_id)
        if alert is None:
            return None
        alert.acknowledged = ack
        self.db.commit()
        self.db.refresh(alert)
        return alert


class TimelineRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_many(self, capture_id: str, events: list[dict]) -> list[TimelineEventModel]:
        models = [TimelineEventModel(id=new_id(), capture_id=capture_id, **e) for e in events]
        self.db.add_all(models)
        self.db.commit()
        return models

    def list_for_capture(self, capture_id: str) -> list[TimelineEventModel]:
        stmt = (
            select(TimelineEventModel)
            .where(TimelineEventModel.capture_id == capture_id)
            .order_by(TimelineEventModel.timestamp)
        )
        return list(self.db.scalars(stmt))

    def delete_for_capture(self, capture_id: str) -> int:
        result = self.db.execute(
            delete(TimelineEventModel).where(TimelineEventModel.capture_id == capture_id)
        )
        self.db.commit()
        return result.rowcount or 0


class JobRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, capture_id: str, job_type: str = "full_analysis") -> AnalysisJobModel:
        job = AnalysisJobModel(id=new_id(), capture_id=capture_id, type=job_type, status="queued")
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def get(self, job_id: str) -> AnalysisJobModel | None:
        return self.db.get(AnalysisJobModel, job_id)

    def list_for_capture(self, capture_id: str) -> list[AnalysisJobModel]:
        stmt = (
            select(AnalysisJobModel)
            .where(AnalysisJobModel.capture_id == capture_id)
            .order_by(desc(AnalysisJobModel.created_at))
        )
        return list(self.db.scalars(stmt))

    def latest_for_capture(self, capture_id: str) -> AnalysisJobModel | None:
        jobs = self.list_for_capture(capture_id)
        return jobs[0] if jobs else None

    def update(self, job: AnalysisJobModel, **fields) -> AnalysisJobModel:
        for key, value in fields.items():
            setattr(job, key, value)
        self.db.commit()
        self.db.refresh(job)
        return job

    def running_for_capture(self, capture_id: str) -> AnalysisJobModel | None:
        for job in self.list_for_capture(capture_id):
            if job.status in ("queued", "running"):
                return job
        return None
