<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/auth.php';

start_session();

// Already logged in
if (!empty($_SESSION['admin_logged_in'])) {
    header('Location: /');
    exit;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = trim((string) ($_POST['username'] ?? ''));
    $pass = (string) ($_POST['password'] ?? '');

    if (attempt_login($user, $pass)) {
        session_regenerate_id(true);
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['admin_user']      = $user;
        header('Location: /');
        exit;
    }

    $error = 'Invalid credentials.';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login — CodeSync Admin</title>
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<div class="login-wrap">
  <div class="login-card">
    <h2>⚡ CodeSync Admin</h2>
    <p class="sub">Sign in to view the dashboard</p>

    <?php if ($error): ?>
      <div class="alert alert-error"><?= htmlspecialchars($error) ?></div>
    <?php endif; ?>

    <form method="post" action="/login" autocomplete="on">
      <div class="form-group">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" required autofocus
               value="<?= htmlspecialchars($_POST['username'] ?? '') ?>">
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required>
      </div>
      <button type="submit" class="btn-login">Sign in</button>
    </form>
  </div>
</div>
</body>
</html>
