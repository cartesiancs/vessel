# Concept

Vessel is an open-source orchestration platform for physical security and automation, designed to function as a Civilian Command & Control (C2) system.

The project's ultimate goal is to provide a powerful, customizable, and independent alternative to proprietary systems, giving individuals direct control over their personal assets.

## Flow

Utilizes a flow based UI to build automation workflows by visually connecting nodes: Sensor (Input) → Logic (Process) → Device (Action). This allows for complex, code-free rule creation.

## Device-Server-Client Architecture

Edge devices: (e.g., Raspberry Pi) that gather data from various sensors (audio, video, GPS, etc.).

Server: A central Rust-based backend that manages devices, processes data streams, and executes flows.

Client: A web application that serves as the main dashboard for monitoring, device management, and flow creation.

## Open & Extensible Stack

Core Tech: React, TypeScript, Rust, MQTT, WebRTC, and UDP.

Philosophy: Built on open-source principles to ensure high customizability and prevent platform lock-in, allowing for the integration of any sensor or external API.
