# NetScope

**Network Intelligence, Traffic Investigation & Network Engineering Platform**

> Philosophy: *"Here is what happened. Let me show you the packets and network evidence behind it."*

Where Wireshark gives you packets and asks "figure out what happened", NetScope reconstructs the story first — flows, hosts, behaviors, events, incidents — and lets you drill down to the packet evidence behind every conclusion.

```
Packet → Flow → Behavior → Event → Investigation
```

---

## Quick Start

### Backend (Python 3.12+)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000/api
- Interactive docs: http://localhost:8000/docs

### Frontend (Node 18+)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxies /api to :8000)
npm run build        # production build (tsc + vite)
```

### Test Data

```bash
# backend venv active, from backend/
python ../scripts/generate_test_pcaps.py --out ../test-data/synthetic
```

Deterministic scenarios: `normal_traffic`, `port_scan`, `dns_tunneling`, `c2_beacon`, `tcp_problems`.

### Tests

```bash
cd backend && source .venv/bin/activate
pytest tests/ -q              # 74 tests across all 6 build steps
```

---

## Architecture

```
netscope/
├── backend/
│   ├── app/
│   │   ├── core/          # config, SQLAlchemy engine, normalized packet model
│   │   ├── parsers/       # PacketParser ABC + ScapyParser (default) + TSharkParser (optional)
│   │   ├── db/            # ORM models (SQLite)
│   │   ├── repositories/   # data-access layer (persistence isolated from business logic)
│   │   ├── services/      # analysis pipeline:
│   │   │   ├── analysis.py          # pipeline orchestrator + job progress
│   │   │   ├── flow_builder.py      # bidirectional flow aggregation, TCP states
│   │   │   ├── protocol_extractor.py# DNS/HTTP/TLS transaction pairing
│   │   │   ├── host_profiler.py     # host profiles, roles, services
│   │   │   ├── suspicion_engine.py  # 8 deterministic explainable rules
│   │   │   ├── timeline_graph.py    # behavioral events + Cytoscape graph
│   │   │   └── engineer_metrics.py  # network health metrics (Module G)
│   │   ├── api/           # FastAPI routers (captures, jobs, flows, hosts/protocols,
│   │   │                  # alerts, timeline/graph/replay, engineer)
│   │   └── schemas/       # Pydantic API models (separate from ORM)
│   └── tests/
├── frontend/
│   └── src/
│       ├── pages/         # Dashboard, Capture, Flows, Hosts, Protocol,
│       │                  # Timeline, Graph, Alerts, Replay, Engineer
│       ├── api/           # typed REST client
│       ├── stores/        # Zustand
│       └── types/         # normalized NetScope types (parser-agnostic)
├── scripts/
│   └── generate_test_pcaps.py   # deterministic synthetic PCAP generator
└── test-data/synthetic/
```

### Parser Pluggability

Parser-specific objects never leave the parser layer. Everything downstream consumes
the normalized model (`NormalizedPacket`, `ParsedCapture`):

```
PCAP → PacketParser (ABC) → ScapyParser | TSharkParser | <future: Zeek, Rust, …>
                               ↓ normalized model ↓
                    flows → hosts → protocols → alerts → timeline → API
```

- **ScapyParser** — default, always works (no Wireshark needed)
- **TSharkParser** — optional, auto-detected; direct `tshark -T fields` integration (no PyShark)
- New parsers register via `ParserRegistry` without touching analysis code

### Analysis Pipeline

```
Upload PCAP → background thread job →
  parse (Scapy/TShark) → normalize packets →
  flow reconstruction → persist flows →
  DNS/HTTP/TLS extraction → host profiling →
  suspicion engine (8 rules) → persist alerts →
  timeline events → capture summary
```

HTTP requests never block: analysis runs in background threads with live progress
(`captures.analysis_progress`, `jobs.progress` + stage).

---

## API Reference

| Endpoint | Purpose |
|---|---|
| `POST /api/captures` | upload .pcap/.pcapng |
| `GET /api/captures[/{id}]` | list/detail (incl. summary, flow/alert stats) |
| `POST /api/captures/{id}/analyze` | start background analysis (202 + job) |
| `GET /api/jobs[/{id}]` | job status/progress/stage |
| `GET /api/flows?capture_id=&transport=&direction=` | reconstructed flows |
| `GET /api/flows/{id}` | flow detail + packet evidence (drill-down) |
| `GET /api/hosts[/{id}]?capture_id=&internal=` | host profiles (roles, services, peers) |
| `GET /api/protocols/dns?domain=&rcode=` | DNS transactions (paired, latency) |
| `GET /api/protocols/http?host=&status=` | HTTP transactions |
| `GET /api/protocols/tls?sni=` | TLS sessions with SNI |
| `GET /api/protocols/stats?capture_id=` | per-protocol behavioral summaries |
| `GET /api/alerts?capture_id=&severity=&min_score=&rule=` | explainable alerts |
| `POST /api/alerts/{id}/ack` | acknowledge alert |
| `GET /api/timeline?capture_id=&host=&protocol=&event_type=&severity=&after=&before=` | filtered event timeline |
| `GET /api/graph?capture_id=` | Cytoscape elements (hosts/domains/services) |
| `GET /api/replay?capture_id=&after=` | chronological replay stream |
| `GET /api/engineer/metrics?capture_id=` | network health metrics + issues |
| `GET /api/captures/meta/parsers` | parser availability |

---

## Suspicion Engine Rules

Deterministic, explainable, zero ML. Every alert ships with severity, 0–100 score,
weighted `✓` reasons, evidence JSON, related flow IDs, and a plain-English explanation.

| Rule | Trigger |
|---|---|
| `port_scan` | ≥10 distinct ports probed, failed connections |
| `beaconing` | periodic connections (jitter < 10% of interval) |
| `dns_tunneling` | long encoded labels + high subdomain entropy |
| `nxdomain_burst` | ≥10 failed lookups |
| `suspicious_port` | malware-associated ports (4444, 31337, 6667…) |
| `excessive_connection_failures` | ≥5 failures, small port set |
| `connection_without_dns` | direct-IP outbound (hardcoded C2 indicator) |
| `high_outbound_volume` | dominant outbound host (>70% share) |

---

## UI Modules

| Page | Module |
|---|---|
| Dashboard | top stats, flow/alert summaries, active jobs |
| Capture | upload → analyze → live progress → results |
| Flows | TanStack Table, filters, **packet-evidence drill-down** |
| Hosts | profiles, role inference, relationship tree |
| Protocol | DNS / HTTP / TLS behavioral analysis |
| Timeline | filtered chronological events |
| Graph | Cytoscape relationship graph (hosts/domains/services) |
| Alerts | explainable alert cards (score gauge, ✓ reasons, evidence) |
| Replay | play/pause/scrub/speed through the incident |
| Engineer Mode | pps/bandwidth charts, TCP/DNS health, MTU, top talkers |

## Configuration

Environment variables (all optional):

| Var | Default | Purpose |
|---|---|---|
| `NETSCOPE_DB` | `backend/data/netscope.db` | SQLite path |
| `NETSCOPE_UPLOAD_DIR` | `backend/data/uploads` | upload storage |
| `NETSCOPE_PARSER` | `auto` | preferred parser (scapy/tshark) |
| `NETSCOPE_TSHARK` | `tshark` | tshark binary path |
| `NETSCOPE_MAX_UPLOAD` | 500 MB | upload size cap |

## Status

**v1 complete — all 6 steps built and verified.**

- [x] Step 1 — Foundation: scaffold, parser abstraction, upload, background jobs, generator
- [x] Step 2 — Flow reconstruction: aggregation, TCP states, retransmissions, evidence
- [x] Step 3 — Host profiling & protocol explorer: DNS/HTTP/TLS extraction, roles
- [x] Step 4 — Suspicion engine: 8 deterministic explainable rules
- [x] Step 5 — Graph + timeline + replay: Cytoscape, filtered events, playback
- [x] Step 6 — Engineer mode + polish: health metrics, UX states, docs

74 backend tests · 19 end-to-end smoke checks · clean frontend build

## Known Limitations (v1)

- Polling-based progress (SSE/WebSocket planned)
- Evidence/stats endpoints re-parse the PCAP per request (caching planned)
- No IPv6 test data; no live interface capture yet
- Single-user, local deployment by design
