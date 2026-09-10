"""Application configuration."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BACKEND_ROOT.parent


def _env(name: str, legacy: str, default: str) -> str:
    """Read TRAFFICLENS_* with backward-compatible NETSCOPE_* fallback."""
    return os.environ.get(name, os.environ.get(legacy, default))


@dataclass
class Settings:
    app_name: str = "TrafficLens"
    database_url: str = _env(
        "TRAFFICLENS_DB", "NETSCOPE_DB", f"sqlite:///{BACKEND_ROOT / 'data' / 'trafficlens.db'}"
    )
    upload_dir: Path = Path(
        _env(
            "TRAFFICLENS_UPLOAD_DIR",
            "NETSCOPE_UPLOAD_DIR",
            str(BACKEND_ROOT / "data" / "uploads"),
        )
    )
    preferred_parser: str = _env("TRAFFICLENS_PARSER", "NETSCOPE_PARSER", "auto")
    tshark_path: str = _env("TRAFFICLENS_TSHARK", "NETSCOPE_TSHARK", "tshark")
    max_upload_bytes: int = int(
        _env("TRAFFICLENS_MAX_UPLOAD", "NETSCOPE_MAX_UPLOAD", str(500 * 1024 * 1024))
    )
    enable_cors: bool = _env("TRAFFICLENS_CORS", "NETSCOPE_CORS", "1") == "1"
    cors_origins: list[str] = field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )

    def ensure_dirs(self) -> None:
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        Path(str(self.database_url).replace("sqlite:///", "")).parent.mkdir(
            parents=True, exist_ok=True
        )


settings = Settings()
