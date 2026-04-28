#!/usr/bin/env python3
"""L6 — Malformed and unknown-SSRC RTP flood.

Sends a mix of (a) packets with valid RTP headers but random SSRCs that aren't
registered with the server, and (b) raw random bytes. Both should be discarded
by the receiver path in apps/server/src/media/rtp_push.rs without taking the
task down or growing memory.

Usage:
    gen-malformed.py --duration 120 [--rate 5000]
"""

import argparse
import os
import random
import socket
import struct
import sys
import time


def make_rtp_packet(ssrc: int, seq: int, timestamp: int) -> bytes:
    # RFC 3550: V=2, P=0, X=0, CC=0, M=0, PT=96
    first = (2 << 6) | 0
    second = 96
    header = struct.pack("!BBHII", first, second, seq & 0xFFFF, timestamp & 0xFFFFFFFF, ssrc & 0xFFFFFFFF)
    payload = os.urandom(random.randint(64, 1200))
    return header + payload


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default=os.environ.get("VESSEL_LISTEN_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("VESSEL_RTP_PORT", "5004")))
    parser.add_argument("--duration", type=int, default=120)
    parser.add_argument("--rate", type=int, default=5000, help="packets per second total")
    args = parser.parse_args()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setblocking(False)

    deadline = time.time() + args.duration
    interval = 1.0 / max(args.rate, 1)
    seq = 0
    ts = 0
    sent = 0
    print(f"[rtp-malformed] {args.host}:{args.port} for {args.duration}s at ~{args.rate} pps", flush=True)

    while time.time() < deadline:
        if random.random() < 0.5:
            # Unknown-SSRC valid packets
            ssrc = random.randint(0x1_0000_0000 - 1, 0xFFFFFFFF)
            pkt = make_rtp_packet(ssrc, seq, ts)
        else:
            # Random garbage
            pkt = os.urandom(random.randint(8, 1400))
        try:
            sock.sendto(pkt, (args.host, args.port))
            sent += 1
        except (BlockingIOError, OSError):
            pass
        seq += 1
        ts += 3000
        time.sleep(interval)

    print(f"[rtp-malformed] sent {sent} packets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
