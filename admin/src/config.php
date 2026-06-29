<?php
declare(strict_types=1);

function cfg(string $key, string $default = ''): string {
    return getenv($key) ?: $default;
}
