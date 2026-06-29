<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function get_pdo(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $host = cfg('DB_HOST', 'localhost');
    $port = cfg('DB_PORT', '5432');
    $name = cfg('DB_NAME', 'codesync');
    $user = cfg('DB_USER', 'codesync');
    $pass = cfg('DB_PASS', '');

    $pdo = new PDO(
        "pgsql:host=$host;port=$port;dbname=$name",
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
    return $pdo;
}
