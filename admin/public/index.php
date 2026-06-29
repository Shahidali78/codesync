<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/db.php';

require_auth();

$page_title  = 'Dashboard';
$current_page = 'dashboard';

try {
    $pdo = get_pdo();

    // ── Overview stats ────────────────────────────────────────────────────────
    $stats = $pdo->query("
        SELECT
            (SELECT COUNT(*)  FROM users)                                                   AS total_users,
            (SELECT COUNT(*)  FROM projects)                                                AS total_projects,
            (SELECT COUNT(*)  FROM execution_logs
             WHERE created_at >= NOW() - INTERVAL '24 hours')                              AS execs_today,
            (SELECT COUNT(*)  FROM execution_logs
             WHERE exit_code != 0 AND created_at >= NOW() - INTERVAL '24 hours')          AS errors_today,
            (SELECT COUNT(*)  FROM execution_logs)                                         AS execs_total,
            (SELECT ROUND(AVG(duration_ms)::numeric, 0)
             FROM execution_logs WHERE duration_ms IS NOT NULL)                            AS avg_duration_ms
    ")->fetch();

    // ── Executions by language — last 7 days ─────────────────────────────────
    $lang_rows = $pdo->query("
        SELECT language, COUNT(*) AS cnt
        FROM   execution_logs
        WHERE  created_at >= NOW() - INTERVAL '7 days'
        GROUP  BY language
        ORDER  BY cnt DESC
        LIMIT  10
    ")->fetchAll();

    $lang_max = $lang_rows ? (int) $lang_rows[0]['cnt'] : 1;

    // ── Executions per day — last 7 days ─────────────────────────────────────
    $day_rows = $pdo->query("
        SELECT TO_CHAR(created_at AT TIME ZONE 'UTC', 'Mon DD') AS day,
               COUNT(*) AS cnt
        FROM   execution_logs
        WHERE  created_at >= NOW() - INTERVAL '6 days'
        GROUP  BY TO_CHAR(created_at AT TIME ZONE 'UTC', 'Mon DD'),
                  DATE_TRUNC('day', created_at AT TIME ZONE 'UTC')
        ORDER  BY DATE_TRUNC('day', created_at AT TIME ZONE 'UTC')
    ")->fetchAll();

    $day_max = $day_rows ? max(array_column($day_rows, 'cnt')) : 1;

    // ── Recent error logs ─────────────────────────────────────────────────────
    $errors = $pdo->query("
        SELECT el.id, u.username, el.language, el.exit_code, el.duration_ms,
               LEFT(el.stderr, 300) AS stderr_preview,
               TO_CHAR(el.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS ts
        FROM   execution_logs el
        JOIN   users u ON u.id = el.user_id
        WHERE  el.exit_code IS NOT NULL AND el.exit_code != 0
        ORDER  BY el.created_at DESC
        LIMIT  15
    ")->fetchAll();

    $db_error = null;
} catch (Exception $e) {
    $db_error = $e->getMessage();
    $stats = $lang_rows = $day_rows = $errors = [];
    $lang_max = $day_max = 1;
}

// ── Render ────────────────────────────────────────────────────────────────────
ob_start();
?>

<?php if ($db_error): ?>
  <div class="alert alert-error">Database error: <?= htmlspecialchars($db_error) ?></div>
<?php else: ?>

<!-- Stat cards -->
<div class="stats-grid">
  <div class="stat-card accent">
    <div class="label">Total users</div>
    <div class="value"><?= number_format((int) $stats['total_users']) ?></div>
  </div>
  <div class="stat-card">
    <div class="label">Total projects</div>
    <div class="value"><?= number_format((int) $stats['total_projects']) ?></div>
  </div>
  <div class="stat-card success">
    <div class="label">Executions today</div>
    <div class="value"><?= number_format((int) $stats['execs_today']) ?></div>
    <div class="sub"><?= number_format((int) $stats['execs_total']) ?> all-time</div>
  </div>
  <div class="stat-card <?= (int) $stats['errors_today'] > 0 ? 'error' : '' ?>">
    <div class="label">Errors today</div>
    <div class="value"><?= number_format((int) $stats['errors_today']) ?></div>
    <?php if ($stats['avg_duration_ms']): ?>
    <div class="sub">avg <?= number_format((int) $stats['avg_duration_ms']) ?> ms</div>
    <?php endif; ?>
  </div>
</div>

<!-- Activity sparkline -->
<?php if ($day_rows): ?>
<div class="section">
  <div class="section-title">Executions — last 7 days</div>
  <div class="day-bars">
    <?php foreach ($day_rows as $d): ?>
      <?php $h = $day_max > 0 ? max(4, (int) round((int) $d['cnt'] / $day_max * 60)) : 4; ?>
      <div class="day-col">
        <div class="day-bar" style="height:<?= $h ?>px" title="<?= (int) $d['cnt'] ?> runs"></div>
        <div class="day-label"><?= htmlspecialchars($d['day']) ?></div>
      </div>
    <?php endforeach; ?>
  </div>
</div>
<?php endif; ?>

<!-- Executions by language -->
<?php if ($lang_rows): ?>
<div class="section">
  <div class="section-title">Executions by language — last 7 days</div>
  <div class="bar-chart">
    <?php foreach ($lang_rows as $row): ?>
      <?php $pct = $lang_max > 0 ? round((int) $row['cnt'] / $lang_max * 100) : 0; ?>
      <div class="bar-row">
        <div class="bar-label"><?= htmlspecialchars($row['language']) ?></div>
        <div class="bar-track"><div class="bar-fill" style="width:<?= $pct ?>%"></div></div>
        <div class="bar-count"><?= number_format((int) $row['cnt']) ?></div>
      </div>
    <?php endforeach; ?>
  </div>
</div>
<?php endif; ?>

<!-- Recent errors -->
<div class="section">
  <div class="section-title">Recent errors</div>
  <?php if (empty($errors)): ?>
    <p class="muted">No errors in recent executions — nice!</p>
  <?php else: ?>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Time (UTC)</th>
          <th>User</th>
          <th>Lang</th>
          <th>Exit</th>
          <th>Duration</th>
          <th>stderr</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($errors as $e): ?>
        <tr>
          <td class="muted mono"><?= (int) $e['id'] ?></td>
          <td class="mono muted" style="white-space:nowrap"><?= htmlspecialchars($e['ts']) ?></td>
          <td><?= htmlspecialchars($e['username']) ?></td>
          <td><span class="badge badge-lang"><?= htmlspecialchars($e['language']) ?></span></td>
          <td><span class="badge badge-err"><?= (int) $e['exit_code'] ?></span></td>
          <td class="muted mono"><?= $e['duration_ms'] !== null ? number_format((int) $e['duration_ms']) . ' ms' : '—' ?></td>
          <td><span class="truncate error-text"><?= htmlspecialchars($e['stderr_preview'] ?? '') ?></span></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php endif; ?>
</div>

<?php endif; ?>

<?php
$content = ob_get_clean();
require __DIR__ . '/../src/layout.php';
