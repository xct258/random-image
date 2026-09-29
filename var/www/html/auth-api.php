<?php
declare(strict_types=1);

// ============ CORS 白名单（按需添加） ============
const CORS_ALLOWED_ORIGINS = [
    'https://xct258.top',
    'https://random-image.xct258.top',
    'http://192.168.50.4:8181',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$isAllowedOrigin = in_array($origin, CORS_ALLOWED_ORIGINS, true);

if ($isAllowedOrigin) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Auth-Token');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ============ 登录限流配置 ============
const RATE_LIMIT_FILE = __DIR__ . '/.auth_rate_limit.json';
const RATE_LIMIT_WINDOW = 900;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

// ============ 配置区域 ============
const AUTH_CONFIG_FILE = __DIR__ . '/.auth_users.json';
const AUTH_TOKENS_FILE = __DIR__ . '/.auth_tokens.json';
const AUTH_TOKEN_EXPIRE = 30 * 24 * 3600;

// 默认密码（仅在 .auth_users.json 不存在时使用；建议首次登录后手动修改）
const AUTH_DEFAULT_PASSWORD = 'xct258';
// ==================================

function getRateLimitKey(): string
{
    return hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

function checkRateLimit(): array
{
    $key = getRateLimitKey();
    $data = loadJsonFile(RATE_LIMIT_FILE);
    $now = time();

    if (!isset($data[$key])) {
        $data[$key] = ['attempts' => 0, 'window_start' => $now];
    }

    $record = &$data[$key];

    if ($now - $record['window_start'] > RATE_LIMIT_WINDOW) {
        $record = ['attempts' => 0, 'window_start' => $now];
    }

    $remaining = max(0, RATE_LIMIT_MAX_ATTEMPTS - $record['attempts']);
    $retryAfter = $record['window_start'] + RATE_LIMIT_WINDOW - $now;

    if ($record['attempts'] >= RATE_LIMIT_MAX_ATTEMPTS && $retryAfter > 0) {
        return ['allowed' => false, 'remaining' => 0, 'retry_after' => $retryAfter];
    }

    return ['allowed' => true, 'remaining' => $remaining, 'retry_after' => 0];
}

function recordFailedAttempt(): void
{
    $key = getRateLimitKey();
    $data = loadJsonFile(RATE_LIMIT_FILE);
    $now = time();

    if (!isset($data[$key])) {
        $data[$key] = ['attempts' => 0, 'window_start' => $now];
    }

    $data[$key]['attempts']++;
    $data[$key]['window_start'] = $now;

    saveJsonFile(RATE_LIMIT_FILE, $data);
}

function clearRateLimit(): void
{
    $key = getRateLimitKey();
    $data = loadJsonFile(RATE_LIMIT_FILE);
    unset($data[$key]);
    saveJsonFile(RATE_LIMIT_FILE, $data);
}

// ── 密码加载 ──
function loadAuthPassword(): string
{
    if (file_exists(AUTH_CONFIG_FILE)) {
        $data = json_decode(file_get_contents(AUTH_CONFIG_FILE), true);
        if (is_array($data)) {
            $hash = $data['password'] ?? null;
            if (is_string($hash) && $hash !== '') {
                return $hash;
            }
            // 兼容旧账号格式 { "用户名": <hash> }，取第一个哈希作为访问密码
            $first = reset($data);
            if (is_string($first) && $first !== '') {
                return $first;
            }
        }
    }

    $hashed = password_hash(AUTH_DEFAULT_PASSWORD, PASSWORD_DEFAULT);

    file_put_contents(
        AUTH_CONFIG_FILE,
        json_encode(['password' => $hashed], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        LOCK_EX
    );

    chmod(AUTH_CONFIG_FILE, 0600);

    return $hashed;
}

// ── Token 存储（每设备独立） ──
function loadTokens(): array
{
    if (!file_exists(AUTH_TOKENS_FILE)) return [];
    $data = json_decode(file_get_contents(AUTH_TOKENS_FILE), true);
    return is_array($data) ? $data : [];
}

function saveTokens(array $tokens): void
{
    file_put_contents(AUTH_TOKENS_FILE, json_encode($tokens, JSON_PRETTY_PRINT), LOCK_EX);
}

function purgeExpiredTokens(array &$tokens): void
{
    $now = time();
    $tokens = array_filter($tokens, function ($entry) use ($now) {
        return isset($entry['exp']) && $entry['exp'] > $now;
    });
}

function createToken(): string
{
    $tokens = loadTokens();
    purgeExpiredTokens($tokens);

    $rawToken = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $rawToken);

    $tokens[$tokenHash] = [
        'exp'     => time() + AUTH_TOKEN_EXPIRE,
        'created' => time(),
    ];

    saveTokens($tokens);
    return $rawToken;
}

function checkToken(string $rawToken): bool
{
    if ($rawToken === '') return false;

    $tokenHash = hash('sha256', $rawToken);
    $tokens = loadTokens();

    if (!isset($tokens[$tokenHash])) return false;

    $entry = $tokens[$tokenHash];
    if (time() > ($entry['exp'] ?? 0)) {
        unset($tokens[$tokenHash]);
        saveTokens($tokens);
        return false;
    }

    return true;
}

function revokeToken(string $rawToken): void
{
    if ($rawToken === '') return;

    $tokenHash = hash('sha256', $rawToken);
    $tokens = loadTokens();

    if (isset($tokens[$tokenHash])) {
        unset($tokens[$tokenHash]);
        saveTokens($tokens);
    }
}

// ── JSON 工具 ──
function loadJsonFile(string $file): array
{
    if (!is_file($file)) return [];
    $decoded = json_decode((string) file_get_contents($file), true);
    return is_array($decoded) ? $decoded : [];
}

function saveJsonFile(string $file, array $data): void
{
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT), LOCK_EX);
}

// ── 路由 ──
header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        handleLogin();
        break;
    case 'check':
        handleCheck();
        break;
    case 'logout':
        handleLogout();
        break;
    case 'health':
        jsonOut(['ok' => true, 'time' => date('c')]);
        break;
    default:
        jsonOut(['error' => 'Invalid action'], 400);
}

function handleLogin(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonOut(['error' => 'Method not allowed'], 405);
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $password = $input['password'] ?? '';
    $remember = !empty($input['remember']);

    if ($password === '') {
        jsonOut(['error' => '密码不能为空'], 401);
    }

    if (strlen($password) > 256) {
        jsonOut(['error' => '密码格式不正确'], 400);
    }

    $rateLimit = checkRateLimit();

    if (!$rateLimit['allowed']) {
        http_response_code(429);
        header('Retry-After: ' . $rateLimit['retry_after']);
        jsonOut([
            'error' => '登录尝试次数过多，请稍后再试',
            'retry_after' => $rateLimit['retry_after']
        ], 429);
    }

    $hash = loadAuthPassword();

    if (!password_verify($password, $hash)) {
        recordFailedAttempt();
        jsonOut(['error' => '密码错误'], 401);
    }

    clearRateLimit();

    $result = ['success' => true];

    if ($remember) {
        $result['token'] = createToken();
    }

    jsonOut($result);
}

function handleCheck(): void
{
    $rawToken = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';

    if ($rawToken === '' || !checkToken($rawToken)) {
        jsonOut(['authenticated' => false], 401);
        return;
    }

    jsonOut(['authenticated' => true]);
}

function handleLogout(): void
{
    $rawToken = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
    revokeToken($rawToken);
    jsonOut(['success' => true]);
}

function jsonOut(array $data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}