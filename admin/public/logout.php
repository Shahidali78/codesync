<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/auth.php';

do_logout();
header('Location: /login');
exit;
