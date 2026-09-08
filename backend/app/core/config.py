"""Application configuration."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BACKEND_ROOT.parent


@dataclass
class Settings:
    app_name: str = "NetScope"
    database_url: str = os.environ.get(
        "NETSCOPE_DB", f"sqlite:///{BACKEND_ROOT / 'data' / 'netscope.db'}"
    )
    upload_dir: Path = Path(
        os.environ.get("NETSCOPE_UPLOAD_DIR", str(BACKEND_ROOT / "data" / "uploads"))
    )
    preferred_parser: str = os.environ.get("NETSCOPE_PARSER", "auto")
    tshark_path: str = os.environ.get("NETSCOPE_TSHARK", "tshark")
    max_upload_bytes: int = int(os.environ.get("NETSCOPE_MAX_UPLOAD", str(500 * 1024 * 1024)))
    enable_cors: bool = os.environ.get("NETSCOPE_CORS", "1") == "1"
    cors_origins: list[str] = field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )

    def ensure_dirs(self) -> None:
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        Path(str(self.database_url).replace("sqlite:///", "")).parent.mkdir(
            parents=True, exist_ok=True
        )


settings = Settings()
