![Logo](assets/Logo.png)

**Network traffic analysis and investigation, built around understanding what happened.**

TrafficLens turns raw network traffic into a clear picture of network activity. Instead of forcing you to work through thousands of packets to understand an incident, it reconstructs the traffic into flows, hosts, protocols, behaviors, events, and alerts — while keeping the underlying packets available as evidence.

> Here is what happened. Let me show you the network evidence behind it.

```text
Packets → Flows → Hosts → Behaviors → Events → Investigation
````

## Screenshots


![Dashboard overview](assets/pic1.png)

## What TrafficLens Does

### Traffic Investigation

* Reconstructs bidirectional TCP and UDP flows
* Tracks packets, bytes, duration, and direction
* Detects retransmissions, resets, and connection failures
* Provides packet-level evidence for investigations

### Host & Protocol Analysis

* Builds profiles for observed hosts
* Identifies services, ports, and communication relationships
* Reconstructs DNS transactions
* Analyzes HTTP requests and responses
* Extracts TLS sessions and SNI information
* Provides protocol-level behavioral statistics

### Suspicious Activity Detection

TrafficLens uses deterministic and explainable rules rather than relying on black-box machine learning.

Current detections include:

* Port scanning
* C2-style beaconing
* DNS tunneling indicators
* NXDOMAIN bursts
* Suspicious ports
* Excessive connection failures
* Direct-IP connections without DNS
* Unusually high outbound traffic

Each alert provides a score, severity, explanation, detection reasons, supporting evidence, and related flows.

### Timeline, Graph & Replay

TrafficLens turns network activity into an investigation timeline that can be filtered by host, protocol, event type, severity, and time.

It also provides:

* Network relationship graphs
* Chronological event timelines
* Incident replay
* Flow and packet drill-down

### Network Engineering

TrafficLens is not limited to security investigations. It also provides network health information including:

* Bandwidth and packet rates
* Top talkers
* TCP health
* DNS health
* Traffic distribution
* Network issues

## Quick Start

### Requirements

* Python 3.12+
* Node.js 18+
* npm

### Backend

```bash

cd ~/Projects/TrafficLens/backend

source .venv/bin/activate

python -m uvicorn app.main:app --reload --port 8000

```

The API will be available at:

[http://localhost:8000](http://localhost:8000)

Interactive API documentation:

[http://localhost:8000/docs](http://localhost:8000/docs)

### Frontend

Open another terminal:

```bash

cd ~/Projects/TrafficLens/frontend

npm run dev
```

Then open:

[http://localhost:5173](http://localhost:5173)

## Test Data

TrafficLens includes a deterministic PCAP generator for development and testing.

From the `backend` directory with the virtual environment activated:

```bash
python ../scripts/generate_test_pcaps.py --out ../test-data/synthetic
```

The generator includes scenarios such as:

* Normal traffic
* Port scanning
* DNS tunneling
* C2-style beaconing
* TCP connection problems

## Architecture

TrafficLens separates packet parsing from the analysis engine through a normalized internal model.

```text
PCAP
  │
  ▼
Packet Parser
  │
  ├── Scapy
  └── TShark
  │
  ▼
Normalized Packets
  │
  ├── Flow Reconstruction
  ├── Protocol Analysis
  ├── Host Profiling
  └── Behavioral Analysis
          │
          ▼
        Alerts
          │
          ▼
 Timeline / Graph / Replay
          │
          ▼
     Investigation
```

Parser-specific objects do not leave the parser layer. This keeps the analysis engine independent from the underlying packet parser and makes it possible to add additional parsers in the future.

## Project Structure

```text
TrafficLens/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── parsers/
│   │   ├── repositories/
│   │   ├── schemas/
│   │   └── services/
│   └── tests/
│
├── frontend/
│   └── src/
│       ├── api/
│       ├── components/
│       ├── pages/
│       └── types/
│
├── scripts/
│   └── generate_test_pcaps.py
│
└── test-data/
```

## Tech Stack

### Backend

* Python
* FastAPI
* SQLAlchemy
* SQLite
* Scapy
* Pydantic

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Zustand
* TanStack Table
* Cytoscape.js
* Recharts

## Testing

Run the backend test suite with:

```bash
cd backend
source .venv/bin/activate
pytest tests/ -q
```

TrafficLens also uses deterministic synthetic PCAPs to make analysis scenarios reproducible during development and testing.

## Roadmap

* Live network interface capture
* IPv6 support
* Real-time analysis updates
* PCAP analysis caching
* Multi-PCAP investigations
* Investigation and report export
* Additional protocol parsers
* Additional behavioral detections

## Current Status

TrafficLens is currently a local, single-user application focused on PCAP-based network investigation and analysis.

The core analysis pipeline, flow reconstruction, protocol analysis, behavioral detection, timeline, graph, replay, and network engineering features are implemented.

## Contributing

TrafficLens is an evolving project. Contributions, ideas, bug reports, and improvements are welcome.

If you have an idea that could make network traffic easier to understand or investigate, feel free to open an issue or submit a pull request.


