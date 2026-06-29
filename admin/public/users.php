<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/db.php';

require_auth();

$page_title   = 'Users';
$current_page = 'users';

// Sorting
$allowed_sort = ['id', 'username', 'role', 'created_at', 'project_count'];
$sort = in_array($_GET['sort'] ?? '', $allowed_sort) ? $_GET['sort'] : 'created_at';
$dir  = ($_GET['dir'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC';

function sort_link(string $col, string $label, string $current, string $dir): string {
    $next = ($col === $current && $dir === 'DESC') ? 'asc' : 'desc';
    $arrow = $col === $current ? ($dir === 'DESC' ? ' ↓' : ' ↑') : '';
    return '<a href="/users?sort=' . $col . '&dir=' . $next . '" style="color:inherit;text-decoration:none">' . $label . $arrow . '</a>';
}

try {
    $pdo = get_pdo();

    $rows = $pdo->query("
        SELECT u.id, u.username, u.email, u.role,
               TO_CHAR(u.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS created_at,
               COUNT(p.id) AS project_count,
               (SELECT COUNT(*) FROM execution_logs el WHERE el.user_id = u.id) AS exec_count
        FROM   users u
        LEFT   JOIN projects p ON p.owner_id = u.id
        GROUP  BY u.id
        ORDER  BY $sort $dir
    ")->fetchAll();

    $db_error = null;
} catch (Exception $e) {
    $db_error = $e->getMessage();
    $rows = [];
}

ob_start();
?>

<?php if ($db_error): ?>
  <div class="alert alert-error">Database error: <?= htmlspecialchars($db_error) ?></div>
<?php else: ?>

<div class="section-title"><?= count($rows) ?> total users</div>

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th><?= sort_link('id',            'ID',            $sort, $dir) ?></th>
        <th><?= sort_link('username',      'Username',      $sort, $dir) ?></th>
        <th>Email</th>
        <th><?= sort_link('role',          'Role',          $sort, $dir) ?></th>
        <th><?= sort_link('project_count', 'Projects',      $sort, $dir) ?></th>
        <th>Executions</th>
        <th><?= sort_link('created_at',    'Joined (UTC)',  $sort, $dir) ?></th>
      </tr>
    </thead>
    <tbody>
      <?php if (empty($rows)): ?>
        <tr><td colspan="7" class="muted" style="text-align:center;padding:24px">No users yet.</td></tr>
      <?php endif; ?>
      <?php foreach ($rows as $u): ?>
      <tr>
        <td class="muted mono"><?= (int) $u['id'] ?></td>
        <td style="font-weight:500"><?= htmlspecialchars($u['username']) ?></td>
        <td class="muted"><?= htmlspecialchars($u['email']) ?></td>
        <td>
          <span class="badge <?= $u['role'] === 'ADMIN' ? 'badge-admin' : 'badge-user' ?>">
            <?= htmlspecialchars($u['role']) ?>
          </span>
        </td>
        <td class="mono"><?= (int) $u['project_count'] ?></td>
        <td class="mono"><?= (int) $u['exec_count'] ?></td>
        <td class="muted mono" style="white-space:nowrap"><?= htmlspecialchars($u['created_at']) ?></td>
      </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>

<?php endif; ?>

<?php
$content = ob_get_clean();
require __DIR__ . '/../src/layout.php';
