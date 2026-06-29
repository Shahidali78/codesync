# ── Stage 1: compile the runner binary ──────────────────────────────────────
FROM ubuntu:22.04 AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends g++ && \
    rm -rf /var/lib/apt/lists/*

COPY runner.cpp /src/runner.cpp
RUN g++ -O2 -std=c++17 -o /runner /src/runner.cpp && \
    strip /runner

# ── Stage 2: runtime image ───────────────────────────────────────────────────
FROM ubuntu:22.04

# Install the language runtimes needed to execute user code
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        g++ \
        python3 \
        nodejs && \
    rm -rf /var/lib/apt/lists/*

# Verify toolchain versions so the image build fails loudly if anything is missing
RUN g++ --version && python3 --version && node --version

# /sandbox is created here as an anchor point; Docker mounts a fresh tmpfs
# over it at runtime (--tmpfs /sandbox:size=32m,mode=1777), so it is always
# empty and fully writable by nobody.
RUN mkdir -p /sandbox && chmod 1777 /sandbox

# Copy the pre-built runner binary
COPY --from=builder /runner /usr/local/bin/runner
RUN chmod 755 /usr/local/bin/runner

# Default user — overridden by --user nobody in the docker run command,
# but declaring it here makes accidental un-sandboxed runs safer.
USER nobody

ENTRYPOINT ["/usr/local/bin/runner"]
