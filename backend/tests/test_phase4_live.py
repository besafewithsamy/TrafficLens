"""Phase 4 tests: live capture lifecycle with a fake sniffer (no root needed).

Also includes one REAL end-to-end live test (lo interface, 4 pings) that
skips itself when sniffing isn't permitted (non-root CI).
"""
from __future__ import annotations

import time

import pytest

from app.services.live_capture import LiveCaptureError, LiveCaptureManager


class FakeSniffer:
    """Mimics the AsyncSniffer surface LiveCaptureManager uses."""

    def __init__(self, interface: str, bpf: str | None, packet_counter: int = 0) -> None:
        self.iface = interface
        self.filter = bpf
        self.packet_counter = packet_counter
        self.results: list = []
        self.started = False
        self.stopped = False
        self.start_raises: Exception | None = None

    def start(self) -> None:
        if self.start_raises:
            raise self.start_raises
        self.started = True

    def stop(self, timeout: int = 5) -> None:
        self.stopped = True


def _make_manager(monkeypatch, interfaces=("lo", "eth0"), sniffer=None):
    sniffer = sniffer or FakeSniffer("lo", None)
    mgr = LiveCaptureManager(sniffer_factory=lambda iface, bpf: sniffer)
    monkeypatch.setattr(LiveCaptureManager, "interfaces", staticmethod(lambda: list(interfaces)))
    return mgr, sniffer


# ---------------- start / status ----------------


def test_start_and_status(monkeypatch):
    mgr, sniffer = _make_manager(monkeypatch)
    status = mgr.start("lo", bpf="tcp port 80")
    assert status["status"] == "running"
    assert status["interface"] == "lo"
    assert status["bpf"] == "tcp port 80"
    assert sniffer.started
    # status is queryable and consistent
    assert mgr.status()["status"] == "running"
    mgr._cancel_watchdog()


def test_start_unknown_interface(monkeypatch):
    mgr, _ = _make_manager(monkeypatch)
    with pytest.raises(LiveCaptureError, match="not found"):
        mgr.start("wlan99")


def test_start_double_conflict(monkeypatch):
    mgr, sniffer = _make_manager(monkeypatch)
    mgr.start("lo")
    with pytest.raises(LiveCaptureError, match="already running"):
        mgr.start("eth0")
    mgr._cancel_watchdog()


def test_start_permission_error(monkeypatch):
    sniffer = FakeSniffer("lo", None)
    sniffer.start_raises = PermissionError("raw socket required")
    mgr, _ = _make_manager(monkeypatch, sniffer=sniffer)
    with pytest.raises(LiveCaptureError, match="permission"):
        mgr.start("lo")


# ---------------- stop / auto-stop ----------------


def test_stop_without_running(monkeypatch):
    mgr, _ = _make_manager(monkeypatch)
    with pytest.raises(LiveCaptureError, match="No live capture"):
        mgr.stop()


def test_stop_persists_capture_and_submits_analysis(monkeypatch, app_env):
    """Stopping must write a pcap, register a live capture, and start a job."""
    from scapy.all import IP, TCP, Ether

    sniffer = FakeSniffer("lo", None)
    sniffer.results = [
        Ether() / IP(src="10.0.0.1", dst="10.0.0.2") / TCP(sport=1, dport=2, flags="S"),
    ]
    sniffer.packet_counter = 1
    mgr, _ = _make_manager(monkeypatch, sniffer=sniffer)

    submitted: list = []
    monkeypatch.setattr(
        "app.services.jobs.job_manager",
        type("JM", (), {"submit": staticmethod(lambda *a, **k: submitted.append(a))}),
    )

    mgr.start("lo", max_seconds=600)  # long watchdog so it doesn't fire mid-test
    result = mgr.stop()

    assert result["state"]["status"] == "stopped"
    capture = result["capture"]
    assert capture["source"] == "live"
    assert capture["filename"].startswith("live_lo_")
    # pcap written into the isolated upload dir
    from pathlib import Path

    pcap_path = Path(app_env["upload_dir"]) / capture["filename"]
    assert pcap_path.exists()

    # analysis job was submitted for the new capture
    assert submitted and submitted[0][0] == capture["id"]


def test_auto_stop_fires_on_time_cap(monkeypatch, app_env):
    """The watchdog stops the capture when max_seconds elapses."""
    sniffer = FakeSniffer("lo", None)
    mgr, _ = _make_manager(monkeypatch, sniffer=sniffer)
    submitted = []
    monkeypatch.setattr(
        "app.services.jobs.job_manager",
        type("JM", (), {"submit": staticmethod(lambda *a, **k: submitted.append(a))}),
    )
    mgr.start("lo", max_seconds=1)
    deadline = time.time() + 5
    while time.time() < deadline and mgr.status()["status"] == "running":
        time.sleep(0.1)
    assert mgr.status()["status"] == "stopped", "watchdog must auto-stop the capture"


# ---------------- API surface ----------------


def test_live_api_endpoints(monkeypatch, client):
    """Full HTTP lifecycle over the router with a fake sniffer.

    NOTE: the client fixture reimports app modules (conftest purge), so all
    patches must resolve classes/managers from the CURRENT modules at run time.
    """
    import app.services.live_capture as lc_mod  # the module the running app uses

    sniffer = FakeSniffer("lo", None)
    fresh_manager = lc_mod.LiveCaptureManager(
        sniffer_factory=lambda i, b: sniffer
    )
    import app.api.live as live_mod

    monkeypatch.setattr(live_mod, "live_manager", fresh_manager)
    monkeypatch.setattr(
        lc_mod.LiveCaptureManager, "interfaces", staticmethod(lambda: ["lo"])
    )

    # interfaces listing
    ifaces = client.get("/api/live/interfaces").json()
    assert isinstance(ifaces, list)

    # start
    resp = client.post("/api/live/start", json={"interface": "lo", "bpf": "tcp"})
    assert resp.status_code == 202, resp.text
    assert resp.json()["status"] == "running"

    # double start → 409
    resp = client.post("/api/live/start", json={"interface": "lo"})
    assert resp.status_code == 409

    # status
    status = client.get("/api/live/status").json()
    assert status["status"] == "running"
    assert status["interface"] == "lo"

    # stop → capture registered
    monkeypatch.setattr(
        "app.services.jobs.job_manager",
        type("JM", (), {"submit": staticmethod(lambda *a, **k: None)}),
    )
    resp = client.post("/api/live/stop")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["state"]["status"] == "stopped"
    assert body["capture"]["source"] == "live"

    # stop again → 409
    resp = client.post("/api/live/stop")
    assert resp.status_code == 409


def test_live_api_bad_interface(client):
    resp = client.post("/api/live/start", json={"interface": "doesnotexist0"})
    assert resp.status_code == 400
    assert "not found" in resp.json()["detail"]


# ---------------- Real sniffing integration (root only) ----------------


def test_real_live_capture_lo():
    """End-to-end on the loopback interface — skipped without sniffing privileges."""
    import socket

    try:
        s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, 3)
        s.close()
    except PermissionError:
        pytest.skip("live sniffing requires root/CAP_NET_RAW")

    from scapy.all import ICMP, IP, sr1

    mgr = LiveCaptureManager()
    if "lo" not in mgr.interfaces():
        pytest.skip("no loopback interface")

    mgr.start("lo", bpf="icmp", max_seconds=30)
    try:
        sr1(IP(dst="127.0.0.1") / ICMP(), timeout=4, verbose=0)
    finally:
        result = mgr.stop()

    assert result["state"]["status"] == "stopped"
    assert result["state"]["packet_count"] >= 1, "expected to capture the loopback ping"
    assert result["capture"]["source"] == "live"
