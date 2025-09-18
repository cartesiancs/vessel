FROM rust:latest AS builder

RUN apt-get update && apt-get install -y cmake build-essential libglib2.0-dev pkg-config musl-tools libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev python3-dev

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY package*.json ./

RUN npm install

COPY ./apps ./apps

WORKDIR /app/apps/client

RUN npm install

WORKDIR /app/apps/server

RUN cargo build --release

WORKDIR /app

CMD ["npm", "run", "server:prod"]