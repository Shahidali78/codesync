<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/db.php';

require_auth();

$page_title   = 'Executions';
$current_page = 'executions';

const PER_PAGE = 50;

$page   = max(1, (int) ($_GET['page'] ?? 1));
$offset = ($page - 1) * PER_PAGE;

// Optional filters
$lang_filter     = trim((string) ($_GET['lang'] ?? ''));
$status_filter   = $_GET['status'] ?? '';   // 'ok' | 'err' | ''

try {
    $pdo = get_pdo();

    // Build WHERE clause
    $where  = [];
    $params = [];

    if ($lang_filter !== '') {
        $where[]  = 'el.language = :lang';
        $params[':lang'] = $lang_filter;
    }

    if ($status_filter === 'ok') {
        $where[] = 'el.exit_code = 0';
    } elseif ($status_filter === 'err') {
        $where[] = '(el.exit_code IS NOT NULL AND el.exit_code != 0)';
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    // Total count
    $count_stmt = $pdo->prepare("SELECT COUNT(*) FROM execution_logs el $whereSql");
    $count_stmt->execute($params);
    $total = (int) $count_stmt->fetchColumn();

    $total_pages = max(1, (int) ceil($total / PER_PAGE));

    // Rows
    $stmt = $pdo->prepare("
        SELECT el.id,
               u.username,
               el.language,
               el.exit_code,
               el.duration_ms,
               LEFT(el.stderr, 200)   AS stderr_preview,
               LEFT(el.stdout, 100)   AS stdout_preview,
               TO_CHAR(el.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS ts
        FROM   execution_logs el
        JOIN   users u ON u.id = el.user_id
        $whereSql
        ORDER  BY el.created_at DESC
        LIMIT  :limit OFFSET :offset
    ");
    foreach ($params as $k => $v) $stmt->bindValue($k, $v);
    $stmt->bindValue(':limit',  PER_PAGE, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset,  PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll();

    // Available languages for filter dropdown
    $langs = $pdo->query("SELECT DISTINCT language FROM execution_logs ORDER BY language")->fetchAll(PDO::FETCH_COLUMN);

    $db_error = null;
} catch (Exception $e) {
    $db_error = $e->getMessage();
    $rows = $langs = [];
    $total = $total_pages = 0;
}

function qstr(array $extra = []): string {
    $p = array_merge(['lang' => $_GET['lang'] ?? '', 'status' => $_GET['status'] ?? ''], $extra);
    $p = array_filter($p, fn($v) => $v !== '');
    return $p ? '?' . http_build_query($p) : '';
}

ob_start();
?>

<?php if ($db_error): ?>
  <div class="alert alert-error">Database error: <?= htmlspecialchars($db_error) ?></div>
<?php else: ?>

<!-- Filter bar -->
<form method="get" action="/executions" style="display:flex;gap:10px;margin-bottom:16px;align-items:center">
  <select name="lang" style="background:#252526;color:#ccc;border:1px solid #404040;border-radius:4px;padding:5px 8px;font-size:12px">
    <option value="">All languages</option>
    <?php foreach ($langs as $l): ?>
      <option value="<?= htmlspecialchars($l) ?>" <?= $lang_filter === $l ? 'selected' : '' ?>><?= htmlspecialchars($l) ?></option>
    <?php endforeach; ?>
  </select>

  <select name="status" style="background:#252526;color:#ccc;border:1px solid #404040;border-radius:4px;padding:5px 8px;font-size:12px">
    <option value="">All statuses</option>
    <option value="ok"  <?= $status_filter === 'ok'  ? 'selected' : '' ?>>✔ Success (exit 0)</option>
    <option value="err" <?= $status_filter === 'err' ? 'selected' : '' ?>>✘ Errors (exit ≠ 0)</option>
  </select>

  <button type="submit" style="background:#007acc;color:#fff;border:none;border-radius:4px;padding:5px 12px;font-size:12px;cursor:pointer">Filter</button>
  <a href="/executions" style="font-size:12px;color:#858585">Clear</a>

  <span class="muted" style="margin-left:auto;font-size:12px"><?= number_format($total) ?> records</span>
</form>

<!-- Table -->
<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Time (UTC)</th>
        <th>User</th>
        <th>Language</th>
        <th>Exit</th>
        <th>Duration</th>
        <th>stderr / stdout preview</th>
      </tr>
    </thead>
    <tbody>
      <?php if (empty($rows)): ?>
        <tr><td colspan="7" class="muted" style="text-align:center;padding:24px">No executions found.</td></tr>
      <?php endif; ?>
      <?php foreach ($rows as $r): ?>
      <?php
        $is_ok = (int) $r['exit_code'] === 0;
        $preview = $r['stderr_preview'] ?: $r['stdout_preview'];
      ?>
      <tr>
        <td class="muted mono"><?= (int) $r['id'] ?></td>
        <td class="muted mono" style="white-space:nowrap"><?= htmlspecialchars($r['ts']) ?></td>
        <td><?= htmlspecialchars($r['username']) ?></td>
        <td><span class="badge badge-lang"><?= htmlspecialchars($r['language']) ?></span></td>
        <td>
          <span class="badge <?= $r['exit_code'] === null ? '' : ($is_ok ? 'badge-ok' : 'badge-err') ?>">
            <?= $r['exit_code'] !== null ? (int) $r['exit_code'] : '?' ?>
          </span>
        </td>
        <td class="muted mono"><?= $r['duration_ms'] !== null ? number_format((int) $r['duration_ms']) . ' ms' : '—' ?></td>
        <td>
          <?php if ($preview): ?>
            <span class="truncate <?= !$is_ok ? 'error-text' : 'mono muted' ?>" title="<?= htmlspecialchars($preview) ?>">
              <?= htmlspecialchars($preview) ?>
            </span>
          <?php else: ?>
            <span class="muted">—</span>
          <?php endif; ?>
        </td>
      </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>

<!-- Pagination -->
<?php if ($total_pages > 1): ?>
<div class="pagination">
  <?php if ($page > 1): ?>
    <a href="/executions<?= qstr(['page' => $page - 1]) ?>">← Prev</a>
  <?php else: ?>
    <span class="disabled">← Prev</span>
  <?php endif; ?>

  <?php
  // Show a window of pages around current
  $start = max(1, $page - 3);
  $end   = min($total_pages, $page + 3);
  if ($start > 1)           echo '<span class="disabled">…</span>';
  for ($i = $start; $i <= $end; $i++):
  ?>
    <?php if ($i === $page): ?>
      <span class="current"><?= $i ?></span>
    <?php else: ?>
      <a href="/executions<?= qstr(['page' => $i]) ?>"><?= $i ?></a>
    <?php endif; ?>
  <?php endfor; ?>
  <?php if ($end < $total_pages) echo '<span class="disabled">…</span>'; ?>

  <?php if ($page < $total_pages): ?>
    <a href="/executions<?= qstr(['page' => $page + 1]) ?>">Next →</a>
  <?php else: ?>
    <span class="disabled">Next →</span>
  <?php endif; ?>
</div>
<?php endif; ?>

<?php endif; ?>

<?php
$content = ob_get_clean();
require __DIR__ . '/../src/layout.php';
