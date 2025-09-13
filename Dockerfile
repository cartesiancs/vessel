FROM rust:latest AS builder

RUN apt-get update && apt-get install -y libglib2.0-dev pkg-config musl-tools libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev python3-dev

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY package*.json ./

RUN npm install

COPY ./apps ./apps
RUN cargo build --release

CMD ["npm", "run", "server:prod"]