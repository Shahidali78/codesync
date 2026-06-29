/**
 * CodeSync sandboxed runner
 *
 * Usage (inside the container):
 *   runner <language>        language: cpp | python | javascript
 *   stdin: source code
 *   stdout/stderr: program output
 *   exit code: program exit code (124 = wall-clock timeout)
 *
 * Security layers applied to every child process:
 *   RLIMIT_CPU   — CPU-time cap (belt-and-suspenders alongside Docker)
 *   RLIMIT_NPROC — fork-bomb protection
 *   RLIMIT_FSIZE — cap file writes inside /sandbox
 *   RLIMIT_AS    — virtual-address-space cap
 *
 * Wall-clock timeouts are enforced with SIGALRM in the parent, on top of
 * Docker's --stop-timeout enforced by the Spring Boot API.
 */

#include <cerrno>
#include <csignal>
#include <cstring>
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>
#include <vector>

#include <sys/resource.h>
#include <sys/wait.h>
#include <unistd.h>

// ── Resource limits (applied inside each forked child) ───────────────────────

static constexpr rlim_t LIM_CPU_SECS = 8;              // CPU seconds
static constexpr rlim_t LIM_NPROC    = 32;             // max processes
static constexpr rlim_t LIM_FSIZE    = 16ULL << 20;    // 16 MB per-file write cap
static constexpr rlim_t LIM_AS       = 256ULL << 20;   // 256 MB virtual memory

static void apply_child_limits() noexcept {
    auto cap = [](int resource, rlim_t value) noexcept {
        struct rlimit rl{value, value};
        setrlimit(resource, &rl);
    };
    cap(RLIMIT_CPU,   LIM_CPU_SECS);
    cap(RLIMIT_NPROC, LIM_NPROC);
    cap(RLIMIT_FSIZE, LIM_FSIZE);
    cap(RLIMIT_AS,    LIM_AS);
}

// ── SIGALRM bookkeeping ──────────────────────────────────────────────────────

static volatile sig_atomic_t g_timed_out = 0;
static void on_alarm(int) noexcept { g_timed_out = 1; }

// ── Child runner ─────────────────────────────────────────────────────────────

/**
 * Fork, exec argv[0..], wait up to wall_secs seconds.
 * Returns the child's exit code, or 124 on wall-clock timeout.
 */
static int run_child(const std::vector<const char*>& argv, unsigned wall_secs) {
    pid_t pid = ::fork();
    if (pid < 0) {
        std::cerr << "[Runner] fork: " << std::strerror(errno) << "\n";
        return 1;
    }

    if (pid == 0) {
        // Child: apply limits then exec
        apply_child_limits();
        ::execvp(argv[0], const_cast<char* const*>(argv.data()));
        std::cerr << "[Runner] exec '" << argv[0] << "': " << std::strerror(errno) << "\n";
        ::_exit(127);
    }

    // Parent: install alarm for wall-clock enforcement
    g_timed_out = 0;
    ::signal(SIGALRM, on_alarm);
    ::alarm(wall_secs);

    int status = 0;
    while (::waitpid(pid, &status, 0) == -1) {
        if (errno != EINTR) {
            std::cerr << "[Runner] waitpid: " << std::strerror(errno) << "\n";
            ::kill(pid, SIGKILL);
            return 1;
        }
        if (g_timed_out) {
            // Alarm fired — kill the child immediately
            ::kill(pid, SIGKILL);
            ::waitpid(pid, &status, 0);
            ::alarm(0);
            std::cerr << "\n[Runner] wall-clock timeout after " << wall_secs << "s\n";
            return 124;
        }
    }
    ::alarm(0);

    if (WIFEXITED(status))   return WEXITSTATUS(status);
    if (WIFSIGNALED(status)) {
        int sig = WTERMSIG(status);
        std::cerr << "\n[Runner] killed by signal " << sig;
        if (sig == SIGKILL) std::cerr << " (SIGKILL — OOM or timeout)";
        if (sig == SIGXCPU) std::cerr << " (SIGXCPU — CPU limit exceeded)";
        std::cerr << "\n";
        return 128 + sig;
    }
    return 1;
}

// ── Main ─────────────────────────────────────────────────────────────────────

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: runner <language>\n"
                  << "  Supported: cpp  python  javascript\n";
        return 1;
    }

    // Ignore SIGPIPE so a broken stdout pipe doesn't kill us before we can
    // write the exit code back through Docker's stdio plumbing.
    ::signal(SIGPIPE, SIG_IGN);

    const std::string lang{argv[1]};

    // Read source code from stdin until EOF
    std::string code{std::istreambuf_iterator<char>(std::cin),
                     std::istreambuf_iterator<char>{}};

    // Determine source-file extension
    std::string ext;
    if      (lang == "cpp")        ext = ".cpp";
    else if (lang == "python")     ext = ".py";
    else if (lang == "javascript") ext = ".js";
    else {
        std::cerr << "[Runner] unsupported language: " << lang << "\n";
        return 1;
    }

    const std::string src_path = "/sandbox/code" + ext;

    // Write code to the writable tmpfs
    {
        std::ofstream f(src_path, std::ios::trunc);
        if (!f) {
            std::cerr << "[Runner] cannot write " << src_path << ": "
                      << std::strerror(errno) << "\n";
            return 1;
        }
        f << code;
        // Ensure all bytes are on disk before we exec
        f.flush();
    }

    // ── C++ ──────────────────────────────────────────────────────────────────
    if (lang == "cpp") {
        const std::string bin_path = "/sandbox/code";

        // Compilation step (30 s — g++ cold start can be slow on first run)
        int rc = run_child(
            {"g++", "-O2", "-std=c++17",
             "-o", bin_path.c_str(),
             src_path.c_str(),
             nullptr},
            30u);
        if (rc != 0) return rc;

        // Execution step
        return run_child({bin_path.c_str(), nullptr}, 9u);
    }

    // ── Python ───────────────────────────────────────────────────────────────
    if (lang == "python") {
        // -u  unbuffered stdout/stderr (output appears immediately)
        // -B  don't write .pyc cache files
        return run_child({"python3", "-u", "-B", src_path.c_str(), nullptr}, 9u);
    }

    // ── JavaScript ───────────────────────────────────────────────────────────
    if (lang == "javascript") {
        return run_child(
            {"node", "--max-old-space-size=128", src_path.c_str(), nullptr},
            9u);
    }

    return 0;
}
