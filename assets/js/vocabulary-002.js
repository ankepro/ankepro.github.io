// Configuration - APP_SCRIPT_ID and SHEET_NAME are now kept secret on server
// Client communicates with admin-chinese.php instead

const SHEET_KEYS = {
  hsk1: 'hsk1',
  hsk2: 'hsk2'
};

let configLoaded = false;
let currentSheetKey = 'hsk2';  // Default sheet for p02

async function loadConfig() {
  // Config is no longer needed since credentials are on server
  // We'll use the sheet key based on page (p01 = hsk1, p02 = hsk2)
  const currentFile = window.location.pathname.split('/').pop().split('.')[0];
  if (currentFile.includes('p01')) {
    currentSheetKey = 'hsk1';
  } else {
    currentSheetKey = 'hsk2';
  }
  configLoaded = true;
}

let dataList = [];
let editingIdx = null;
let editingRow = null;
let isPasswordVerified = false;
let lastSearchValue = ""; // Save search value across reloads
let FILTER_STORAGE_KEY = `vocabFilter_`; // Will be updated after config load

function saveFilterState() {
  const searchInput = document.getElementById("q");
  if (searchInput) {
    sessionStorage.setItem(FILTER_STORAGE_KEY, searchInput.value || "");
  }
}

function restoreFilterState() {
  const saved = sessionStorage.getItem(FILTER_STORAGE_KEY);
  if (saved !== null && saved !== undefined && saved !== "") {
    const searchInput = document.getElementById("q");
    if (searchInput) {
      searchInput.value = saved;
      handleSearch();
    }
    sessionStorage.removeItem(FILTER_STORAGE_KEY);
  }
}

// Function to normalize Apps Script response text
function parseAppsScriptResponse(text) {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return { status: "success", data: parsed };
    }
    if (parsed && typeof parsed === "object") {
      if (parsed.status === "success" || parsed.status === "error") {
        return parsed;
      }
      return { status: "success", data: parsed };
    }
    return { status: "success", data: parsed };
  } catch (e1) {
    const firstBracket = text.indexOf("[");
    const lastBracket = text.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const jsonSlice = text.slice(firstBracket, lastBracket + 1);
      try {
        const parsed = JSON.parse(jsonSlice);
        return { status: "success", data: parsed };
      } catch (e2) {
      }
    }
    return { status: "error", msg: "Lỗi phản hồi từ server: " + text.substring(0, 200) };
  }
}

// Function to call admin-chinese.php (secure server bridge)
function callAdminChineseAPI(params) {
  return fetch('/assets/others/base-data/admin-chinese.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .catch(error => {
      console.error('Fetch error:', error);
      return { status: "error", msg: "Lỗi kết nối: " + error.message };
    });
}

// Load data directly from admin-chinese.php (secure server bridge)
async function loadData() {
  const statusMsg = document.getElementById("status-msg");
  if (statusMsg) {
    statusMsg.innerText = "⌛ ĐANG TẢI DỮ LIỆU...";
  }

  try {
    if (!configLoaded) {
      throw new Error('Không thể tải cấu hình từ admin.php');
    }

    const response = await callAdminChineseAPI({
      action: 'read',
      sheet: currentSheetKey
    });

    if (!response || response.status === "error") {
      throw new Error(response?.msg || "Không thể tải dữ liệu từ Google Sheets");
    }

    if (response.data) {
      renderTable((response.data || []).slice(1));
    } else {
      throw new Error("Không có dữ liệu trả về");
    }
  } catch (e) {
    console.error(e);
    // Hide loader even on error
    const loader = document.getElementById("loader-spinner-root");
    if (loader) {
      loader.style.display = "none";
    }
    document.getElementById("status-msg").innerText = "❌ Lỗi tải dữ liệu: " + e.message;
  }
}

window.renderTable = (data) => {
  dataList = data;
  // Store the original index for each row and its actual sheet row number
  for (let i = 0; i < dataList.length; i++) {
    if (Array.isArray(dataList[i])) {
      dataList[i]._rowIndex = i; // Store 0-based index in original array
      dataList[i]._gsheetRow = i + 2; // Actual row number in sheet (header row = 1)
    }
  }
  displayRows(data);

  // Hide loader
  const loader = document.getElementById("loader-spinner-root");
  if (loader) {
    loader.style.display = "none";
  }

  document.getElementById("status-msg").innerText = "✅ HOÀN TẤT";

  // Restore filter state after a reload-triggered refresh
  restoreFilterState();

  setTimeout(() => {
    document.getElementById("status-msg").innerText = "";
  }, 2000);
};

function displayRows(data) {
  let html = "";
  if (!Array.isArray(data)) return;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    // Skip if row is empty or doesn't have Chinese character
    if (!row || !row[0]) continue;

    const chineseChar = escapeHtml(row[0] || "");
    const vietnamese = escapeHtml(row[2] || "");
    const chineseEncoded = encodeURIComponent(row[0]);
    // Get the original dataList index (not the filtered array index)
    const dataListIdx = (row._rowIndex !== undefined) ? row._rowIndex : -1;
    const sheetRow = (row._gsheetRow !== undefined) ? row._gsheetRow : dataListIdx + 2;

    html += `<tr data-list-idx="${dataListIdx}" data-row="${sheetRow}" data-cn="${escapeHtml(row[0])}" data-vi="${vietnamese}">
                    <td class="hanzi-col"><a class="direct-link" href="chinese-p02.html?word=${chineseEncoded}" target="_blank">${chineseChar}</a></td>
                    <td style="color: var(--secondary); font-style: italic;">${escapeHtml(row[1] || "")}</td>
                    <td style="color: #bbb;">${vietnamese}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-vocab-edit" data-list-idx="${dataListIdx}">SỬA</button>
                            <button class="btn-vocab-delete" data-list-idx="${dataListIdx}" style="border-color: #ff3e3e; color: #ff3e3e;">XÓA</button>
                        </div>
                    </td>
                </tr>`;
  }
  document.getElementById("res").innerHTML = html;

  document.querySelectorAll('#res .btn-vocab-edit').forEach(btn => {
    btn.addEventListener('click', function () {
      const idx = parseInt(this.getAttribute('data-list-idx'));
      if (idx >= 0 && idx < dataList.length) {
        const row = dataList[idx];
        if (row) {
          const sheetIdx = (row._rowIndex !== undefined) ? row._rowIndex + 1 : idx + 1;
          editRow(idx, row[0], row[2], sheetIdx);
        }
      }
    });
  });

  document.querySelectorAll('#res .btn-vocab-delete').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const idx = parseInt(this.getAttribute('data-list-idx'));
      if (idx >= 0 && idx < dataList.length) {
        const row = dataList[idx];
        if (row) {
          const sheetIdx = (row._rowIndex !== undefined) ? row._rowIndex + 1 : idx + 1;
          deleteRow(sheetIdx);
        }
      }
    });
  });
}

// Helper function to escape HTML and preserve special characters
function escapeHtml(text) {
  if (!text) return "";
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Show password dialog for authentication
function showPasswordDialog() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div style="
        background: #0d011e;
        padding: 30px;
        border-radius: 12px;
        border: 2px solid #ff0055;
        text-align: center;
        max-width: 300px;
        width: 90%;
      ">
        <h3 style="color: #ff0055; margin-top: 0;">Xác minh mật khẩu</h3>
        <input type="password" id="pwd-input" placeholder="Nhập mật khẩu" style="
          width: 100%;
          box-sizing: border-box;
          padding: 10px;
          margin: 15px 0;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid #ff0055;
          color: #fff;
          border-radius: 8px;
          font-size: 16px;
        " />
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="pwd-ok" style="
            padding: 10px 20px;
            background: #ff0055;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
          ">OK</button>
          <button id="pwd-cancel" style="
            padding: 10px 20px;
            background: transparent;
            color: #ff0055;
            border: 1px solid #ff0055;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
          ">Hủy</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const input = modal.querySelector('#pwd-input');
    const okBtn = modal.querySelector('#pwd-ok');
    const cancelBtn = modal.querySelector('#pwd-cancel');

    input.focus();

    const cleanup = () => {
      document.body.removeChild(modal);
    };

    okBtn.onclick = () => {
      const password = input.value;
      cleanup();
      resolve(password);
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };

    input.onkeypress = (e) => {
      if (e.key === 'Enter') {
        okBtn.click();
      }
    };
  });
}

// Verify vocabulary password with server
async function verifyVocabularyPassword(password) {
  try {
    const response = await fetch('/assets/others/base-data/admin-chinese.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'verifyPassword',
        password: password,
        sheet: currentSheetKey
      })
    });

    if (!response.ok) {
      return { status: 'error', message: 'HTTP ' + response.status };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

async function handleSave() {
  // Verify password first if not already verified on this page load
  if (!isPasswordVerified) {
    const password = await showPasswordDialog();
    if (!password) return;

    const verifyResult = await verifyVocabularyPassword(password);
    if (verifyResult.status !== 'success') {
      alert("❌ Mật khẩu không đúng!");
      return;
    }
    isPasswordVerified = true;
  }

  const cn = document.getElementById("cn").value.trim();
  const vi = document.getElementById("vi").value.trim();

  if (!cn) {
    alert("❌ Hãy nhập chữ Hán!");
    return;
  }

  document.getElementById("btnSubmit").disabled = true;

  try {
    let action = editingIdx === null ? "add" : "update";

    const payload = {
      action: action,
      sheet: currentSheetKey,
      chinese: cn,
      vietnamese: vi
    };

    if (editingRow !== null) {
      payload.rowIdx = editingRow;
    }

    const response = await callAdminChineseAPI(payload);

    if (!response || response.status === "error") {
      let msg = response?.msg || "Lỗi lưu dữ liệu";
      alert("❌ " + msg);
    } else {
      let msg = response.msg || "Lưu thành công!";
      alert("✅ " + msg);

      // Tự động reload sau khi alert đóng
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  } catch (error) {
    alert("❌ Lỗi: " + error.message);
  } finally {
    document.getElementById("btnSubmit").disabled = false;
  }
}

function editRow(idx, cn, vi, sheetRow) {
  editingIdx = idx;
  editingRow = sheetRow;
  document.getElementById("cn").value = cn;
  document.getElementById("vi").value = vi;
  document.getElementById("btnSubmit").innerText = "CẬP NHẬT";
  document.getElementById("btnCancel").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelEdit() {
  editingIdx = null;
  editingRow = null;
  document.getElementById("cn").value = "";
  document.getElementById("vi").value = "";
  document.getElementById("btnSubmit").innerText = "LƯU LẠI";
  document.getElementById("btnCancel").style.display = "none";
}

async function deleteRow(sheetRow) {
  // Verify password first if not already verified
  if (!isPasswordVerified) {
    const password = await showPasswordDialog();
    if (!password) return;

    const verifyResult = await verifyVocabularyPassword(password);
    if (verifyResult.status !== 'success') {
      alert("❌ Mật khẩu không đúng!");
      return;
    }
    isPasswordVerified = true;
  }

  if (!confirm("❓ Bạn chắc chắn muốn xóa dòng này?")) return;

  try {
    const response = await callAdminChineseAPI({
      action: 'delete',
      sheet: currentSheetKey,
      rowIdx: sheetRow
    });

    if (!response || response.status === "error") {
      let msg = response?.msg || "Lỗi xóa dữ liệu";
      alert("❌ " + msg);
    } else {
      let msg = response.msg || "Xóa thành công!";
      alert("✅ " + msg);

      // Tự động reload sau khi alert đóng
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  } catch (error) {
    alert("❌ Lỗi: " + error.message);
  }
}

function handleSearch() {
  const searchInput = document.getElementById("q");
  const key = String(searchInput?.value || "").normalize("NFKC").trim().toLowerCase();
  const filtered = dataList.filter(row => {
    if (!row) return false;
    const chinese = String(row[0] || "").normalize("NFKC");
    const pinyin = String(row[1] || "").normalize("NFKC").toLowerCase();
    const vietnamese = String(row[2] || "").normalize("NFKC").toLowerCase();
    return (
      chinese.includes(key) ||
      pinyin.includes(key) ||
      vietnamese.includes(key)
    );
  });
  displayRows(filtered);
}

function testReload() {
  saveFilterState();
  window.location.reload();
}

(async () => {
  await loadConfig();
  if (configLoaded) {
    FILTER_STORAGE_KEY = `vocabFilter_${currentSheetKey}`;
    loadData();
  } else {
    document.getElementById("table-container").innerHTML = "<p>Lỗi: Không thể tải cấu hình từ admin.php</p>";
  }
})();

const searchInput = document.getElementById("q");
if (searchInput) {
  searchInput.addEventListener("input", handleSearch);
}

// Bảng viết tay
document.addEventListener('DOMContentLoaded', function () {
  const canvas = document.getElementById('writeCanvas');
  const ctx = canvas.getContext('2d');
  const recogBox = document.getElementById('recognition-box');
  const popup = document.getElementById('draw-popup');
  const toggleBtn = document.getElementById('draw-toggle');

  let drawing = false;
  let strokes = [];
  let currentStroke = [];
  let history = [];
  let popupActive = false;

  // Function to initialize/reset canvas size
  function initCanvasSize() {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (width <= 0 || height <= 0) return;

    const targetWidth = width * dpr;
    const targetHeight = height * dpr;
    const lastSnapshot = history.length ? history[history.length - 1] : null;

    if (canvas.width === targetWidth && canvas.height === targetHeight) return;

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#333';

    if (lastSnapshot) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      };
      img.src = lastSnapshot;
    }
  }

  // Initialize canvas on first load
  setTimeout(initCanvasSize, 100);

  function saveHistory() {
    if (history.length > 20) history.shift();
    history.push(canvas.toDataURL());
  }

  toggleBtn.onclick = (e) => {
    if (e) e.stopPropagation();
    popup.classList.toggle('is-hidden');
    popupActive = !popup.classList.contains('is-hidden');
    if (popupActive) {
      setTimeout(initCanvasSize, 50);
      saveHistory();
      canvas.focus();
    }
  };

  document.addEventListener('mousedown', (event) => {
    if (!popupActive) return;
    if (popup.contains(event.target) || event.target === toggleBtn) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('click', (event) => {
    if (!popupActive) return;
    // Nếu click vào trong popup hoặc nút toggle -> cho qua bình thường
    if (popup.contains(event.target) || event.target === toggleBtn) return;
    // Nếu click vào ngoài popup -> đóng popup, không trigger event khác
    event.preventDefault();
    event.stopImmediatePropagation();
    // Blur any focused element
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    popup.classList.add('is-hidden');
    popupActive = false;
  }, true);

  window.clearCanvas = function () {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    recogBox.innerHTML = '';
    strokes = [];
    history = [canvas.toDataURL()];
  };

  window.undo = function () {
    if (history.length > 1) {
      history.pop();
      strokes.pop();
      let img = new Image();
      img.src = history[history.length - 1];
      img.onload = () => {
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        ctx.clearRect(0, 0, displayWidth, displayHeight);
        ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
        recognizeStroke();
      };
    } else {
      clearCanvas();
    }
  };

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    return {
      x: Math.round(clientX - rect.left),
      y: Math.round(clientY - rect.top)
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    currentStroke = [[pos.x], [pos.y], []];
  });

  canvas.addEventListener('pointermove', (e) => {
    e.preventDefault();
    if (!drawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    currentStroke[0].push(pos.x);
    currentStroke[1].push(pos.y);
    currentStroke[2].push(Date.now());
  });

  window.addEventListener('pointerup', () => {
    if (drawing) {
      drawing = false;
      strokes.push(currentStroke);
      saveHistory();
      recognizeStroke();
    }
  });

  async function recognizeStroke() {
    if (strokes.length === 0) return;
    const url = 'https://www.google.com.tw/inputtools/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8';
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    const requestBody = {
      options: 'enable_pre_space',
      requests: [{
        writing_guide: { writing_area_width: displayWidth, writing_area_height: displayHeight },
        ink: strokes, language: 'zh'
      }]
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data[0] === 'SUCCESS') {
        const candidates = data[1][0][1];
        recogBox.innerHTML = '';
        // Chỉ lấy 3 chữ nhận dạng giống nhất, cỡ chữ 14px
        candidates.slice(0, 3).forEach(char => {
          const span = document.createElement('span');
          span.className = 'char-candidate';
          span.innerText = char;
          recogBox.appendChild(span);
        });
      }
    } catch (err) { }
  }
});