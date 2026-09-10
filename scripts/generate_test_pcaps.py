#!/usr/bin/env python3
"""Deterministic synthetic PCAP generator for TrafficLens.

Every scenario is reproducible: fixed seeds, fixed timestamps, fixed hosts.
Output PCAPs are byte-stable given the same Scapy version.

Usage:
    python scripts/generate_test_pcaps.py --out test-data/synthetic
"""
from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

from scapy.all import IP, Ether, TCP, UDP, wrpcap
from scapy.layers.dns import DNS, DNSQR, DNSRR

BASE_TS = 1717252200.0

HOSTS = {
    "workstation": "192.168.1.42",
    "web_server": "192.168.1.25",
    "dns_server": "192.168.1.1",
    "ext_web": "93.184.216.34",
    "ext_api": "140.82.121.6",
    "suspicious": "185.234.72.19",
    "cdn": "151.101.1.69",
}

MAC_LOCAL = "aa:bb:cc:dd:ee:01"
MAC_REMOTE = "aa:bb:cc:dd:ee:02"


def _eth(src_ip: str) -> "Ether":
    """Ether header with deterministic MACs (local nets get MAC_LOCAL, others MAC_REMOTE)."""
    mac = MAC_LOCAL if src_ip.startswith("192.168.") else MAC_REMOTE
    return Ether(src=mac, dst=MAC_REMOTE if mac == MAC_LOCAL else MAC_LOCAL)


_ip_id_counter = iter(range(1, 65535))


def _ip(src: str, dst: str) -> "IP":
    return IP(src=src, dst=dst, id=next(_ip_id_counter))


def dns_query(ts: float, src: str, dst: str, name: str, txid: int) -> "Ether":
    return _eth(src) / _ip(src, dst) / UDP(sport=33333, dport=53) / DNS(
        id=txid, qr=0, qd=DNSQR(qname=name)
    )


def dns_response(ts: float, src: str, dst: str, name: str, txid: int, rcode: int = 0) -> "Ether":
    return _eth(src) / _ip(src, dst) / UDP(sport=53, dport=33333) / DNS(
        id=txid, qr=1, rd=1, ra=1, rcode=rcode, qd=DNSQR(qname=name),
        an=DNSRR(rrname=name, ttl=60, rdata="1.2.3.4") if rcode == 0 else None,
    )


def tcp_syn(ts: float, src: str, dst: str, sport: int, dport: int, seq: int = 1000) -> "Ether":
    pkt = _eth(src) / _ip(src, dst) / TCP(sport=sport, dport=dport, flags="S", seq=seq)
    pkt.time = ts
    return pkt


def tcp_synack(ts: float, src: str, dst: str, sport: int, dport: int, seq: int = 2000, ack: int = 1001) -> "Ether":
    pkt = _eth(src) / _ip(src, dst) / TCP(sport=sport, dport=dport, flags="SA", seq=seq, ack=ack)
    pkt.time = ts
    return pkt


def tcp_ack(ts: float, src: str, dst: str, sport: int, dport: int, seq: int, ack: int, payload: bytes = b"") -> "Ether":
    pkt = _eth(src) / _ip(src, dst) / TCP(sport=sport, dport=dport, flags="PA", seq=seq, ack=ack) / payload
    pkt.time = ts
    return pkt


def tcp_rst(ts: float, src: str, dst: str, sport: int, dport: int) -> "Ether":
    pkt = _eth(src) / _ip(src, dst) / TCP(sport=sport, dport=dport, flags="R", seq=3000)
    pkt.time = ts
    return pkt


def http_req(ts: float, src: str, dst: str, sport: int, host: str, path: str = "/", ua: str = "Mozilla/5.0 (X11; Linux x86_64)", seq: int = 1000) -> "Ether":
    payload = f"GET {path} HTTP/1.1\r\nHost: {host}\r\nUser-Agent: {ua}\r\nAccept: */*\r\n\r\n".encode()
    pkt = _eth(src) / _ip(src, dst) / TCP(sport=sport, dport=80, flags="PA", seq=seq) / payload
    pkt.time = ts
    return pkt


def http_resp(ts: float, src: str, dst: str, sport: int, status: int = 200, seq: int = 2000, body: bytes = b"<html>ok</html>") -> "Ether":
    payload = f"HTTP/1.1 {status} {'OK' if status==200 else 'ERROR'}\r\nServer: nginx/1.24\r\nContent-Length: {len(body)}\r\n\r\n".encode() + body
    pkt = _eth(src) / _ip(src, dst) / TCP(sport=80, dport=sport, flags="PA", seq=seq) / payload
    pkt.time = ts
    return pkt


def _tls_client_hello(server_name: str) -> bytes:
    """Deterministic TLS ClientHello with SNI extension (minimal, spec-shaped)."""
    import struct
    name = server_name.encode()
    sni_body = struct.pack(">HBH", len(name) + 3, 0, len(name)) + name
    ext = struct.pack(">HH", 0, len(sni_body)) + sni_body
    ch_body = b"\x03\x01" + b"\x41" * 32 + b"\x00" + b"\x00\x02\x13\x01" + b"\x01\x00" + struct.pack(">H", len(ext)) + ext
    hs = b"\x01" + struct.pack(">I", len(ch_body))[1:] + ch_body  # handshake header
    return b"\x16\x03\x01" + struct.pack(">H", len(hs)) + hs  # TLS record


def tls_clienthello(ts: float, src: str, dst: str, sport: int, dport: int, server_name: str, seq: int = 1000) -> "Ether":
    pkt = _eth(src) / _ip(src, dst) / TCP(sport=sport, dport=dport, flags="PA", seq=seq) / _tls_client_hello(server_name)
    pkt.time = ts
    return pkt


def tls_server_hello(ts: float, src: str, dst: str, sport: int, dport: int, seq: int = 2000) -> "Ether":
    pkt = _eth(src) / _ip(src, dst) / TCP(sport=dport, dport=sport, flags="PA", seq=seq) / b"\x16\x03\x03\x00\x02\x02\x00"
    pkt.time = ts
    return pkt


def _set_times(packets, start_ts: float, interval: float) -> list:
    for i, pkt in enumerate(packets):
        pkt.time = start_ts + i * interval
    return packets


def scenario_normal_traffic() -> list:
    """Benign browsing: DNS + plain HTTP + HTTPS/TLS to a handful of common domains."""
    pkts = []
    ws, dns_srv, ext, cdn = HOSTS["workstation"], HOSTS["dns_server"], HOSTS["ext_web"], HOSTS["cdn"]
    for i, domain in enumerate(["example.com", "github.com", "wikipedia.org"]):
        ts = BASE_TS + i * 20
        sport = 51000 + i
        dns_sport = 33400 + i

        pkt_q = _eth(ws) / _ip(ws, dns_srv) / UDP(sport=dns_sport, dport=53) / DNS(id=1000 + i, qr=0, qd=DNSQR(qname=domain))
        pkt_r = _eth(dns_srv) / _ip(dns_srv, ws) / UDP(sport=53, dport=dns_sport) / DNS(id=1000 + i, qr=1, rd=1, ra=1, an=DNSRR(rrname=domain, ttl=60, rdata="93.184.216.34"))
        pkt_q.time = ts
        pkt_r.time = ts + 0.02
        pkts += [pkt_q, pkt_r]
        if i < 2:

            http_sport = 52000 + i
            pkts.append(http_req(ts + 0.05, ws, ext, http_sport, domain, ua="Mozilla/5.0 (X11; Linux x86_64) TrafficLensTest/1.0"))
            pkts.append(http_resp(ts + 0.06, ext, ws, http_sport, status=200 if i == 0 else 404, body=(b"<html>hello</html>" if i == 0 else b"not found")))
        else:
            tls_sport = 53000 + i
            pkts.append(tls_clienthello(ts + 0.05, ws, ext, tls_sport, 443, domain))
            pkts.append(tls_server_hello(ts + 0.06, ext, ws, tls_sport, 443))
    pkts.sort(key=lambda p: float(p.time))
    return pkts


def scenario_port_scan() -> list:
    """SYN scan: one host probing many ports on a single target."""
    pkts = []
    attacker, target = HOSTS["workstation"], HOSTS["web_server"]
    for port in range(20, 120):
        pkts.append(tcp_syn(BASE_TS + port * 0.01, attacker, target, 40000, port))
    return _set_times(pkts, BASE_TS, 0.01)


def scenario_dns_tunneling() -> list:
    """DNS tunneling indicators: many long TXT-ish queries to one suspect domain."""
    pkts = []
    ws, dns_srv = HOSTS["workstation"], HOSTS["dns_server"]
    rng = random.Random(42)
    for i in range(64):
        sport = 33400 + (i % 8)  
        label = "".join(rng.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=40))
        name = f"{label}.tunnel.example.net"
        pkt_q = _eth(ws) / _ip(ws, dns_srv) / UDP(sport=sport, dport=53) / DNS(id=2000 + i, qr=0, qd=DNSQR(qname=name))
        pkt_r = _eth(dns_srv) / _ip(dns_srv, ws) / UDP(sport=53, dport=sport) / DNS(id=2000 + i, qr=1, rcode=3, qd=DNSQR(qname=name))
        pkt_q.time = BASE_TS + i * 0.5
        pkt_r.time = BASE_TS + i * 0.5 + 0.1
        pkts.append(pkt_q)
        pkts.append(pkt_r)
    return pkts


def scenario_c2_beacon() -> list:
    """Periodic beaconing: regular-interval connections to a rare destination on 4444."""
    pkts = []
    ws, c2 = HOSTS["workstation"], HOSTS["suspicious"]
    for i in range(40):
        ts = BASE_TS + i * 30.0  # exactly every 30s — beacon pattern
        # each beacon is its own connection: unique source port per cycle
        sport = 44440 + i
        pkts.append(tcp_syn(ts, ws, c2, sport, 4444, seq=5000))
        pkts.append(tcp_synack(ts + 0.05, c2, ws, 4444, sport, seq=6000, ack=5001))
        pkts.append(tcp_ack(ts + 0.06, ws, c2, sport, 4444, seq=5001, ack=6001, payload=b"\x00\x01beacon"))
    pkts.sort(key=lambda p: float(p.time))
    return pkts


def scenario_tcp_problems() -> list:
    """TCP issues: handshake, retransmitted SYN, reset, refused connection, failures."""
    pkts = []
    ws, ext = HOSTS["workstation"], HOSTS["ext_web"]
    # 1) established flow with a data retransmission (seq goes backwards)
    pkts.append(tcp_syn(BASE_TS, ws, ext, 51000, 80, seq=1000))
    pkts.append(tcp_synack(BASE_TS + 1.0, ext, ws, 80, 51000, seq=2000, ack=1001))
    pkts.append(tcp_ack(BASE_TS + 1.1, ws, ext, 51000, 80, seq=1001, ack=2001, payload=b"DATA-1" * 20))
    pkts.append(tcp_ack(BASE_TS + 1.2, ws, ext, 51000, 80, seq=1121, ack=2001, payload=b"DATA-2" * 20))
    pkts.append(tcp_ack(BASE_TS + 1.3, ws, ext, 51000, 80, seq=1001, ack=2001, payload=b"DATA-1" * 20))  # retransmission
    # 2) SYN retransmission then success
    pkts.append(tcp_syn(BASE_TS + 5, ws, ext, 51001, 80, seq=3000))
    pkts.append(tcp_syn(BASE_TS + 6, ws, ext, 51001, 80, seq=3000))  # SYN retransmit
    pkts.append(tcp_synack(BASE_TS + 7, ext, ws, 80, 51001, seq=4000, ack=3001))
    # 3) reset flow (refused)
    pkts.append(tcp_syn(BASE_TS + 10, ws, ext, 51002, 8080, seq=5000))
    pkts.append(tcp_rst(BASE_TS + 10.1, ext, ws, 8080, 51002))
    # 4) failed connections (SYN, no answer)
    for i in range(5):
        pkts.append(tcp_syn(BASE_TS + 20 + i, ws, ext, 51003 + i, 81, seq=7000 + i))
    pkts.sort(key=lambda p: float(p.time))
    return pkts


SCENARIOS = {
    "normal_traffic.pcap": scenario_normal_traffic,
    "port_scan.pcap": scenario_port_scan,
    "dns_tunneling.pcap": scenario_dns_tunneling,
    "c2_beacon.pcap": scenario_c2_beacon,
    "tcp_problems.pcap": scenario_tcp_problems,
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default="test-data/synthetic", help="output directory")
    ap.add_argument("--only", default=None, help="generate only a named scenario")
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    for name, builder in SCENARIOS.items():
        if args.only and args.only not in name:
            continue
        packets = builder()
        path = out_dir / name
        wrpcap(str(path), packets)
        print(f"  wrote {path} ({len(packets)} packets)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
