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

let library = []; // Mảng trống để chứa dữ liệu từ Google Sheets
let currentCard = null;
let audioPlayer = new Audio();
let chunks = [];
let currentChunkIndex = 0;
let currentSpeed = 1.0; // Biến lưu tốc độ hiện tại

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
        // JSON parse failed, continue to return error
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

// Hàm tải dữ liệu từ Google Sheets thông qua admin-chinese.php
async function loadLibrary() {
  try {
    if (!configLoaded) {
      throw new Error('Cấu hình không được tải');
    }

    const response = await callAdminChineseAPI({
      action: 'read',
      sheet: currentSheetKey
    });

    if (!response || response.status === "error") {
      throw new Error(response?.msg || "Không thể tải dữ liệu từ Google Sheets");
    }

    const rows = response.data || [];

    // Rows đã là mảng 2 chiều [ ["cn", "py", "vi"], ["你好", "...", "..."] ]
    // Bỏ qua dòng tiêu đề và map dữ liệu
    library = rows.slice(1).map(columns => {
      const clean = (val) => val ? val.trim() : "";
      return {
        cn: clean(columns[0]),
        py: clean(columns[1]),
        vi: clean(columns[2])
      };
    }).filter(item => item.cn !== ""); // Loại bỏ dòng rỗng

    if (library.length > 0) {
      const queryWord = getWordFromQuery();
      if (queryWord) {
        const matched = library.find(item => item.cn === queryWord || item.py === queryWord || item.vi === queryWord);
        if (matched) {
          currentCard = matched;
          showCurrentCard();
        } else {
          nextCard();
        }
      } else {
        nextCard();
      }
    } else {
      document.getElementById("main-q").innerText = "Không tìm thấy dữ liệu trong Google Sheets!";
    }

    // Hide loader after loading
    const loader = document.getElementById("loader-spinner-root");
    if (loader) {
      loader.style.display = "none";
    }
  } catch (error) {
    console.error("Lỗi chi tiết:", error);
    document.getElementById("main-q").innerText = "Lỗi: " + error.message;

    // Hide loader even on error
    const loader = document.getElementById("loader-spinner-root");
    if (loader) {
      loader.style.display = "none";
    }
  }
}


// Tự động chạy khi trang web tải xong
window.onload = async function () {
  await loadConfig();
  if (configLoaded) {
    loadLibrary();
  } else {
    document.getElementById("main-q").innerText = "Lỗi: Không thể tải cấu hình từ admin.php";
    // Hide loader
    const loader = document.getElementById("loader-spinner-root");
    if (loader) loader.style.display = "none";
  }

  // Thiết lập thanh điều chỉnh tốc độ
  const speedRange = document.getElementById("speedRange");
  const speedValue = document.getElementById("speedValue");

  if (speedRange && speedValue) {
    // Set giá trị ban đầu
    speedRange.value = currentSpeed;
    speedValue.innerText = currentSpeed;

    // Hàm cập nhật tốc độ
    const updateSpeed = function () {
      currentSpeed = parseFloat(speedRange.value);
      speedValue.innerText = currentSpeed;

      // Update playback rate ngay lập tức nếu đang phát âm
      if (audioPlayer && !audioPlayer.paused) {
        audioPlayer.playbackRate = currentSpeed;
      }
    };

    // Thêm event listeners cho cả desktop và mobile
    speedRange.addEventListener("input", updateSpeed);
    speedRange.addEventListener("change", updateSpeed);
  }
};

function getWordFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get('word')?.trim() || "";
}

function showCurrentCard() {
  if (!currentCard) return;
  stopSpeech();
  document.getElementById("q-label").innerText = "CÂU HỎI: HÁN TỰ";
  document.getElementById("main-q").innerText = currentCard.cn;
  document.getElementById("text-cn").innerText = currentCard.cn;
  document.getElementById("text-py").innerText = currentCard.py;
  document.getElementById("text-vi").innerText = currentCard.vi;
  document.getElementById("search-hanzii-container").style.display = "flex";
  revealAll(false);
}

function nextCard() {
  if (library.length === 0) return;
  stopSpeech();

  currentCard = library[Math.floor(Math.random() * library.length)];

  const modes = [
    { key: "cn", label: "CÂU HỎI: HÁN TỰ" },
    { key: "py", label: "CÂU HỎI: PINYIN" },
    { key: "vi", label: "CÂU HỎI: NGHĨA VIỆT" },
  ];
  const selectedMode = modes[Math.floor(Math.random() * modes.length)];

  document.getElementById("q-label").innerText = selectedMode.label;
  document.getElementById("main-q").innerText = currentCard[selectedMode.key];

  document.getElementById("text-cn").innerText = currentCard.cn;
  document.getElementById("text-py").innerText = currentCard.py;
  document.getElementById("text-vi").innerText = currentCard.vi;

  // HIỆN NÚT TRA CỨU KHI CÓ DỮ LIỆU
  document.getElementById("search-hanzii-container").style.display = "flex";

  revealAll(false);
}

// --- Các hàm bổ trợ giữ nguyên ---
function toggleText(el) {
  const txt = el.querySelector(".content-text");
  txt.classList.toggle("is-hidden");
  txt.classList.toggle("is-visible");
  const button = document.querySelector('button[onclick="revealAll()"]');
  if (button) {
    const allVisible = Array.from(document.querySelectorAll('.content-text')).every(item => item.classList.contains('is-visible'));
    button.innerText = allVisible ? 'HIDE' : 'SHOW';
  }
}

function revealAll(show = null) {
  const button = document.querySelector('button[onclick="revealAll()"]');
  const allVisible = Array.from(document.querySelectorAll('.content-text')).every(item => item.classList.contains('is-visible'));
  const shouldShow = show === null ? !allVisible : show;

  document.querySelectorAll(".content-text").forEach((el) => {
    if (shouldShow) {
      el.classList.remove("is-hidden");
      el.classList.add("is-visible");
    } else {
      el.classList.add("is-hidden");
      el.classList.remove("is-visible");
    }
  });

  if (button) {
    button.innerText = shouldShow ? 'HIDE' : 'SHOW';
  }
}

function stopSpeech() {
  audioPlayer.pause();
  chunks = [];
  currentChunkIndex = 0;
  document.getElementById("btn-speak").innerText = "SPEAK";
}

function handleSpeak() {
  if (!currentCard || !currentCard.cn) return;
  if (!audioPlayer.paused || chunks.length > 0) {
    stopSpeech();
    return;
  }

  const textToSpeak = currentCard.cn;
  chunks = textToSpeak
    .split(/[,.，。！？!?;]/)
    .filter((s) => s.trim().length > 0);
  currentChunkIndex = 0;

  if (chunks.length > 0) {
    playNextChunk();
  }
}

function playNextChunk() {
  if (currentChunkIndex >= chunks.length) {
    stopSpeech();
    return;
  }

  document.getElementById("btn-speak").innerText = "SPEAKING...";
  const text = chunks[currentChunkIndex];

  // Sử dụng link Google TTS
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=zh-CN&client=tw-ob`;

  audioPlayer.src = url;

  // QUAN TRỌNG: Lắng nghe sự kiện 'canplay' để áp dụng tốc độ
  audioPlayer.oncanplay = function () {
    audioPlayer.playbackRate = currentSpeed;
  };

  audioPlayer
    .play()
    .then(() => {
      currentChunkIndex++;
      audioPlayer.onended = playNextChunk;
    })
    .catch(() => {
      // Fallback sang Youdao nếu Google lỗi
      audioPlayer.src = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=zh`;
      audioPlayer.oncanplay = function () {
        audioPlayer.playbackRate = currentSpeed;
      };
      audioPlayer.play();
      currentChunkIndex++;
      audioPlayer.onended = playNextChunk;
    });
}

function searchHanzii() {
  if (!currentCard || !currentCard.cn) return;

  // Lấy nội dung chữ Hán (nếu có nhiều chữ thì nó sẽ search cả cụm)
  const text = currentCard.cn;

  // Tạo link: Hanzii dùng search/word cho từ vựng hoặc search/kanji cho chữ đơn
  // Để tổng quát nhất, dùng link search của họ:
  const url = `https://hanzii.net/search/kanji/${encodeURIComponent(text)}?hl=vi`;

  // Mở trong tab mới
  window.open(url, "_blank");
}

function searchGoogle() {
  if (!currentCard || !currentCard.cn) return;

  const text = currentCard.cn;
  const url = `https://translate.google.com/?hl=vi&sl=zh-CN&tl=vi&op=translate&text=${encodeURIComponent(text)}`;

  window.open(url, "_blank");
}

// Khởi tạo bộ nhận diện giọng nói
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (Recognition) {
  recognition = new Recognition();
  recognition.lang = "zh-CN"; // Thiết lập nhận diện tiếng Trung (Phổ thông)
  recognition.interimResults = false; // Chỉ lấy kết quả cuối cùng
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const userText = event.results[0][0].transcript; // Văn bản máy nghe được
    const targetText = currentCard.cn; // Chữ Hán mẫu

    checkPronunciation(userText, targetText);
  };

  recognition.onspeechend = () => {
    recognition.stop();
    document.getElementById("btn-check-voice").innerText =
      "LISTEN...";
  };

  recognition.onerror = (event) => {
    console.error("Lỗi nhận diện:", event.error);
    document.getElementById("voice-result").innerHTML =
      `<span style="color: #ff4757;">Lỗi: ${event.error}</span>`;
  };
}

function startRecognition() {
  if (!currentCard) return;
  if (!Recognition) {
    alert(
      "Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Hãy dùng Chrome!",
    );
    return;
  }

  // Đã xóa dòng: document.getElementById('voice-result').innerText = "Đang nghe... Hãy đọc to!";

  // Chỉ để lại dòng xóa kết quả cũ để chuẩn bị hiện kết quả mới
  document.getElementById("voice-result").innerText = "";

  document.getElementById("btn-check-voice").innerText = "LISTENING..";
  recognition.start();
}

function checkPronunciation(userText, targetText) {
  const resultDiv = document.getElementById("voice-result");

  // Loại bỏ dấu câu để so sánh chính xác hơn
  const cleanUser = userText.replace(/[.,!?;，。！？]/g, "");
  const cleanTarget = targetText.replace(/[.,!?;，。！？]/g, "");

  if (cleanUser === cleanTarget) {
    resultDiv.innerHTML = `<span style="color: #2ed573;">✔ Chính xác! (${userText})</span>`;
    // Có thể thêm âm thanh chúc mừng ở đây
  } else {
    resultDiv.innerHTML = `<span style="color: #ffa502;">✘ Chưa khớp. Bạn đọc là: "${userText}"</span>`;
  }
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