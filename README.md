<p align='center'>
<img src='.github/icon.png' width='210' />
<h1 align='center'>Vessel</h1>
<p align='center'>Physical Device Orchestration Platform for Self Defence</p>
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

Vessel is the C2 (Command & Control) software. It empowers you to connect, monitor, and orchestrate a wide array of physical sensors through an intuitive, visual flow-based interface.

This project is to build a "proactive security system."

To achieve this, the following three functions are necessary:

1. Physical device **Connection**
2. Threat **Detect**
3. Device **Control**

This project solves the problems with existing **home security systems**. Current systems fail to protect against burglaries, trespassing, theft—and even war.

So we plan to open-source the technology used in existing defense systems.

We are developing "surveillance technology" and "active drone control systems" that have been used for border defense. And if humanoid technology is perfected, we will apply that as well.

When everything is implemented, individuals will be able to create a medieval-level army.

> [!NOTE]
> 🚧 <strong>This project is under active development.</strong> Some features may be unstable or subject to change without notice.

## Features

- Connect all sensers (MQTT, RTP, RTSP)
- RTP Audio Streaming
- RTSP Video Streaming
- Flow Visual Logic
- Map based UI

## Develop

Get your local copy up and running.

#### Prerequisites

- [Rust](https://www.rust-lang.org/) & Cargo
- [Node.js](https://nodejs.org/en/) (v18+) and npm
- [gstreamer](https://gstreamer.freedesktop.org/)
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

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated.

Please refer to our [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Contributors

 <a href = "https://github.com/cartesiancs/vessel/graphs/contributors">
   <img src = "https://contrib.rocks/image?repo=cartesiancs/vessel"/>
 </a>

## License

Distributed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
