package com.codesync.api.service;

import com.codesync.api.dto.*;
import com.codesync.api.entity.*;
import com.codesync.api.exception.ResourceNotFoundException;
import com.codesync.api.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExecutionService {

    private final ExecutionLogRepository logRepository;
    private final UserRepository         userRepository;
    private final SessionRepository      sessionRepository;

    @Value("${runner.image}")
    private String runnerImage;

    @Value("${runner.timeout-seconds}")
    private int timeoutSeconds;

    @Value("${runner.memory}")
    private String memory;

    @Value("${runner.cpus}")
    private String cpus;

    // ── Public API ───────────────────────────────────────────────────────────

    @Transactional
    public ExecutionResponse execute(ExecutionRequest req, String username)
            throws IOException, InterruptedException {

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Session session = null;
        if (req.getSessionId() != null) {
            session = sessionRepository.findByIdAndActiveTrue(req.getSessionId()).orElse(null);
        }

        long start = System.currentTimeMillis();
        ExecutionResponse result = runInContainer(req.getLanguage(), req.getCode());
        long duration = System.currentTimeMillis() - start;
        result.setDurationMs(duration);

        logRepository.save(ExecutionLog.builder()
                .user(user)
                .session(session)
                .language(req.getLanguage())
                .code(req.getCode())
                .stdout(result.getStdout())
                .stderr(result.getStderr())
                .exitCode(result.getExitCode())
                .durationMs(duration)
                .build());

        return result;
    }

    // ── Container execution ──────────────────────────────────────────────────

    private ExecutionResponse runInContainer(String language, String code)
            throws IOException, InterruptedException {

        List<String> cmd = buildDockerCommand(language);
        log.debug("Runner command: {}", cmd);

        Process process = new ProcessBuilder(cmd)
                .redirectErrorStream(false)
                .start();

        // Capture buffers — must be final for lambdas
        var stdoutBuf = new ByteArrayOutputStream();
        var stderrBuf = new ByteArrayOutputStream();

        // Read stdout and stderr on virtual threads to prevent pipe-buffer
        // deadlocks when the program produces large output.
        Thread stdoutReader = Thread.ofVirtual().start(() -> {
            try { process.getInputStream().transferTo(stdoutBuf); }
            catch (IOException ignored) {}
        });
        Thread stderrReader = Thread.ofVirtual().start(() -> {
            try { process.getErrorStream().transferTo(stderrBuf); }
            catch (IOException ignored) {}
        });

        // Write code to stdin on a virtual thread so we don't block the
        // reader threads above (the child reads stdin only after we send it).
        Thread stdinWriter = Thread.ofVirtual().start(() -> {
            try (var writer = new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8)) {
                writer.write(code);
            } catch (IOException ignored) {}
        });

        boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);

        if (!finished) {
            process.destroyForcibly();
            // Drain any partial output that arrived before the kill
            stdinWriter.join(500);
            stdoutReader.join(2000);
            stderrReader.join(2000);
            return ExecutionResponse.builder()
                    .stdout(truncate(stdoutBuf.toString(StandardCharsets.UTF_8), 65_536))
                    .stderr("Execution timed out after " + timeoutSeconds + " seconds")
                    .exitCode(124)
                    .build();
        }

        stdinWriter.join(1_000);
        stdoutReader.join(5_000);
        stderrReader.join(5_000);

        return ExecutionResponse.builder()
                .stdout(truncate(stdoutBuf.toString(StandardCharsets.UTF_8), 65_536))
                .stderr(truncate(stderrBuf.toString(StandardCharsets.UTF_8), 65_536))
                .exitCode(process.exitValue())
                .build();
    }

    // ── Docker command builder ───────────────────────────────────────────────

    /**
     * Builds a hardened `docker run` command for the sandbox container.
     *
     * Security layers:
     *   --network none              no network access
     *   --memory / --cpus           hard resource caps
     *   --read-only                 immutable root FS
     *   --tmpfs /sandbox:mode=1777  writable scratch dir only (nobody-accessible)
     *   --tmpfs /tmp:mode=1777      g++ needs /tmp for compilation artefacts
     *   --user nobody               unprivileged UID 65534
     *   --pids-limit                PID cap alongside setrlimit NPROC in runner
     *   --cap-drop ALL              no Linux capabilities
     *   --security-opt no-new-privileges  prevent privilege escalation via setuid
     */
    private List<String> buildDockerCommand(String language) {
        return new ArrayList<>(List.of(
                "docker", "run",
                "--rm",
                "--interactive",
                "--network",      "none",
                "--memory",       memory,
                "--cpus",         cpus,
                "--read-only",
                "--tmpfs",        "/sandbox:size=32m,mode=1777",
                "--tmpfs",        "/tmp:size=64m,mode=1777",
                "--workdir",      "/sandbox",
                "--user",         "nobody",
                "--pids-limit",   "64",
                "--cap-drop",     "ALL",
                "--security-opt", "no-new-privileges=true",
                runnerImage,
                language          // passed as argv[1] to the runner binary
        ));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max) + "\n[output truncated]";
    }
}
