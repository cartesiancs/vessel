<p align='center'>
<img src='.github/icon.png' width='210' />
<h1 align='center'>Vessel</h1>
<p align='center'>The open source alternative to Anduril for self-defence</p>
</p>

<p align='center'>
<a href="https://github.com/cartesiancs/vessel/blob/main/LICENSE"><img src="https://img.shields.io/github/license/cartesiancs/vessel?style=for-the-badge" /></a>
<a href="https://github.com/cartesiancs/vessel/stargazers"><img src="https://img.shields.io/github/stars/cartesiancs/vessel?style=for-the-badge" /></a>
<a href="https://github.com/cartesiancs/vessel/issues"><img src="https://img.shields.io/github/issues/cartesiancs/vessel?style=for-the-badge" /></a>
</p>

<p align='center'>
<a href="https://vessel.cartesiancs.com/">Visit Website</a> · <a href="https://github.com/cartesiancs/vessel/issues">Report Bugs</a> · <a href="https://vessel.cartesiancs.com/docs/introduction">Docs</a>
</p>

## About The Project

![banner](./.github/banner.png)

Vessel is the **C2 (Command & Control) software** for connecting, monitoring, and orchestrating arrays of physical sensors via an intuitive, visual flow-based interface.

This project is to build a "proactive security system". To achieve this, the following three functions are necessary:

1. **Connect** to Physical Device
2. **Detect** Threats
3. **Control** and Respond

This project solves the problems with existing **home security systems**. Current systems fail to protect against burglaries, trespassing, theft—and even war.

So we plan to open-source the technology used in existing defense systems.

This system allows you to analyze video and audio sources with AI/ML technology. And automate actions through Flow-based operations. The Flow provides the flexibility to select multiple AI models and connect them directly to stream sources.

When everything is implemented, individuals will be able to protect themselves from any threats.

> [!NOTE]
> 🚧 <strong>This project is under active development.</strong> Some features may be unstable or subject to change without notice.

## Features

- Connect all sensers (MQTT, RTP, RTSP, HTTP, ...)
- RTP Audio & Video Streaming
- RTSP Video Streaming
- Flow Visual Logic
- Pub/Sub MQTT with Flow
- Map based UI
- Home Assistant Integration

## Develop

Get your local copy up and running.

#### Prerequisites

- [Rust](https://www.rust-lang.org/) & Cargo
- [Node.js](https://nodejs.org/en/) (v18+) and npm
- [gstreamer](https://gstreamer.freedesktop.org/documentation/rust/git/docs/gstreamer/index.html)
- [python3.12+](https://www.python.org/)
- [mosquitto (MQTT)](https://mosquitto.org/) (additional)

#### 1. Server Setup

```bash
# 1. Clone the repository
git clone https://github.com/cartesiancs/vessel.git
cd vessel/apps/server

# 2. Copy and configure environment variables
cp .env.example .env
# nano .env (Modify if needed)

# 3. Run database migrations
diesel setup
diesel migration run

# 4. Run the server
cargo run
```

#### 2. Client Setup

```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run client
```

## Compile

This command compiles the entire project, including both the server and the client, into a single executable file.

```bash
npm run build
```

The compiled binary, named 'server', will be located in the target/release directory.

> To run the server executable, you must have a .env file in the same directory (target/release).

## Roadmap

Please visit our Roadmap page below:

[Roadmap Page >](https://vessel.cartesiancs.com/roadmap)

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated.

Please refer to our [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Contributors

 <a href = "https://github.com/cartesiancs/vessel/graphs/contributors">
   <img src = "https://contrib.rocks/image?repo=cartesiancs/vessel"/>
 </a>

## License

Distributed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.

## Disclaimer

This project is intended for academic and research purposes only. It is designed to facilitate the connection and control of physical devices. All responsibility for its use lies with the user.
