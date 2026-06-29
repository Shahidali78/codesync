<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= htmlspecialchars($page_title ?? 'Admin') ?> — CodeSync Admin</title>
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="sidebar-brand">⚡ CodeSync Admin</div>
    <nav class="sidebar-nav">
      <a href="/"           class="<?= ($current_page ?? '') === 'dashboard'  ? 'active' : '' ?>">📊 Dashboard</a>
      <a href="/users"      class="<?= ($current_page ?? '') === 'users'      ? 'active' : '' ?>">👤 Users</a>
      <a href="/executions" class="<?= ($current_page ?? '') === 'executions' ? 'active' : '' ?>">▶ Executions</a>
    </nav>
    <div class="sidebar-footer">
      <a href="/logout" class="logout-link">Sign out</a>
    </div>
  </aside>

  <main class="main">
    <header class="main-header">
      <h1><?= htmlspecialchars($page_title ?? '') ?></h1>
    </header>
    <div class="main-content">
      <?= $content ?? '' ?>
    </div>
  </main>
</div>
</body>
</html>
