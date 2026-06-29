# runner — C++ Execution Sandbox

## Build image
```bash
docker build -t codesync-runner .
```

The Spring Boot API spawns a fresh container per execution with:
- `--network none`
- `--memory=256m --cpus=0.5`
- read-only root filesystem + writable `/sandbox` scratch dir
- non-root user
- `setrlimit` caps on processes, file size, and output bytes
- hard wall-clock timeout (killed by the API, not by the container itself)

## Supported languages (Phase 4)
- C++ (g++)
- Python 3
- JavaScript (Node.js)
