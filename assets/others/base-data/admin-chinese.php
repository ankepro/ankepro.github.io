<?php
session_start([
    'cookie_lifetime' => 86400,
    'cookie_secure' => false,  // Đổi thành true nếu web của bạn đã cài HTTPS (có ổ khóa màu xanh)
    'cookie_httponly' => true, // Ngăn Javascript bên ngoài đọc trộm Cookie Session
    'cookie_samesite' => 'Strict' // Ngăn chặn triệt để các cuộc tấn công giả mạo yêu cầu chéo trang
]);
header('Content-Type: application/json; charset=utf-8');
// header('Access-Control-Allow-Origin: *');
// header('Access-Control-Allow-Credentials: true');

// Deny direct GET access: require POST for API calls. Return 403 HTML for direct browser requests.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('HTTP/1.1 403 Forbidden');
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta charset="utf-8"><title>403 Forbidden</title></head><body style="font-family:Arial,Helvetica,sans-serif;margin:40px;">';
    echo '<h1>403 Forbidden</h1>';
    echo '<p>Access to this resource is forbidden.</p>';
    echo '</body></html>';
    exit;
}

/**
 * admin-chinese.php - Secure bridge to Google Apps Script
 * Keeps APP_SCRIPT_ID and SHEET_NAME secret on the server
 * Client sends actions and data, server handles Google Apps Script calls
 */

// CONFIGURATION: Keep these secret on server only
const APP_SCRIPT_ID = 'AKfycbxGMIdN7qhmtNq9x_6s_8oKffFS64VtUWkCDiPEI8Um9Fgeop2eNslT-70x0LJ5cAONaA';
const SHEET_CONFIG = [
    'hsk1' => [
        'name' => 'hsk1',
        'gid' => 'gid=0'
    ],
    'hsk2' => [
        'name' => 'hsk2',
        'gid' => 'gid=1061194539'
    ]
];

function respondJson($payload, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function callGoogleAppsScript($action, $sheet, $params = []) {
    $url = 'https://script.google.com/macros/s/' . APP_SCRIPT_ID . '/exec';
    $queryParams = ['action' => $action, 'sheet' => $sheet];
    $queryParams = array_merge($queryParams, $params);
    
    $fullUrl = $url . '?' . http_build_query($queryParams);
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $fullUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        return ['status' => 'error', 'msg' => 'Google Apps Script returned HTTP ' . $httpCode];
    }
    
    // Try to parse as JSON
    if ($response === null) {
        return ['status' => 'error', 'msg' => 'Empty response from Google Apps Script'];
    }
    
    $decoded = json_decode($response, true);
    if ($decoded !== null) {
        return $decoded;
    }
    
    // Try to extract JSON from response if wrapped in text
    $firstBracket = strpos($response, '[');
    $lastBracket = strrpos($response, ']');
    if ($firstBracket !== false && $lastBracket !== false && $lastBracket > $firstBracket) {
        $jsonStr = substr($response, $firstBracket, $lastBracket - $firstBracket + 1);
        $decoded = json_decode($jsonStr, true);
        if ($decoded !== null) {
            return ['status' => 'success', 'data' => $decoded];
        }
    }
    
    return ['status' => 'success', 'data' => $response];
}

function getSheetName($sheetKey) {
    if (!isset(SHEET_CONFIG[$sheetKey])) {
        return null;
    }
    return SHEET_CONFIG[$sheetKey]['name'];
}

function isSessionAuthenticated() {
    return !empty($_SESSION['vocabularyAuthenticated']) && $_SESSION['vocabularyAuthenticated'] === true;
}

// Parse input
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!is_array($data)) {
    $data = [];
}

$action = isset($data['action']) ? $data['action'] : null;
$sheetKey = isset($data['sheet']) ? $data['sheet'] : 'hsk1'; // Default to hsk1

$sheetName = getSheetName($sheetKey);
if (!$sheetName) {
    respondJson(['status' => 'error', 'msg' => 'Sheet không hợp lệ.'], 400);
}

// === PUBLIC ENDPOINTS (no authentication required) ===

if ($action === 'read') {
    // Read vocabulary data from Google Sheets
    $result = callGoogleAppsScript('read', $sheetName);
    respondJson($result);
}

// === PROTECTED ENDPOINTS (require session authentication) ===

// Verify vocabulary password (sets session)
if ($action === 'verifyPassword') {
    $password = isset($data['password']) ? $data['password'] : '';
    
    // Load password from admin.php
    $adminPhpPath = __DIR__ . '/admin.php';
    if (file_exists($adminPhpPath)) {
        $adminPhp = file_get_contents($adminPhpPath);
        
        // Extract config from admin.php
        $startMarker = '/* ADMIN_CONFIG_START';
        $endMarker = 'ADMIN_CONFIG_END */';
        $start = strpos($adminPhp, $startMarker);
        $end = strpos($adminPhp, $endMarker);
        
        if ($start !== false && $end !== false) {
            $jsonStart = $start + strlen($startMarker);
            $jsonText = trim(substr($adminPhp, $jsonStart, $end - $jsonStart));
            $config = json_decode($jsonText, true);
            
            $hashedPassword = isset($config['vocabularyPasswordHash']) ? $config['vocabularyPasswordHash'] : null;
            
            // For backward compatibility, also check plain password if hash not found
            $plainPassword = isset($config['vocabularyPassword']) ? $config['vocabularyPassword'] : '';
            
            $authenticated = false;
            
            // Check if password matches (either hashed or plain for backward compat)
            if ($hashedPassword && password_verify($password, $hashedPassword)) {
                $authenticated = true;
            } elseif (!$hashedPassword && $password === $plainPassword) {
                // Fallback for plain text password
                $authenticated = true;
            }
            
            if ($authenticated) {
                $_SESSION['vocabularyAuthenticated'] = true;
                respondJson(['status' => 'success', 'message' => 'Xác thực thành công.']);
            }
        }
    }
    
    respondJson(['status' => 'error', 'message' => 'Sai mật khẩu.'], 401);
}

// Check if authenticated
if ($action === 'checkAuth') {
    respondJson(['status' => 'success', 'authenticated' => isSessionAuthenticated()]);
}

// Add vocabulary (requires authentication)
if ($action === 'add') {
    if (!isSessionAuthenticated()) {
        respondJson(['status' => 'error', 'msg' => 'Không được phép. Vui lòng xác thực.'], 403);
    }
    
    $chinese = isset($data['chinese']) ? $data['chinese'] : '';
    $vietnamese = isset($data['vietnamese']) ? $data['vietnamese'] : '';
    $pinyin = isset($data['pinyin']) ? $data['pinyin'] : '';
    
    if (empty($chinese)) {
        respondJson(['status' => 'error', 'msg' => 'Chữ Hán không được để trống.'], 400);
    }
    
    $result = callGoogleAppsScript('add', $sheetName, [
        'chinese' => $chinese,
        'pinyin' => $pinyin,
        'vietnamese' => $vietnamese
    ]);
    respondJson($result);
}

// Update vocabulary (requires authentication)
if ($action === 'update') {
    if (!isSessionAuthenticated()) {
        respondJson(['status' => 'error', 'msg' => 'Không được phép. Vui lòng xác thực.'], 403);
    }
    
    $rowIdx = isset($data['rowIdx']) ? intval($data['rowIdx']) : 0;
    $chinese = isset($data['chinese']) ? $data['chinese'] : '';
    $vietnamese = isset($data['vietnamese']) ? $data['vietnamese'] : '';
    $pinyin = isset($data['pinyin']) ? $data['pinyin'] : '';
    
    if (empty($chinese)) {
        respondJson(['status' => 'error', 'msg' => 'Chữ Hán không được để trống.'], 400);
    }
    
    if ($rowIdx <= 0) {
        respondJson(['status' => 'error', 'msg' => 'Row index không hợp lệ.'], 400);
    }
    
    $result = callGoogleAppsScript('update', $sheetName, [
        'rowIdx' => $rowIdx,
        'chinese' => $chinese,
        'pinyin' => $pinyin,
        'vietnamese' => $vietnamese
    ]);
    respondJson($result);
}

// Delete vocabulary (requires authentication)
if ($action === 'delete') {
    if (!isSessionAuthenticated()) {
        respondJson(['status' => 'error', 'msg' => 'Không được phép. Vui lòng xác thực.'], 403);
    }
    
    $rowIdx = isset($data['rowIdx']) ? intval($data['rowIdx']) : 0;
    
    if ($rowIdx <= 0) {
        respondJson(['status' => 'error', 'msg' => 'Row index không hợp lệ.'], 400);
    }
    
    $result = callGoogleAppsScript('delete', $sheetName, [
        'rowIdx' => $rowIdx
    ]);
    respondJson($result);
}

// Logout
if ($action === 'logout') {
    $_SESSION['vocabularyAuthenticated'] = false;
    respondJson(['status' => 'success', 'message' => 'Đã đăng xuất.']);
}

// Default response for invalid actions
header('HTTP/1.1 403 Forbidden');
header('Content-Type: text/html; charset=utf-8');
echo '<!doctype html><html><head><meta charset="utf-8"><title>403 Forbidden</title></head><body style="font-family:Arial,Helvetica,sans-serif;color:#222;background:#fff;margin:40px;">';
echo '<h1>403 Forbidden</h1>';
echo '<p>Access to this resource is forbidden.</p>';
echo '</body></html>';
exit;
?>
