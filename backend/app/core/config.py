"""Application configuration."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BACKEND_ROOT.parent


def _env(name: str, legacy: str, legacy2: str, default: str) -> str:
    """Read PACKETSLEUTH_* with backward-compatible TRAFFICLENS_*/NETSCOPE_* fallbacks."""
    return os.environ.get(name) or os.environ.get(legacy) or os.environ.get(legacy2) or default


@dataclass
class Settings:
    app_name: str = "PacketSleuth"
    database_url: str = _env(
        "PACKETSLEUTH_DB", "TRAFFICLENS_DB", "NETSCOPE_DB",
        f"sqlite:///{BACKEND_ROOT / 'data' / 'packetsleuth.db'}",
    )
    upload_dir: Path = Path(
        _env(
            "PACKETSLEUTH_UPLOAD_DIR",
            "TRAFFICLENS_UPLOAD_DIR",
            "NETSCOPE_UPLOAD_DIR",
            str(BACKEND_ROOT / "data" / "uploads"),
        )
    )
    preferred_parser: str = _env("PACKETSLEUTH_PARSER", "TRAFFICLENS_PARSER", "NETSCOPE_PARSER", "auto")
    tshark_path: str = _env("PACKETSLEUTH_TSHARK", "TRAFFICLENS_TSHARK", "NETSCOPE_TSHARK", "tshark")
    max_upload_bytes: int = int(
        _env("PACKETSLEUTH_MAX_UPLOAD", "TRAFFICLENS_MAX_UPLOAD", "NETSCOPE_MAX_UPLOAD", str(500 * 1024 * 1024))
    )
    enable_cors: bool = _env("PACKETSLEUTH_CORS", "TRAFFICLENS_CORS", "NETSCOPE_CORS", "1") == "1"
    cors_origins: list[str] = field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )

    def ensure_dirs(self) -> None:
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        Path(str(self.database_url).replace("sqlite:///", "")).parent.mkdir(
            parents=True, exist_ok=True
        )


settings = Settings()
