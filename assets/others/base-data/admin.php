<?php
session_start([
    'cookie_lifetime' => 86400,
    'cookie_secure' => false,  // Đổi thành true nếu web của bạn đã cài HTTPS (có ổ khóa màu xanh)
    'cookie_httponly' => true, // Ngăn Javascript bên ngoài đọc trộm Cookie Session
    'cookie_samesite' => 'Strict' // Ngăn chặn triệt để các cuộc tấn công giả mạo yêu cầu chéo trang
]);
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

// Prevent direct access to data.json via HTTP
if (basename($_SERVER['REQUEST_URI'] ?? '') === 'data.json') {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'message' => 'Không được phép'], JSON_UNESCAPED_UNICODE);
    exit;
}

/* ADMIN_CONFIG_START
{
    "adminPasswordHash": "$2y$10$g.7EvbeB1Z0ddsU77BU6xueU3M6emRKFjfCIcNvtHlwaqAIffFKBi",
    "paginationConfig": {
        "categoriesPerPage": 2,
        "postsPerCategoryPage": 6
    },
    "pageConfig": [
        {
            "order": 1,
            "label": "Thử nghiệm",
            "category": "Thử nghiệm"
        },
        {
            "order": 2,
            "label": "Phần mềm",
            "category": "Phần mềm"
        }
    ],
    "dropdownMenus": [
        {
            "name": "chinese",
            "label": "汉语",
            "items": [
                {
                    "label": "Từ mới 进",
                    "href": "\/pages\/chinese-p01.html"
                },
                {
                    "label": "Từ mới 国",
                    "href": "\/pages\/chinese-p02.html"
                },
                {
                    "label": "QL từ vựng",
                    "href": "#",
                    "submenu": [
                        {
                            "label": "Từ vựng 进",
                            "href": "\/pages\/vocabulary-p01.html"
                        },
                        {
                            "label": "Từ vựng 国",
                            "href": "\/pages\/vocabulary-p02.html"
                        }
                    ]
                }
            ]
        }
    ],
    "contacts": [
        {
            "name": "11",
            "message": "11111",
            "time": 46170.6304816782358102500438690185546875
        },
        {
            "name": "3105",
            "message": "3105",
            "time": 46173.17600792823941446840763092041015625
        },
        {
            "name": "Nguyễn Văn B",
            "message": "Nội dung tin nhắn ngày 07\/06",
            "time": 46180.366498518516891635954380035400390625
        }
    ],
    "comments": [
        {
            "id": "comment-6a204c55d497e",
            "postId": "GX1",
            "name": "tên 1",
            "content": "bình luận 1 hot",
            "replyToName": "",
            "createdAt": 1780501591097,
            "status": "pending",
            "hidden": false
        },
        {
            "id": "comment-6a26e1eeb8eab",
            "postId": "test01",
            "name": "Nguyễn Thị Huyền",
            "content": "LD điện thoại 08.06",
            "replyToName": "",
            "createdAt": 1780933104351,
            "status": "pending",
            "hidden": false
        }
    ],
    "appScriptId": null,
    "sheets": null,
    "vocabularyPasswordHash": "$2y$10$g.7EvbeB1Z0ddsU77BU6xueU3M6emRKFjfCIcNvtHlwaqAIffFKBi"
}
ADMIN_CONFIG_END */

$adminPhpPath = __FILE__;
$adminConfigStart = '/* ADMIN_CONFIG_START';
$adminConfigEnd = 'ADMIN_CONFIG_END */';

$defaultConfig = [
    'adminPassword' => null,
    'adminPasswordHash' => null,
    'paginationConfig' => [
        'categoriesPerPage' => 3,
        'postsPerCategoryPage' => 16
    ],
    'pageConfig' => [
        [
            'order' => 1,
            'label' => 'Phần mềm',
            'category' => 'Phần mềm'
        ]
    ],
    'dropdownMenus' => [],
    'contacts' => [],
    'comments' => [],
    'vocabularyPassword' => null,
    'vocabularyPasswordHash' => null
];

function respondJson($payload, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function writeAdminPhpContent($content) {
    global $adminPhpPath;
    $tmpFile = $adminPhpPath . '.tmp';
    if (file_put_contents($tmpFile, $content) === false) {
        return false;
    }
    if (@rename($tmpFile, $adminPhpPath)) {
        return true;
    }
    if (@copy($tmpFile, $adminPhpPath)) {
        @unlink($tmpFile);
        return true;
    }
    if (@file_put_contents($adminPhpPath, $content) !== false) {
        @unlink($tmpFile);
        return true;
    }
    return false;
}

function getPostsIndexPath() {
    return __DIR__ . '/data.json';
}

function getPostsFolderPath() {
    return __DIR__ . '/posts';
}

function normalizePostId($postId) {
    $postId = trim((string)$postId);
    $postId = str_replace(['/', '\\', '..'], '', $postId);
    return preg_replace('/[^A-Za-z0-9_-]/', '', $postId);
}

function getPostFilePath($postId) {
    $cleanId = normalizePostId($postId);
    if ($cleanId === '') {
        return null;
    }
    return getPostsFolderPath() . '/' . $cleanId . '.json';
}

function loadPostsIndex() {
    $dataPath = getPostsIndexPath();
    if (!file_exists($dataPath)) {
        return [];
    }
    $content = file_get_contents($dataPath);
    $data = json_decode($content, true);
    if (!is_array($data) || !isset($data['posts']) || !is_array($data['posts'])) {
        return [];
    }
    return array_values(array_filter(array_map('normalizePostId', $data['posts']), function ($id) {
        return $id !== '';
    }));
}

function readPostFile($postId) {
    $filePath = getPostFilePath($postId);
    if (!$filePath || !file_exists($filePath)) {
        return null;
    }
    $content = file_get_contents($filePath);
    $data = json_decode($content, true);
    if (!is_array($data)) {
        return null;
    }
    return $data;
}

function compilePostRow(array $postData) {
    return [
        isset($postData['id']) ? $postData['id'] : '',
        isset($postData['title']) ? $postData['title'] : '',
        isset($postData['img']) ? $postData['img'] : '',
        isset($postData['imgAlt']) ? $postData['imgAlt'] : '',
        isset($postData['excerpt']) ? $postData['excerpt'] : '',
        isset($postData['content']) ? $postData['content'] : '',
        isset($postData['category']) ? $postData['category'] : '',
        isset($postData['tag']) ? $postData['tag'] : '',
        isset($postData['time']) ? $postData['time'] : '',
        isset($postData['linkPage']) ? $postData['linkPage'] : ''
    ];
}

function compilePostSummaryRow(array $postData) {
    return [
        isset($postData['id']) ? $postData['id'] : '',
        isset($postData['title']) ? $postData['title'] : '',
        isset($postData['img']) ? $postData['img'] : '',
        isset($postData['imgAlt']) ? $postData['imgAlt'] : '',
        isset($postData['excerpt']) ? $postData['excerpt'] : '',
        '',
        isset($postData['category']) ? $postData['category'] : '',
        isset($postData['tag']) ? $postData['tag'] : '',
        isset($postData['time']) ? $postData['time'] : '',
        isset($postData['linkPage']) ? $postData['linkPage'] : ''
    ];
}

function normalizePostRow(array $row) {
    return [
        'id' => isset($row[0]) ? normalizePostId($row[0]) : '',
        'title' => isset($row[1]) ? $row[1] : '',
        'img' => isset($row[2]) ? $row[2] : '',
        'imgAlt' => isset($row[3]) ? $row[3] : '',
        'excerpt' => isset($row[4]) ? $row[4] : '',
        'content' => isset($row[5]) ? $row[5] : '',
        'category' => isset($row[6]) ? $row[6] : '',
        'tag' => isset($row[7]) ? $row[7] : '',
        'time' => isset($row[8]) ? $row[8] : '',
        'linkPage' => isset($row[9]) ? $row[9] : ''
    ];
}

function getPublicVisibleCategories() {
    global $config;
    $visible = [];
    if (!isset($config['pageConfig']) || !is_array($config['pageConfig'])) {
        return [];
    }
    foreach ($config['pageConfig'] as $item) {
        if (!is_array($item)) {
            continue;
        }
        $category = isset($item['category']) ? trim($item['category']) : '';
        if ($category === '' || strtolower($category) === 'none') {
            continue;
        }
        $visible[strtolower($category)] = true;
    }
    return $visible;
}

function isHiddenCategory(string $category): bool {
    return strtolower(trim($category)) === 'none';
}

function isPostPubliclyVisible(array $postData) {
    $category = isset($postData['category']) ? trim($postData['category']) : '';
    if ($category === '' || isHiddenCategory($category)) {
        return false;
    }
    $visibleCategories = getPublicVisibleCategories();
    return isset($visibleCategories[strtolower($category)]);
}

function ensurePostsDirectory() {
    $dir = getPostsFolderPath();
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
}

function savePostFile(array $postData) {
    $postId = normalizePostId($postData['id'] ?? '');
    if ($postId === '') {
        return false;
    }
    ensurePostsDirectory();
    $filePath = getPostFilePath($postId);
    $content = json_encode($postData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($content === false) {
        return false;
    }
    return file_put_contents($filePath, $content) !== false;
}

function removeStalePostFiles(array $keepIds) {
    $dir = getPostsFolderPath();
    if (!is_dir($dir)) {
        return;
    }
    $keepMap = array_fill_keys(array_map('normalizePostId', $keepIds), true);
    foreach (glob($dir . '/*.json') as $filePath) {
        $base = basename($filePath, '.json');
        if (!isset($keepMap[$base])) {
            @unlink($filePath);
        }
    }
}

function getAdminConfig() {
    global $config;
    return is_array($config) ? $config : [];
}

function normalizeComment(array $item): array {
    $name = trim((string)($item['name'] ?? ''));
    $content = trim((string)($item['content'] ?? ''));
    $postId = trim((string)($item['postId'] ?? ''));
    return [
        'id' => isset($item['id']) ? (string)$item['id'] : 'comment-' . uniqid(),
        'postId' => $postId,
        'name' => $name,
        'content' => $content,
        'replyToName' => trim((string)($item['replyToName'] ?? '')),
        'createdAt' => isset($item['createdAt']) ? floatval($item['createdAt']) : (microtime(true) * 1000),
        'status' => in_array(strtolower((string)($item['status'] ?? 'pending')), ['approved', 'pending', 'hidden'], true) ? strtolower((string)$item['status']) : 'pending',
        'hidden' => !empty($item['hidden'])
    ];
}

function getSessionCommentIds(string $key): array {
    if (empty($_SESSION[$key]) || !is_array($_SESSION[$key])) {
        return [];
    }
    return array_values(array_filter($_SESSION[$key], function ($id) {
        return is_string($id) && $id !== '';
    }));
}

function addSessionCommentOwner(string $key, string $id): void {
    if ($id === '') {
        return;
    }
    $ids = getSessionCommentIds($key);
    if (!in_array($id, $ids, true)) {
        $ids[] = $id;
    }
    $_SESSION[$key] = $ids;
}

function removeSessionCommentOwner(string $key, string $id): void {
    if ($id === '' || empty($_SESSION[$key]) || !is_array($_SESSION[$key])) {
        return;
    }
    $_SESSION[$key] = array_values(array_filter($_SESSION[$key], function ($item) use ($id) {
        return is_string($item) && $item !== '' && $item !== $id;
    }));
}

function isSessionCommentOwnerId(string $id): bool {
    if ($id === '') {
        return false;
    }
    return in_array($id, getSessionCommentIds('my_pending_comments'), true)
        || in_array($id, getSessionCommentIds('my_approved_comments'), true);
}

function markSessionCommentApproved(string $id): void {
    removeSessionCommentOwner('my_pending_comments', $id);
    addSessionCommentOwner('my_approved_comments', $id);
}

function markSessionCommentPending(string $id): void {
    removeSessionCommentOwner('my_approved_comments', $id);
    addSessionCommentOwner('my_pending_comments', $id);
}

function getPublicCommentsForPost(string $postId): array {
    $config = getAdminConfig();
    $pendingOwnerIds = getSessionCommentIds('my_pending_comments');
    $approvedOwnerIds = getSessionCommentIds('my_approved_comments');
    $comments = [];
    if (isset($config['comments']) && is_array($config['comments'])) {
        foreach ($config['comments'] as $item) {
            if (!is_array($item)) {
                continue;
            }
            $comment = normalizeComment($item);
            if ($comment['postId'] !== $postId) {
                continue;
            }
            if (!empty($comment['hidden'])) {
                continue;
            }
            $isOwner = in_array($comment['id'], $pendingOwnerIds, true) || in_array($comment['id'], $approvedOwnerIds, true);
            if ($comment['status'] === 'approved' || ($comment['status'] === 'pending' && $isOwner)) {
                $comment['is_owner'] = $isOwner;
                $comments[] = $comment;
            }
        }
    }
    usort($comments, fn($a, $b) => ($a['createdAt'] ?? 0) <=> ($b['createdAt'] ?? 0));
    return $comments;
}

function saveConfigJson(array $config) {
    global $rawPhp, $start, $end, $adminConfigStart, $adminConfigEnd;
    $newJson = json_encode([
        'adminPasswordHash' => isset($config['adminPasswordHash']) ? $config['adminPasswordHash'] : null,
        'paginationConfig' => $config['paginationConfig'],
        'pageConfig' => $config['pageConfig'],
        'dropdownMenus' => $config['dropdownMenus'],
        'contacts' => $config['contacts'],
        'comments' => isset($config['comments']) && is_array($config['comments']) ? $config['comments'] : [],
        'appScriptId' => isset($config['appScriptId']) ? $config['appScriptId'] : null,
        'sheets' => isset($config['sheets']) ? $config['sheets'] : null,
        'vocabularyPasswordHash' => isset($config['vocabularyPasswordHash']) ? $config['vocabularyPasswordHash'] : null
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    if ($newJson === false) {
        return ['status' => 'error', 'message' => 'Không thể chuyển dữ liệu sang JSON.'];
    }

    if ($rawPhp !== false && $start !== false && $end !== false && $end > $start) {
        $newPhp = substr($rawPhp, 0, $start + strlen($adminConfigStart)) . "\n" . $newJson . "\n" . substr($rawPhp, $end);
        if (writeAdminPhpContent($newPhp)) {
            return ['status' => 'success'];
        }
    }
    return ['status' => 'error', 'message' => 'Lỗi hệ thống: Không thể ghi file admin.php.'];
}

function isSessionAuthenticated() {
    return !empty($_SESSION['adminAuthenticated']) && $_SESSION['adminAuthenticated'] === true;
}

function isAdminPasswordCorrect($password, $config) {
    if (!is_string($password) || trim($password) === '') {
        return false;
    }
    
    $hash = isset($config['adminPasswordHash']) ? $config['adminPasswordHash'] : null;
    if ($hash && password_verify($password, $hash)) {
        return true;
    }

    // Backward compatibility: allow plain password if stored in old config format
    if (isset($config['adminPassword']) && is_string($config['adminPassword'])) {
        return trim($config['adminPassword']) === trim($password);
    }

    return false;
}

function isAdminAuthenticated($data, $config) {
    if (!empty($_SESSION['adminAuthenticated']) && $_SESSION['adminAuthenticated'] === true) {
        return true;
    }
    if (isset($data['password']) && isAdminPasswordCorrect($data['password'], $config)) {
        return true;
    }
    return false;
}

$config = $defaultConfig;
$rawPhp = @file_get_contents($adminPhpPath);
if ($rawPhp !== false) {
    $start = strpos($rawPhp, $adminConfigStart);
    $end = strpos($rawPhp, $adminConfigEnd);
    if ($start !== false && $end !== false && $end > $start) {
        // Extract JSON between markers
        $jsonStart = $start + strlen($adminConfigStart);
        $jsonLength = $end - $jsonStart;
        $jsonText = trim(substr($rawPhp, $jsonStart, $jsonLength));
        $parsedConfig = json_decode($jsonText, true);
        if (is_array($parsedConfig)) {
            $config = array_replace_recursive($defaultConfig, $parsedConfig);
        }
    }
}

// === HANDLE GET REQUESTS ===
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $action = isset($_GET['action']) ? $_GET['action'] : '';

    // Endpoint: public_config - Returns only public data (no passwords, no sensitive info)
    // This is safe to allow without authentication as it contains only non-sensitive config
if ($action === 'public_config') {
    $config = getAdminConfig();
    $response = [
        'paginationConfig' => $config['paginationConfig'],
        'pageConfig' => $config['pageConfig'],
        'dropdownMenus' => $config['dropdownMenus'],
        'appScriptId' => isset($config['appScriptId']) ? $config['appScriptId'] : null,
        'sheets' => isset($config['sheets']) ? $config['sheets'] : null,
        'vocabularyPasswordHash' => isset($config['vocabularyPasswordHash']) ? $config['vocabularyPasswordHash'] : null
    ];

    if (isset($_GET['includeContacts']) && $_GET['includeContacts'] === '1' && isSessionAuthenticated()) {
        $response['contacts'] = isset($config['contacts']) ? $config['contacts'] : [];
    }

    respondJson($response);
}

    if ($action === 'get_public_comments') {
        $postId = isset($_GET['postId']) ? normalizePostId($_GET['postId']) : '';
        respondJson(['status' => 'success', 'comments' => getPublicCommentsForPost($postId)]);
    }

    if ($action === 'get_contacts') {
    if (!isSessionAuthenticated()) {
        respondJson(['status' => 'error', 'message' => 'Không được phép. Vui lòng đăng nhập.'], 403);
    }
    $config = getAdminConfig();
    respondJson([
        'status' => 'success',
        'contacts' => isset($config['contacts']) ? $config['contacts'] : []
    ]);
}

if ($action === 'get_posts') {
        $page = isset($_GET['page']) ? intval($_GET['page']) : 1;
        $category = isset($_GET['category']) ? trim($_GET['category']) : null;

        $postIds = loadPostsIndex();
        if (empty($postIds)) {
            respondJson(['status' => 'success', 'posts' => [], 'pagination' => ['page' => 1, 'totalPages' => 0, 'totalPosts' => 0, 'postsPerPage' => intval($config['paginationConfig']['postsPerCategoryPage'] ?? 16)]]);
        }

        // 1. KIỂM TRA QUYỀN ADMIN: sử dụng session xác thực chuẩn của hệ thống
        $isAdmin = isSessionAuthenticated();

        $posts = [];
        $visibleCategories = getPublicVisibleCategories();
        foreach ($postIds as $postId) {
            $postData = readPostFile($postId);
            if (!is_array($postData)) {
                continue;
            }

            // 2. BỘ LỌC BẢO MẬT: Nếu KHÔNG PHẢI ADMIN và bài viết thuộc danh mục 'none' -> Chặn, nhảy qua luôn
            if (!$isAdmin && isset($postData['category']) && isHiddenCategory((string)$postData['category'])) {
                continue;
            }

            // Public listing should include all indexed posts, even when category is "none".
            // This is required for the SPA search/results pages to work reliably.
            if ($category && $category !== 'none' && isset($postData['category']) && $postData['category'] !== $category) {
                continue;
            }
            $posts[] = compilePostSummaryRow($postData);
        }

        $paginationConfig = $config['paginationConfig'];
        $postsPerPage = intval($paginationConfig['postsPerCategoryPage'] ?? 16);
        $totalPosts = count($posts);
        $totalPages = $postsPerPage > 0 ? ceil($totalPosts / $postsPerPage) : 1;

        if ($page < 1) {
            $page = 1;
        }
        if ($page > $totalPages && $totalPages > 0) {
            $page = $totalPages;
        }

        $startIdx = ($page - 1) * $postsPerPage;
        $pagedPosts = array_slice($posts, $startIdx, $postsPerPage);

        // 3. ĐÓNG GÓI DỮ LIỆU SẠCH: Trả về cho trình duyệt bằng hàm hệ thống của bạn
        respondJson([
            'status' => 'success',
            'posts' => $pagedPosts,
            'pagination' => [
                'page' => $page,
                'totalPages' => $totalPages,
                'totalPosts' => $totalPosts,
                'postsPerPage' => $postsPerPage
            ]
        ]);
    }

    // Endpoint: get_post - Get a single post detail by ID
    
    // =================================================================
    // HÀNH ĐỘNG: LẤY CHI TIẾT 1 BÀI VIẾT (ĐÃ BỔ SUNG BẢO MẬT CHẶN XEM TRỰC TIẾP)
    // =================================================================
    if ($action === 'get_post') {
        $postId = isset($_GET['id']) ? normalizePostId($_GET['id']) : '';
        if ($postId === '') {
            respondJson(['status' => 'error', 'message' => 'ID bài viết không hợp lệ.'], 400);
        }

        $postData = readPostFile($postId);
        if (!is_array($postData) || $postData['id'] !== $postId) {
            respondJson(['status' => 'error', 'message' => 'Không tìm thấy bài viết.'], 404);
        }

        // --- BẮT ĐẦU ĐOẠN CODE BẢO MẬT KIỂM TRA QUYỀN ---
        // Sử dụng chính hàm kiểm tra đăng nhập có sẵn trong hệ thống của bạn
        $isAdmin = isSessionAuthenticated();

        // Nếu KHÔNG PHẢI ADMIN và bài viết thuộc danh mục ẩn 'none' -> Chặn đứng ngay lập tức!
        if (!$isAdmin && isset($postData['category']) && isHiddenCategory((string)$postData['category'])) {
            respondJson(['status' => 'error', 'message' => 'Không tìm thấy bài viết.'], 404);
            // Trả về lỗi 404 (Không tìm thấy) thay vì 403 để hacker tưởng rằng bài viết này không tồn tại
        }
        // --- KẾT THÚC ĐOẠN CODE BẢO MẬT ---

        respondJson([
            'status' => 'success',
            'post' => $postData
        ]);
    }

    // =================================================================
    // Endpoint: getAllPosts - GIỮ NGUYÊN GỐC DÀNH CHO TRANG ADMIN
    // =================================================================
    if ($action === 'getAllPosts') {
        if (!isSessionAuthenticated()) {
            respondJson(['status' => 'error', 'message' => 'Không được phép. Vui lòng đăng nhập.'], 403);
        }
        $postIds = loadPostsIndex();
        $allPosts = [];
        foreach ($postIds as $postId) {
            $postData = readPostFile($postId);
            if (!is_array($postData)) {
                continue;
            }
            $allPosts[] = compilePostRow($postData);
        }
        respondJson([
            'status' => 'success',
            'posts' => $allPosts
        ]);
    }
    /* Đoạn mã cũ không giấu được bài viết none khi người ta gõ đúng link
    if ($action === 'get_post') {
        $postId = isset($_GET['id']) ? normalizePostId($_GET['id']) : '';
        if ($postId === '') {
            respondJson(['status' => 'error', 'message' => 'ID bài viết không hợp lệ.'], 400);
        }

        $postData = readPostFile($postId);
        if (!is_array($postData) || $postData['id'] !== $postId) {
            respondJson(['status' => 'error', 'message' => 'Không tìm thấy bài viết.'], 404);
        }

        respondJson([
            'status' => 'success',
            'post' => $postData
        ]);
    }
   Hết đoạn mã cũ */ 
    // Endpoint: getAllPosts - Get all posts data for admin.html (used by admin panel)
    if ($action === 'getAllPosts') {
        if (!isSessionAuthenticated()) {
            respondJson(['status' => 'error', 'message' => 'Không được phép. Vui lòng đăng nhập.'], 403);
        }
        $postIds = loadPostsIndex();
        $allPosts = [];
        foreach ($postIds as $postId) {
            $postData = readPostFile($postId);
            if (!is_array($postData)) {
                continue;
            }
            $allPosts[] = compilePostRow($postData);
        }
        respondJson([
            'status' => 'success',
            'posts' => $allPosts
        ]);
    }

    
    // For any other GET without an explicit allowed action, return 403 Forbidden HTML
    header('HTTP/1.1 403 Forbidden');
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta charset="utf-8"><title>403 Forbidden</title></head><body style="font-family:Arial,Helvetica,sans-serif;color:#222;background:#fff;margin:40px;">';
    echo '<h1>403 Forbidden</h1>';
    echo '<p>Access to this resource is forbidden.</p>';
    echo '</body></html>';
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);
if (!is_array($data)) {
    respondJson(['status' => 'error', 'message' => 'Dữ liệu gửi lên không đúng định dạng.'], 400);
}

$action = isset($data['action']) ? $data['action'] : null;

if ($action === 'verify') {
    if (isAdminPasswordCorrect($data['password'] ?? '', $config)) {
        $_SESSION['adminAuthenticated'] = true;
        respondJson(['status' => 'success', 'message' => 'Xác thực thành công.']);
    }
    respondJson(['status' => 'error', 'message' => 'Sai mật khẩu admin.'], 401);
}

if ($action === 'checkAuth') {
    respondJson(['status' => 'success', 'authenticated' => !empty($_SESSION['adminAuthenticated'])]);
}

if ($action === 'logout') {
    $_SESSION['adminAuthenticated'] = false;
    respondJson(['status' => 'success', 'message' => 'Đã đăng xuất.']);
}

if ($action === 'get_public_comments') {
    $postId = isset($_GET['postId']) ? normalizePostId($_GET['postId']) : '';
    $config = getAdminConfig();
    $pendingOwnerIds = getSessionCommentIds('my_pending_comments');
    $approvedOwnerIds = getSessionCommentIds('my_approved_comments');
    $comments = [];
    if (isset($config['comments']) && is_array($config['comments'])) {
        foreach ($config['comments'] as $item) {
            if (!is_array($item)) continue;
            $comment = normalizeComment($item);
            if ($comment['postId'] !== $postId) continue;
            if (!empty($comment['hidden'])) {
                continue;
            }
            $isOwner = in_array($comment['id'], $pendingOwnerIds, true) || in_array($comment['id'], $approvedOwnerIds, true);
            if ($comment['status'] === 'approved' || ($comment['status'] === 'pending' && $isOwner)) {
                $comment['is_owner'] = $isOwner;
                $comments[] = $comment;
            }
        }
    }
    usort($comments, fn($a, $b) => ($a['createdAt'] ?? 0) <=> ($b['createdAt'] ?? 0));
    respondJson(['status' => 'success', 'comments' => $comments]);
}

if ($action === 'get_admin_comments') {
    if (!isSessionAuthenticated()) {
        respondJson(['status' => 'error', 'message' => 'Không được phép.'], 403);
    }
    $config = getAdminConfig();
    $comments = [];
    if (isset($config['comments']) && is_array($config['comments'])) {
        foreach ($config['comments'] as $item) {
            if (is_array($item)) {
                $comments[] = normalizeComment($item);
            }
        }
    }
    usort($comments, fn($a, $b) => ($a['createdAt'] ?? 0) <=> ($b['createdAt'] ?? 0));
    respondJson(['status' => 'success', 'comments' => $comments]);
}

if ($action === 'add_comment') {
    if (!isset($data['comment']) || !is_array($data['comment'])) {
        respondJson(['status' => 'error', 'message' => 'Dữ liệu bình luận không hợp lệ.'], 400);
    }

    $comment = normalizeComment($data['comment']);
    if ($comment['name'] === '' || $comment['content'] === '' || $comment['postId'] === '') {
        respondJson(['status' => 'error', 'message' => 'Vui lòng điền đầy đủ họ tên, nội dung và bài viết.'], 400);
    }

    $config = getAdminConfig();
    $comments = isset($config['comments']) && is_array($config['comments']) ? $config['comments'] : [];
    $todayStart = strtotime('today') * 1000;
    $todayCount = 0;
    foreach ($comments as $item) {
        if (!is_array($item)) continue;
        $itemComment = normalizeComment($item);
        if (strtolower($itemComment['name']) !== strtolower($comment['name'])) continue;
        if (($itemComment['createdAt'] ?? 0) >= $todayStart) {
            $todayCount++;
        }
    }
    if ($todayCount >= 20) {
        respondJson(['status' => 'error', 'message' => 'Bạn đã gửi 20 bình luận trong ngày hôm nay.'], 429);
    }

    $comment['id'] = 'comment-' . uniqid();
    $comment['status'] = 'pending';
    $comments[] = $comment;
    $config['comments'] = $comments;
    $saved = saveConfigJson($config);
    if ($saved['status'] === 'success') {
        addSessionCommentOwner('my_pending_comments', $comment['id']);
        respondJson(['status' => 'success', 'message' => 'Đã nhận bình luận, đang chờ kiểm duyệt.', 'comment' => $comment]);
    }
    respondJson($saved, 500);
}

if ($action === 'hide_comment') {
    $id = isset($data['id']) ? trim((string)$data['id']) : '';
    if ($id === '') {
        respondJson(['status' => 'error', 'message' => 'ID bình luận không hợp lệ.'], 400);
    }
    if (!isSessionCommentOwnerId($id)) {
        respondJson(['status' => 'error', 'message' => 'Bạn không có quyền ẩn bình luận này.'], 403);
    }
    $config = getAdminConfig();
    $comments = isset($config['comments']) && is_array($config['comments']) ? $config['comments'] : [];
    $target = null;
    foreach ($comments as $idx => $item) {
        if (!is_array($item) || (string)($item['id'] ?? '') !== $id) continue;
        $target = $idx;
        break;
    }
    if ($target === null) {
        respondJson(['status' => 'error', 'message' => 'Không tìm thấy bình luận.'], 404);
    }
    $comments[$target]['hidden'] = true;
    $config['comments'] = $comments;
    $saved = saveConfigJson($config);
    if ($saved['status'] === 'success') {
        respondJson(['status' => 'success', 'message' => 'Bình luận của bạn đã được ẩn.']);
    }
    respondJson($saved, 500);
}

if ($action === 'approve_comment' || $action === 'unapprove_comment' || $action === 'toggle_comment_hidden' || $action === 'delete_comment' || $action === 'edit_comment') {
    if (!isSessionAuthenticated()) {
        respondJson(['status' => 'error', 'message' => 'Không được phép.'], 403);
    }

    $config = getAdminConfig();
    $comments = isset($config['comments']) && is_array($config['comments']) ? $config['comments'] : [];
    $id = isset($data['id']) ? trim((string)$data['id']) : '';
    $target = null;
    foreach ($comments as $idx => $item) {
        if (!is_array($item) || (string)($item['id'] ?? '') !== $id) continue;
        $target = $idx;
        break;
    }
    if ($target === null) {
        respondJson(['status' => 'error', 'message' => 'Không tìm thấy bình luận.'], 404);
    }

    if ($action === 'approve_comment') {
        $comments[$target]['status'] = 'approved';
        $comments[$target]['hidden'] = false;
        if (isSessionCommentOwnerId($id)) {
            markSessionCommentApproved($id);
        }
    } elseif ($action === 'unapprove_comment') {
        $comments[$target]['status'] = 'pending';
        $comments[$target]['hidden'] = false;
        if (isSessionCommentOwnerId($id)) {
            markSessionCommentPending($id);
        }
    } elseif ($action === 'toggle_comment_hidden') {
        $comments[$target]['hidden'] = !(!empty($comments[$target]['hidden']));
        if (!empty($comments[$target]['hidden'])) {
            $comments[$target]['status'] = 'hidden';
        } elseif (($comments[$target]['status'] ?? 'pending') === 'hidden') {
            $comments[$target]['status'] = 'approved';
        }
    } elseif ($action === 'edit_comment') {
        $comments[$target]['content'] = isset($data['content']) ? trim((string)$data['content']) : ($comments[$target]['content'] ?? '');
        $comments[$target]['name'] = isset($data['name']) ? trim((string)$data['name']) : ($comments[$target]['name'] ?? '');
        $comments[$target]['replyToName'] = isset($data['replyToName']) ? trim((string)$data['replyToName']) : ($comments[$target]['replyToName'] ?? '');
        if (isset($data['createdAt'])) {
            $createdAt = floatval($data['createdAt']);
            if (is_finite($createdAt) && $createdAt > 0) {
                $comments[$target]['createdAt'] = $createdAt;
            }
        }
        if (isset($data['status'])) {
            $newStatus = strtolower(trim((string)$data['status']));
            if ($newStatus === 'approved') {
                $comments[$target]['status'] = 'approved';
                $comments[$target]['hidden'] = false;
                if (isSessionCommentOwnerId($id)) {
                    markSessionCommentApproved($id);
                }
            } elseif ($newStatus === 'pending_register') {
                $comments[$target]['status'] = 'pending';
                $comments[$target]['hidden'] = false;
                if (isSessionCommentOwnerId($id)) {
                    markSessionCommentPending($id);
                }
            } elseif ($newStatus === 'pending_delete') {
                $comments[$target]['status'] = 'pending';
                $comments[$target]['hidden'] = true;
                if (isSessionCommentOwnerId($id)) {
                    markSessionCommentPending($id);
                }
            } elseif ($newStatus === 'hidden') {
                $comments[$target]['status'] = 'hidden';
                $comments[$target]['hidden'] = true;
            }
        }
    } elseif ($action === 'delete_comment') {
        array_splice($comments, $target, 1);
    }

    $config['comments'] = $comments;
    $saved = saveConfigJson($config);
    if ($saved['status'] === 'success') {
        respondJson(['status' => 'success', 'message' => 'Đã cập nhật bình luận.']);
    }
    respondJson($saved, 500);
}

if ($action === 'add_contact') {
    if (!isset($data['contact']) || !is_array($data['contact'])) {
        respondJson(['status' => 'error', 'message' => 'Dữ liệu liên hệ không hợp lệ.'], 400);
    }

    $contact = $data['contact'];
    $name = trim($contact['name'] ?? '');
    $message = trim($contact['message'] ?? '');
    $time = isset($contact['time']) ? floatval($contact['time']) : (microtime(true) / 86400) + 25569;

    if ($name === '' || $message === '') {
        respondJson(['status' => 'error', 'message' => 'Vui lòng điền tên và nội dung tin nhắn.'], 400);
    }

    if (!isset($config['contacts']) || !is_array($config['contacts'])) {
        $config['contacts'] = [];
    }

    $config['contacts'][] = [
        'name' => $name,
        'message' => $message,
        'time' => $time
    ];

    $saved = saveConfigJson($config);
    if ($saved['status'] === 'success') {
        respondJson(['status' => 'success', 'message' => 'Đã lưu liên hệ thành công.']);
    }
    respondJson($saved, 500);
}

// Allow public contact submissions without requiring admin authentication
$allowPublicContacts = array_key_exists('contacts', $data) && is_array($data['contacts']);

// Require admin authentication for other sensitive operations
if ($action !== 'verify' && $action !== 'checkAuth' && $action !== 'logout' && $action !== 'add_contact' && !$allowPublicContacts && !isAdminAuthenticated($data, $config)) {
    respondJson(['status' => 'error', 'message' => 'Không được phép.'], 403);
}

// Check if this is a data save request (has sheet and rows)
if (isset($data['sheet']) && isset($data['rows']) && is_array($data['rows'])) {
    $sheetName = $data['sheet'];
    $rows = $data['rows'];

    if ($sheetName === 'posts') {
        if (!is_array($rows) || count($rows) < 1) {
            respondJson(['status' => 'error', 'message' => 'Dữ liệu bài viết không hợp lệ.'], 400);
        }

        $headerRow = array_shift($rows);
        $ids = [];
        $saved = 0;

        foreach ($rows as $row) {
            if (!is_array($row) || !isset($row[0])) {
                continue;
            }
            $postData = normalizePostRow($row);
            if ($postData['id'] === '') {
                continue;
            }
            $ids[] = $postData['id'];
            if (savePostFile($postData)) {
                $saved++;
            }
        }

        $ids = array_values(array_unique($ids));
        $indexJson = json_encode(['posts' => $ids], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($indexJson === false) {
            respondJson(['status' => 'error', 'message' => 'Không thể chuyển dữ liệu thành JSON.'], 500);
        }

        $indexPath = getPostsIndexPath();
        if (file_put_contents($indexPath, $indexJson) === false) {
            respondJson(['status' => 'error', 'message' => 'Không thể ghi file data.json.'], 500);
        }

        removeStalePostFiles($ids);

        respondJson(['status' => 'success', 'message' => 'Đã lưu dữ liệu bài viết thành công.', 'savedPosts' => $saved]);
    }

    $dataPath = getPostsIndexPath();
    if (!file_exists($dataPath)) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Không tìm thấy data.json.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $currentContent = file_get_contents($dataPath);
    $current = json_decode($currentContent, true);

    if (!is_array($current)) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'data.json không phải JSON hợp lệ.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $current[$sheetName] = $data['rows'];

    $newJSON = json_encode($current, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($newJSON === false) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Không thể chuyển dữ liệu sang JSON.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (file_put_contents($dataPath, $newJSON) === false) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Không thể ghi file data.json.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['status' => 'success', 'message' => 'Đã lưu data.json thành công.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// SAVE ADMIN CONFIG LOGIC
if (isset($data['adminPassword']) || isset($data['vocabularyPassword']) || isset($data['paginationConfig']) || isset($data['pageConfig']) || isset($data['dropdownMenus'])) {
    if (!is_array($config)) {
        $config = $defaultConfig;
    }

    if (isset($data['adminPassword']) && is_string($data['adminPassword']) && trim($data['adminPassword']) !== '') {
        $config['adminPasswordHash'] = password_hash(trim($data['adminPassword']), PASSWORD_DEFAULT);
    }

    if (isset($data['paginationConfig']) && is_array($data['paginationConfig'])) {
        if (!isset($config['paginationConfig']) || !is_array($config['paginationConfig'])) {
            $config['paginationConfig'] = $defaultConfig['paginationConfig'];
        }
        if (isset($data['paginationConfig']['categoriesPerPage'])) {
            $value = intval($data['paginationConfig']['categoriesPerPage']);
            if ($value > 0) {
                $config['paginationConfig']['categoriesPerPage'] = $value;
            }
        }
        if (isset($data['paginationConfig']['postsPerCategoryPage'])) {
            $value = intval($data['paginationConfig']['postsPerCategoryPage']);
            if ($value > 0) {
                $config['paginationConfig']['postsPerCategoryPage'] = $value;
            }
        }
    }

    if (isset($data['vocabularyPassword']) && is_string($data['vocabularyPassword']) && trim($data['vocabularyPassword']) !== '') {
        $config['vocabularyPasswordHash'] = password_hash(trim($data['vocabularyPassword']), PASSWORD_DEFAULT);
    }

    if (isset($data['pageConfig']) && is_array($data['pageConfig'])) {
        $validPageConfig = [];
        foreach ($data['pageConfig'] as $item) {
            if (is_array($item) && isset($item['order']) && isset($item['label']) && isset($item['category'])) {
                $order = intval($item['order']);
                $label = trim($item['label']);
                $category = trim($item['category']);
                if ($order > 0 && $label !== '' && $category !== '') {
                    $validPageConfig[] = [
                        'order' => $order,
                        'label' => $label,
                        'category' => $category
                    ];
                }
            }
        }
        if (!empty($validPageConfig)) {
            $config['pageConfig'] = $validPageConfig;
        }
    }

    if (isset($data['dropdownMenus']) && is_array($data['dropdownMenus'])) {
        $config['dropdownMenus'] = $data['dropdownMenus'];
    }

    $saved = saveConfigJson($config);
    if ($saved['status'] === 'success') {
        echo json_encode(['status' => 'success', 'message' => 'Đã cập nhật cấu hình thành công.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    http_response_code(500);
    echo json_encode($saved, JSON_UNESCAPED_UNICODE);
    exit;
}

// SAVE CONTACTS LOGIC
if (array_key_exists('contacts', $data) && is_array($data['contacts'])) {
    $contacts = [];
    foreach ($data['contacts'] as $contact) {
        if (is_array($contact)) {
            $contacts[] = $contact;
        }
    }
    $config['contacts'] = $contacts;

    if ($rawPhp !== false && $start !== false && $end !== false && $end > $start) {
        $saved = saveConfigJson($config);
        if ($saved['status'] === 'success') {
            echo json_encode(['status' => 'success', 'message' => 'Đã lưu contacts vào admin.php.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        http_response_code(500);
        echo json_encode($saved, JSON_UNESCAPED_UNICODE);
        exit;
    }
}

http_response_code(400);
echo json_encode(['status' => 'error', 'message' => 'Yêu cầu không hợp lệ.'], JSON_UNESCAPED_UNICODE);
?>