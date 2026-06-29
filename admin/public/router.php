<?php
declare(strict_types=1);

// PHP built-in server router.
// Return false → PHP serves the file statically from the docroot (public/).
// Otherwise → route to the appropriate page script.

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

// Serve existing static files (css, images, etc.) directly
if ($uri !== '/' && is_file(__DIR__ . $uri)) {
    return false;
}

$route = rtrim($uri, '/') ?: '/';

match ($route) {
    '/', '/dashboard' => require __DIR__ . '/index.php',
    '/users'          => require __DIR__ . '/users.php',
    '/executions'     => require __DIR__ . '/executions.php',
    '/login'          => require __DIR__ . '/login.php',
    '/logout'         => require __DIR__ . '/logout.php',
    default           => (function () {
        http_response_code(404);
        echo '<h1 style="font-family:sans-serif;padding:40px;color:#ccc">404 — Not Found</h1>';
    })(),
};
