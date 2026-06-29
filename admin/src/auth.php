<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function start_session(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 0,           // until browser close
            'path'     => '/',
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        session_start();
    }
}

function require_auth(): void {
    start_session();
    if (empty($_SESSION['admin_logged_in'])) {
        header('Location: /login');
        exit;
    }
}

function attempt_login(string $user, string $pass): bool {
    $ok_user = cfg('ADMIN_USER', 'admin');
    $ok_pass = cfg('ADMIN_PASS', 'change_me');
    // hash_equals prevents timing attacks
    return hash_equals($ok_user, $user) && hash_equals($ok_pass, $pass);
}

function do_logout(): void {
    start_session();
    $_SESSION = [];
    session_destroy();
}
