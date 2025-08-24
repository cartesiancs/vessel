# Vessel

### Self-defense system powered by physical device orchestration and automation.

<div style="text-align:center;align-items: center;justify-content: center;display: flex; padding-bottom: 50px;">

<img src="/icon.png" alt="My Image" width="300">
</div>

The open-source alternative to Anduril for **home protection**.

Vessel is an open-source platform that allows you to connect, orchestrate, and automate multiple physical sensors for proactive security and asset management. We aim to bring the power of a command and control (C2) system, traditionally used in military applications, to your home, farm, or small factory.

Our goal is to empower individuals to build their own intelligent security systems, moving from passive monitoring to active, automated response.

## Vision

We believe in a future where you are not dependent on large corporations for your physical security. Vessel provides the tools to build a truly independent and customizable security platform.

## Key Features

- **Visual Flow Editor**: Easily design complex automation workflows using a drag-and-drop interface powered by React Flow. Connect sensors to processors and actions to create custom logic (e.g., "If the microphone detects a sound louder than 80dB, turn on the porch light via Home Assistant").
- **Device Management**: Register and manage your sensor devices. Monitor real-time data streams from each device.
- **Broad Sensor Compatibility**: Vessel is designed to support a wide range of sensors, from simple temperature and motion detectors to complex devices like GPS, IMU, cameras, and microphones.
- **Real-time Communication**: Utilizes UDP, SRTP, MQTT, and WebRTC for low-latency communication between Devices, the server, and the client.
- **Extensible Architecture**: Built with a modular structure, allowing for the future integration of new devices (like drones and LoRaWAN), AI analysis servers, and custom actions.

## Target Audience

Vessel is for the **proactive problem-solver** who is comfortable with DIY projects and wants to take control of their personal security. Our ideal user is:

- A homeowner in a rural area in the U.S.
- Tech-savvy and interested in home automation.
- Desires a sense of control and immediate feedback from their security system.
- May also be a small business owner managing assets like a small factory or farm.

### Communication Protocols

- **Devices <-> Server**: UDP, SRTP (for secure real-time audio/video), mTLS, MQTT
- **Server <-> Client**: HTTP, WebSocket, WebRTC

## Roadmap

We are currently in the Proof of Concept (POC) phase and have completed the core flow engine, device management, and real-time data transfer.

### Next Steps

1.  **Home Assistant (HA) Integration**: Connect Vessel flows to control HA entities.
2.  **Package Distribution**: Publish packages for easier deployment.
3.  **Video Stream Support**: Add support for RTSP video streams from IP cameras.
4.  **Agentic AI Missions**: Implement a higher-level AI to manage and execute complex tasks.
5.  **Hardware Prototypes**: Develop custom hardware.
