#!/usr/bin/env python3
"""
CodeSync demo-data seed script.

Creates one demo user, three sample projects, and several source files
via the REST API.  Idempotent: if the demo user already exists the script
logs in instead of registering, and projects are created regardless
(running twice produces duplicate projects — fine for a dev seed).

Usage
-----
  python3 scripts/seed.py                        # default http://localhost:8080
  python3 scripts/seed.py --api http://api:8080  # custom base URL
"""

import sys
import json
import time
import socket
import argparse
import urllib.request
import urllib.error
from urllib.parse import urlparse

# ── Sample file contents ──────────────────────────────────────────────────────

PYTHON_HELLO = """\
# CodeSync — Python demo
def greet(names):
    for name in names:
        print(f"Hello, {name}!")

greet(["World", "CodeSync", "Ollama"])
"""

PYTHON_FIBONACCI = """\
# Memoised Fibonacci — try running with Run ▶
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

for i in range(16):
    print(f"fib({i:2d}) = {fib(i)}")
"""

PYTHON_SORT = """\
# Quicksort implementation
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left  = [x for x in arr if x < pivot]
    mid   = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + mid + quicksort(right)

data = [3, 6, 8, 10, 1, 2, 1]
print("Input: ", data)
print("Sorted:", quicksort(data))
"""

JS_HELLO = """\
// CodeSync — JavaScript demo
const greeting = (names) =>
  names.map(n => `Hello, ${n}!`).join('\\n');

console.log(greeting(['World', 'CodeSync', 'Node.js']));

// Array methods showcase
const nums = [1, 2, 3, 4, 5, 6, 7, 8];
const result = nums
  .filter(n => n % 2 === 0)
  .map(n => n ** 2)
  .reduce((acc, n) => acc + n, 0);

console.log(`Sum of squares of evens: ${result}`);
"""

JS_PRIMES = """\
// Sieve of Eratosthenes
function sieve(limit) {
  const isPrime = new Array(limit + 1).fill(true);
  isPrime[0] = isPrime[1] = false;

  for (let i = 2; i * i <= limit; i++) {
    if (isPrime[i]) {
      for (let j = i * i; j <= limit; j += i) {
        isPrime[j] = false;
      }
    }
  }
  return isPrime.reduce((acc, v, i) => (v ? [...acc, i] : acc), []);
}

const primes = sieve(100);
console.log(`Primes up to 100 (${primes.length} total):`);
console.log(primes.join(', '));
"""

CPP_HELLO = """\
#include <iostream>
#include <vector>
#include <numeric>
#include <algorithm>

int main() {
    std::vector<int> v = {5, 3, 1, 4, 1, 5, 9, 2, 6};

    std::sort(v.begin(), v.end());

    std::cout << "Sorted: ";
    for (int x : v) std::cout << x << ' ';
    std::cout << "\\n";

    int sum = std::accumulate(v.begin(), v.end(), 0);
    std::cout << "Sum: " << sum << "\\n";
    std::cout << "Max: " << *std::max_element(v.begin(), v.end()) << "\\n";

    return 0;
}
"""

CPP_FIZZBUZZ = """\
#include <iostream>

int main() {
    for (int i = 1; i <= 30; i++) {
        if      (i % 15 == 0) std::cout << "FizzBuzz\\n";
        else if (i %  3 == 0) std::cout << "Fizz\\n";
        else if (i %  5 == 0) std::cout << "Buzz\\n";
        else                   std::cout << i << "\\n";
    }
    return 0;
}
"""

# ── HTTP helpers ──────────────────────────────────────────────────────────────

def _request(method: str, url: str, body=None, token: str | None = None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise e

def post(base: str, path: str, body: dict, token: str | None = None):
    return _request("POST", f"{base}{path}", body, token)

# ── API readiness check ───────────────────────────────────────────────────────

def wait_for_api(base: str, timeout_s: int = 90):
    parsed = urlparse(base)
    host = parsed.hostname or "localhost"
    port = parsed.port or 8080
    deadline = time.time() + timeout_s
    attempt = 0
    while time.time() < deadline:
        attempt += 1
        try:
            with socket.create_connection((host, port), timeout=2):
                # Socket connected → server is accepting connections; give Spring
                # Boot a moment to finish route registration before first request.
                time.sleep(1)
                print(f"  API reachable after {attempt} attempt(s)")
                return
        except OSError:
            print(f"  waiting for API at {base} ({attempt})…")
            time.sleep(3)
    sys.exit(f"ERROR: API not reachable at {base} after {timeout_s}s")

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", default="http://localhost:8080",
                    help="Base URL of the Spring Boot API (default: http://localhost:8080)")
    ap.add_argument("--username", default="demo", help="Demo username (default: demo)")
    ap.add_argument("--password", default="demo1234", help="Demo password (default: demo1234)")
    ap.add_argument("--email",    default="demo@codesync.local")
    args = ap.parse_args()

    base = args.api.rstrip("/")

    print(f"\n  CodeSync seed script — target: {base}\n")

    # 1. Wait for API
    wait_for_api(base)

    # 2. Register or log in
    token = None
    try:
        resp = post(base, "/api/auth/register", {
            "username": args.username,
            "email":    args.email,
            "password": args.password,
        })
        token = resp["token"]
        print(f"[+] Registered user:  {args.username}  (password: {args.password})")
    except urllib.error.HTTPError as e:
        if e.code == 409:
            resp = post(base, "/api/auth/login", {
                "username": args.username,
                "password": args.password,
            })
            token = resp["token"]
            print(f"[~] Logged in as existing user: {args.username}")
        else:
            body = e.read().decode()
            sys.exit(f"ERROR: registration failed ({e.code}): {body}")

    # ── Helper: create project + files ────────────────────────────────────────

    def create_project(name: str, description: str, language: str,
                       files: list[tuple[str, str]]):
        proj = post(base, "/api/projects",
                    {"name": name, "description": description, "language": language},
                    token)
        pid = proj["id"]
        print(f"[+] Project '{name}' (id={pid})")
        for fname, content in files:
            post(base, f"/api/projects/{pid}/files",
                 {"name": fname, "content": content}, token)
            print(f"    + {fname}")
        return proj

    # 3. Python project
    create_project(
        name        = "Python Demos",
        description = "Runnable Python snippets — try the Run ▶ button",
        language    = "python",
        files       = [
            ("hello.py",     PYTHON_HELLO),
            ("fibonacci.py", PYTHON_FIBONACCI),
            ("quicksort.py", PYTHON_SORT),
        ],
    )

    # 4. JavaScript project
    create_project(
        name        = "JS Playground",
        description = "JavaScript examples — arrays, closures, algorithms",
        language    = "javascript",
        files       = [
            ("hello.js",  JS_HELLO),
            ("primes.js", JS_PRIMES),
        ],
    )

    # 5. C++ project
    create_project(
        name        = "C++ Examples",
        description = "C++17 snippets compiled with g++ -O2",
        language    = "cpp",
        files       = [
            ("hello.cpp",   CPP_HELLO),
            ("fizzbuzz.cpp", CPP_FIZZBUZZ),
        ],
    )

    print(f"""
  Seed complete.

  Open  http://localhost:5173  and log in with:
    username : {args.username}
    password : {args.password}
""")


if __name__ == "__main__":
    main()
