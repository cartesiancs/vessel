# Build stage
FROM rust:1.75-alpine AS builder

# 빌드 의존성 설치
RUN apk add --no-cache musl-dev pkgconfig openssl-dev

WORKDIR /app

# 의존성 캐싱을 위해 Cargo 파일 먼저 복사
COPY Cargo.toml Cargo.lock* ./

# 더미 소스로 의존성 빌드 (캐싱)
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# 실제 소스 복사 및 빌드
COPY src ./src
RUN touch src/main.rs && cargo build --release

# Runtime stage
FROM alpine:3.19

# 보안: non-root 사용자 생성
RUN addgroup -g 1001 enclave && \
    adduser -u 1001 -G enclave -s /bin/sh -D enclave

# 런타임 의존성
RUN apk add --no-cache ca-certificates

WORKDIR /app

# 빌드된 바이너리 복사
COPY --from=builder /app/target/release/enclave .

# 소유권 변경
RUN chown -R enclave:enclave /app

# non-root로 실행
USER enclave

# 포트 노출
EXPOSE 3000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# 환경 변수
ENV RUST_LOG=info
ENV PORT=3000

# 실행
CMD ["./enclave"]
