"""Suspicion Engine — deterministic, explainable behavioral detection (Module D).

Every alert must be explainable:
    rule name + severity + score + weighted reasons + evidence + related flows.

No ML. No black boxes. Every score traces back to observable network facts.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field

from app.core.models import ParsedCapture
from app.services.flow_builder import is_private_ip

# Suspicious ports commonly associated with malware/tooling
SUSPICIOUS_PORTS = {
    4444: "Metasploit default handler",
    1337: "elite/leet convention",
    31337: "Back Orifice",
    6667: "IRC (often C2)",
    6660: "IRC (often C2)",
    5555: "ADB / common backdoor",
    8888: "common C2 / proxy",
    9999: "common C2 channel",
    1234: "common trojan port",
}

MIN_SEVERITY_SCORE = {"critical": 80, "high": 60, "medium": 40, "low": 20, "info": 0}


@dataclass
class RuleResult:
    rule_name: str
    title: str
    severity: str
    score: int
    reasons: list[dict] = field(default_factory=list)
    evidence: dict = field(default_factory=dict)
    source_ip: str | None = None
    destination_ip: str | None = None
    destination_port: int | None = None
    related_flow_ids: list[str] = field(default_factory=list)
    related_packet_refs: list[int] = field(default_factory=list)
    explanation: str = ""

    def to_dict(self) -> dict:
        return {
            "rule_name": self.rule_name,
            "title": self.title,
            "severity": self.severity,
            "score": self.score,
            "reasons": self.reasons,
            "evidence": self.evidence,
            "source_ip": self.source_ip,
            "destination_ip": self.destination_ip,
            "destination_port": self.destination_port,
            "related_flow_ids": self.related_flow_ids,
            "related_packet_refs": self.related_packet_refs,
            "explanation": self.explanation,
        }


def _reason(reason: str, detail: str, weight: int) -> dict:
    return {"reason": reason, "detail": detail, "weight": weight}


def _clamp(score: int) -> int:
    return max(0, min(100, score))


def _severity_for(score: int) -> str:
    if score >= 80:
        return "critical"
    if score >= 60:
        return "high"
    if score >= 40:
        return "medium"
    if score >= 20:
        return "low"
    return "info"


# ---------------- Rules ----------------


def rule_port_scan(flows: list[dict]) -> list[RuleResult]:
    """One source probing many distinct ports on one destination."""
    scans: dict[tuple, dict] = defaultdict(
        lambda: {"ports": set(), "flows": [], "first": None, "last": None}
    )
    for f in flows:
        if f["transport_protocol"] != "TCP" or not f["failed"]:
            continue
        key = (f["source_ip"], f["destination_ip"])
        s = scans[key]
        s["ports"].add(f["destination_port"])
        s["flows"].append(f)
        s["first"] = f["first_seen"] if s["first"] is None else min(s["first"], f["first_seen"])
        s["last"] = f["last_seen"] if s["last"] is None else max(s["last"], f["last_seen"])

    results = []
    for (src, dst), s in scans.items():
        n_ports = len(s["ports"])
        if n_ports < 10:
            continue
        duration = max(0.001, (s["last"] or 0) - (s["first"] or 0))
        rate = n_ports / duration
        score = _clamp(35 + min(n_ports, 100) * 0.4 + min(rate, 50) * 0.5)
        reasons = [
            _reason("Distinct ports probed", f"{n_ports} unique ports on {dst}", 30),
            _reason("Failed connections", f"{len(s['flows'])} unanswered SYN attempts", 20),
            _reason("Scan rate", f"{rate:.0f} ports/second", 20),
        ]
        if dst and is_private_ip(dst):
            reasons.append(_reason("Internal target", f"target {dst} is an internal host", 10))
        results.append(
            RuleResult(
                rule_name="port_scan",
                title=f"Port scan: {src} → {dst} ({n_ports} ports)",
                severity=_severity_for(int(score)),
                score=int(score),
                reasons=reasons,
                evidence={
                    "ports_probed": sorted(s["ports"]),
                    "flow_count": len(s["flows"]),
                    "duration_seconds": round(duration, 2),
                    "ports_per_second": round(rate, 1),
                },
                source_ip=src,
                destination_ip=dst,
                related_flow_ids=[f["_alert_flow_id"] for f in s["flows"][:50]],
                explanation=(
                    f"Host {src} attempted connections to {n_ports} distinct ports on {dst} "
                    f"within {duration:.1f}s with no responses — consistent with a SYN port scan."
                ),
            )
        )
    return results


def rule_beaconing(flows: list[dict]) -> list[RuleResult]:
    """Regular-interval (periodic) connections to the same destination."""
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for f in flows:
        if f["transport_protocol"] != "TCP":
            continue
        groups[(f["source_ip"], f["destination_ip"], f["destination_port"])].append(f)

    results = []
    for (src, dst, dport), group in groups.items():
        if len(group) < 5:
            continue
        times = sorted(f["first_seen"] for f in group)
        intervals = [b - a for a, b in zip(times, times[1:])]
        if not intervals:
            continue
        mean = sum(intervals) / len(intervals)
        variance = sum((i - mean) ** 2 for i in intervals) / len(intervals)
        std = variance ** 0.5
        # periodic = low jitter relative to interval
        if mean <= 0 or std / mean > 0.1:
            continue

        reasons = [
            _reason("Periodic connection pattern", f"{len(times)} connections at ~{mean:.1f}s intervals", 40),
            _reason("Low jitter", f"interval std-dev {std:.2f}s (machine-like regularity)", 25),
            _reason("Repeated destination", f"{dst}:{dport} contacted {len(group)} times", 20),
        ]
        score = _clamp(60 + min(len(group), 40) * 0.5 + 10)  # periodicity alone is strong

        suspicious_port = SUSPICIOUS_PORTS.get(dport)
        if suspicious_port:
            reasons.append(_reason("Suspicious port", f"port {dport} ({suspicious_port})", 10))
            score = _clamp(score + 10)

        results.append(
            RuleResult(
                rule_name="beaconing",
                title=f"Beaconing: {src} → {dst}:{dport} every {mean:.0f}s",
                severity=_severity_for(int(score)),
                score=int(score),
                reasons=reasons,
                evidence={
                    "intervals": [round(i, 3) for i in intervals[:50]],
                    "mean_interval": round(mean, 3),
                    "jitter": round(std, 3),
                    "jitter_ratio": round(std / mean, 4),
                    "connection_count": len(group),
                },
                source_ip=src,
                destination_ip=dst,
                destination_port=dport,
                related_flow_ids=[f["_alert_flow_id"] for f in group[:50]],
                explanation=(
                    f"Host {src} connected to {dst}:{dport} {len(times)} times with machine-precise "
                    f"~{mean:.0f}s intervals (jitter {std:.2f}s). Periodic beacons like this are a "
                    f"hallmark of C2 check-ins or scheduled implants."
                ),
            )
        )
    return results


def rule_dns_tunneling(parsed: ParsedCapture, dns_txns: list[dict]) -> list[RuleResult]:
    """DNS tunneling indicators: long encoded labels + high NXDOMAIN to one domain."""
    by_client: dict[str, dict] = defaultdict(
        lambda: {"queries": [], "max_label": 0, "nxdomain": 0, "unique_subdomains": set()}
    )
    for t in dns_txns:
        if not t["query_name"]:
            continue
        client = t["client_ip"]
        name = t["query_name"].rstrip(".")
        by_client[client]["queries"].append(t)
        labels = name.split(".")
        longest = max(len(l) for l in labels)
        by_client[client]["max_label"] = max(by_client[client]["max_label"], longest)
        # count unique subdomains under the same parent domain
        if len(labels) >= 3:
            parent = ".".join(labels[-3:])
            by_client[client]["unique_subdomains"].add((parent, labels[0]))
        if t["rcode"] == 3:
            by_client[client]["nxdomain"] += 1

    results = []
    for client, d in by_client.items():
        n_queries = len(d["queries"])
        unique_sub = len(d["unique_subdomains"])
        reasons = []
        score = 0
        if d["max_label"] >= 30:
            reasons.append(_reason("Long encoded labels", f"longest DNS label: {d['max_label']} chars", 35))
            score += 35
        if unique_sub >= 10:
            reasons.append(_reason("High subdomain entropy", f"{unique_sub} unique subdomains under one parent", 30)
            )
            score += 30
        if d["nxdomain"] >= 10:
            reasons.append(_reason("High NXDOMAIN rate", f"{d['nxdomain']}/{n_queries} queries returned NXDOMAIN", 15))
            score += 15
        if not reasons:
            continue
        # representative query for evidence
        sample = max(d["queries"], key=lambda t: len(t["query_name"]))
        results.append(
            RuleResult(
                rule_name="dns_tunneling",
                title=f"DNS tunneling indicators from {client}",
                severity=_severity_for(_clamp(score)),
                score=_clamp(score),
                reasons=reasons,
                evidence={
                    "query_count": n_queries,
                    "longest_label_chars": d["max_label"],
                    "unique_subdomains": unique_sub,
                    "nxdomain_count": d["nxdomain"],
                    "sample_query": sample["query_name"][:120],
                },
                source_ip=client,
                destination_ip=sample.get("server_ip"),
                related_packet_refs=[t["packet_ref"] for t in d["queries"][:50]],
                explanation=(
                    f"Host {client} sent {n_queries} DNS queries with encoded-looking labels "
                    f"(longest {d['max_label']} chars) across {unique_sub} unique subdomains — "
                    f"a pattern consistent with DNS tunneling (data exfiltration over DNS)."
                ),
            )
        )
    return results


def rule_nxdomain_burst(dns_txns: list[dict]) -> list[RuleResult]:
    """Excessive NXDOMAIN responses — typo-squat probing, DGA behavior, or scanning."""
    by_client: Counter = Counter()
    total_by_client: Counter = Counter()
    samples: dict[str, list[str]] = defaultdict(list)
    for t in dns_txns:
        if not t["client_ip"]:
            continue
        total_by_client[t["client_ip"]] += 1
        if t["rcode"] == 3:
            by_client[t["client_ip"]] += 1
            if len(samples[t["client_ip"]]) < 10:
                samples[t["client_ip"]].append(t["query_name"][:80])

    results = []
    for client, nx in by_client.items():
        total = total_by_client[client]
        rate = nx / total if total else 0
        if nx < 10:
            continue
        reasons = [
            _reason("High NXDOMAIN volume", f"{nx} failed lookups out of {total}", 30),
            _reason("NXDOMAIN rate", f"{rate * 100:.0f}% of queries fail", 20),
        ]
        score = _clamp(nx * 1.5 + rate * 20)
        results.append(
            RuleResult(
                rule_name="nxdomain_burst",
                title=f"Excessive NXDOMAIN from {client} ({nx} failed lookups)",
                severity=_severity_for(int(score)),
                score=int(score),
                reasons=reasons,
                evidence={"nxdomain_count": nx, "total_queries": total, "rate": round(rate, 3),
                          "sample_domains": samples[client]},
                source_ip=client,
                explanation=(
                    f"Host {client} generated {nx} NXDOMAIN responses ({rate * 100:.0f}% of its DNS "
                    f"traffic). Bursts of failed lookups can indicate DGA malware, typo-squat "
                    f"probing, or DNS reconnaissance."
                ),
            )
        )
    return results


def rule_suspicious_port(flows: list[dict]) -> list[RuleResult]:
    """Connections to ports commonly used by malware/tooling."""
    results = []
    seen: set[tuple] = set()
    for f in flows:
        port = f["destination_port"]
        if port not in SUSPICIOUS_PORTS:
            continue
        key = (f["source_ip"], f["destination_ip"], port)
        if key in seen:
            continue
        seen.add(key)
        reasons = [_reason("Known malware-associated port", f"port {port} ({SUSPICIOUS_PORTS[port]})", 40)]
        if is_private_ip(f["source_ip"]) and not is_private_ip(f["destination_ip"]):
            reasons.append(_reason("Outbound to external host", f"{f['destination_ip']} is external", 15))
        score = _clamp(45 + (15 if len(reasons) > 1 else 0) + min(f["packets"], 20))
        results.append(
            RuleResult(
                rule_name="suspicious_port",
                title=f"Suspicious port: {f['source_ip']} → {f['destination_ip']}:{port}",
                severity=_severity_for(int(score)),
                score=int(score),
                reasons=reasons,
                evidence={"port": port, "association": SUSPICIOUS_PORTS[port],
                          "packets": f["packets"], "bytes": f["bytes"]},
                source_ip=f["source_ip"],
                destination_ip=f["destination_ip"],
                destination_port=port,
                related_flow_ids=[f["_alert_flow_id"]],
                explanation=(
                    f"Host {f['source_ip']} communicated with {f['destination_ip']} on port {port}, "
                    f"commonly associated with {SUSPICIOUS_PORTS[port]}."
                ),
            )
        )
    return results


def rule_excessive_failures(flows: list[dict]) -> list[RuleResult]:
    """Many failed connections to a single destination (not a scan — spread over time/ports)."""
    by_dest: dict[tuple, dict] = defaultdict(lambda: {"failed": 0, "flows": [], "ports": set()})
    for f in flows:
        if not f["failed"]:
            continue
        key = (f["source_ip"], f["destination_ip"])
        by_dest[key]["failed"] += 1
        by_dest[key]["flows"].append(f)
        by_dest[key]["ports"].add(f["destination_port"])

    results = []
    for (src, dst), d in by_dest.items():
        # scans are caught by rule_port_scan; only flag small-port-set failures
        if len(d["ports"]) >= 10:
            continue
        if d["failed"] < 5:
            continue
        score = _clamp(30 + d["failed"] * 5)
        results.append(
            RuleResult(
                rule_name="excessive_connection_failures",
                title=f"Connection failures: {src} → {dst} ({d['failed']} attempts)",
                severity=_severity_for(int(score)),
                score=int(score),
                reasons=[
                    _reason("Repeated failures", f"{d['failed']} failed connections", 30),
                    _reason("Limited port set", f"only {len(d['ports'])} ports involved", 10),
                    _reason("No successful handshake", "no SYN-ACK observed", 15),
                ],
                evidence={"failed_count": d["failed"], "ports": sorted(d["ports"])},
                source_ip=src,
                destination_ip=dst,
                related_flow_ids=[f["_alert_flow_id"] for f in d["flows"][:20]],
                explanation=(
                    f"Host {src} attempted {d['failed']} connections to {dst} on ports "
                    f"{sorted(d['ports'])} without any completing — service outage, blocked "
                    f"firewall rule, or dead destination."
                ),
            )
        )
    return results


def rule_connection_without_dns(flows: list[dict], dns_txns: list[dict]) -> list[RuleResult]:
    """Outbound connections to IPs with no prior DNS resolution (hardcoded C2)."""
    resolved: set[str] = set()
    for t in dns_txns:
        for ip in t.get("response_ips", []):
            resolved.add(ip)

    results = []
    by_dest: dict[tuple, list[dict]] = defaultdict(list)
    for f in flows:
        if f["transport_protocol"] != "TCP":
            continue
        if not (is_private_ip(f["source_ip"]) and not is_private_ip(f["destination_ip"])):
            continue
        if f["destination_ip"] in resolved:
            continue
        if f["destination_port"] == 80:  # plain HTTP often uses IP directly; skip noise
            continue
        by_dest[(f["source_ip"], f["destination_ip"], f["destination_port"])].append(f)

    for (src, dst, dport), group in by_dest.items():
        total_bytes = sum(f["bytes"] for f in group)
        reasons = [
            _reason("No DNS resolution observed", f"{dst} was never resolved by any DNS query", 35),
            _reason("Direct IP connection", f"connection to {dst}:{dport} bypassing DNS", 25),
        ]
        if total_bytes > 10_000:
            reasons.append(_reason("Meaningful data volume", f"{total_bytes} bytes exchanged", 10))
        score = _clamp(50 + min(len(group), 20) + (10 if total_bytes > 10_000 else 0))
        results.append(
            RuleResult(
                rule_name="connection_without_dns",
                title=f"Direct IP connection: {src} → {dst}:{dport} (no DNS)",
                severity=_severity_for(int(score)),
                score=int(score),
                reasons=reasons,
                evidence={"connections": len(group), "bytes": total_bytes,
                          "destination": f"{dst}:{dport}"},
                source_ip=src,
                destination_ip=dst,
                destination_port=dport,
                related_flow_ids=[f["_alert_flow_id"] for f in group[:20]],
                explanation=(
                    f"Host {src} connected to {dst}:{dport} without any DNS lookup resolving it "
                    f"in this capture. Hardcoded destinations are common in malware config."
                ),
            )
        )
    return results


def rule_high_outbound_volume(flows: list[dict]) -> list[RuleResult]:
    """A single host sending an unusually large share of total outbound bytes."""
    internal_flows = [
        f for f in flows
        if is_private_ip(f["source_ip"]) and not is_private_ip(f["destination_ip"])
    ]
    if not internal_flows:
        return []
    total_bytes = sum(f["bytes"] for f in internal_flows)
    if total_bytes < 50_000:  # capture too small to judge
        return []
    by_host: dict[str, int] = defaultdict(int)
    for f in internal_flows:
        by_host[f["source_ip"]] += f["bytes"]

    results = []
    for host, bytes_ in by_host.items():
        share = bytes_ / total_bytes
        if share < 0.7 or bytes_ < 20_000:  # dominant host with meaningful volume
            continue
        results.append(
            RuleResult(
                rule_name="high_outbound_volume",
                title=f"High outbound volume from {host} ({bytes_} bytes)",
                severity=_severity_for(55),
                score=55,
                reasons=[
                    _reason("Dominant outbound traffic", f"{share * 100:.0f}% of all outbound bytes", 30),
                    _reason("Large data volume", f"{bytes_} bytes sent externally", 20),
                ],
                evidence={"bytes": bytes_, "share_of_outbound": round(share, 3), "total_outbound": total_bytes},
                source_ip=host,
                explanation=(
                    f"Host {host} accounts for {share * 100:.0f}% of outbound traffic "
                    f"({bytes_} bytes) — possible data exfiltration or backup activity."
                ),
            )
        )
    return results


# ---------------- Engine ----------------


class SuspicionEngine:
    """Runs all deterministic rules over a capture's normalized artifacts."""

    def run(
        self,
        parsed: ParsedCapture,
        flows: list[dict],
        dns_txns: list[dict],
        id_by_flow: dict[int, str] | None = None,
    ) -> list[dict]:
        """id_by_flow: optional mapping to REAL persisted flow ids (by object identity)."""
        # tag each flow dict with its persisted id so rules can cross-reference
        for i, f in enumerate(flows):
            f["_alert_flow_id"] = f.get("_db_id") or (
                id_by_flow.get(id(f)) if id_by_flow else None
            ) or f"flowidx-{i}"

        results: list[RuleResult] = []
        results += rule_port_scan(flows)
        results += rule_beaconing(flows)
        results += rule_dns_tunneling(parsed, dns_txns)
        results += rule_nxdomain_burst(dns_txns)
        results += rule_suspicious_port(flows)
        results += rule_excessive_failures(flows)
        results += rule_connection_without_dns(flows, dns_txns)
        results += rule_high_outbound_volume(flows)

        alert_dicts = []
        for r in results:
            d = r.to_dict()
            first_flow = next(
                (f for f in flows if f["_alert_flow_id"] in (r.related_flow_ids or [])), None
            )
            d["timestamp"] = first_flow["first_seen"] if first_flow else (
                dns_txns[0]["timestamp"] if dns_txns else None
            )
            alert_dicts.append(d)
        alert_dicts.sort(key=lambda a: -a["score"])
        return alert_dicts

    @staticmethod
    def augment_hosts(host_dicts: list[dict], alert_dicts: list[dict]) -> None:
        """Attach alert counts to host profiles (suspicious behaviors per host)."""
        by_host: Counter = Counter()
        by_host_high: Counter = Counter()
        for a in alert_dicts:
            if a.get("source_ip"):
                by_host[a["source_ip"]] += 1
                if a["severity"] in ("high", "critical"):
                    by_host_high[a["source_ip"]] += 1
        for h in host_dicts:
            h["behavior_summary"] = dict(h.get("behavior_summary") or {})
            h["behavior_summary"]["alert_count"] = by_host.get(h["ip"], 0)
            h["behavior_summary"]["high_severity_alert_count"] = by_host_high.get(h["ip"], 0)
