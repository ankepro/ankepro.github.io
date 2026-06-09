/* --- BĐ trollclick ---*/
const btnNo = document.getElementById('btn-no');
const btnYes = document.getElementById('btn-yes');
const btnSpacer = document.getElementById('btn-spacer');
const trollBox = document.getElementById('troll-box');
const containerInside = document.getElementById('container-inside');
const customAlert = document.getElementById('custom-alert');

let originalCoords = null;
let resetTimer = null; // Biến lưu trữ bộ đếm thời gian hồi vị trí

// Thiết lập vị trí ban đầu đồng bộ hình học tuyệt đối
function initPosition() {
    const spacerRect = btnSpacer.getBoundingClientRect();
    const containerRect = containerInside.getBoundingClientRect();

    originalCoords = {
        left: spacerRect.left - containerRect.left,
        top: spacerRect.top - containerRect.top
    };

    btnNo.style.left = originalCoords.left + 'px';
    btnNo.style.top = originalCoords.top + 'px';
}

window.addEventListener('DOMContentLoaded', initPosition);
window.addEventListener('load', initPosition);
window.addEventListener('resize', initPosition);

// Hàm đưa nút về vị trí gốc ban đầu
function resetPosition() {
    if (originalCoords) {
        btnNo.style.left = originalCoords.left + 'px';
        btnNo.style.top = originalCoords.top + 'px';
    }
}

// Kiểm tra chống đè nút Có
function isOverlappingWithYes(nextLeft, nextTop, btnNoWidth, btnNoHeight) {
    const yesLeft = btnYes.offsetLeft;
    const yesTop = btnYes.offsetTop;
    const yesWidth = btnYes.offsetWidth;
    const yesHeight = btnYes.offsetHeight;
    const padding = 35;

    return !(
        nextLeft + btnNoWidth < yesLeft - padding ||
        nextLeft > yesLeft + yesWidth + padding ||
        nextTop + btnNoHeight < yesTop - padding ||
        nextTop > yesTop + yesHeight + padding
    );
}

function moveButton(e) {
    // XÓA BỘ ĐẾM CŨ: Nếu người dùng đang đuổi theo nút liên tục, reset lại thời gian chờ 5s
    clearTimeout(resetTimer);

    const containerRect = containerInside.getBoundingClientRect();
    const boxWidth = containerInside.clientWidth;
    const boxHeight = containerInside.clientHeight;

    const btnWidth = btnNo.offsetWidth;
    const btnHeight = btnNo.offsetHeight;

    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const cursorX = clientX - containerRect.left;
    const cursorY = clientY - containerRect.top;

    const currentLeft = btnNo.offsetLeft;
    const currentTop = btnNo.offsetTop;
    const btnCenterX = currentLeft + btnWidth / 2;
    const btnCenterY = currentTop + btnHeight / 2;

    let dirX = btnCenterX - cursorX;
    let dirY = btnCenterY - cursorY;

    if (dirX === 0 && dirY === 0) {
        dirX = Math.random() - 0.5;
        dirY = Math.random() - 0.5;
    }

    const distance = Math.sqrt(dirX * dirX + dirY * dirY);
    dirX /= distance;
    dirY /= distance;

    // Đảm bảo khoảng cách nhảy tối thiểu bằng chiều rộng nút + 40px để không bị bấm trúng
    const minStep = btnWidth + 40;
    const maxStep = Math.max(minStep + 20, boxWidth / 2.5);
    const moveStep = minStep + Math.random() * (maxStep - minStep);

    let targetX = currentLeft + dirX * moveStep;
    let targetY = currentTop + dirY * moveStep;

    const minBoundaryX = 10;
    const maxBoundaryX = boxWidth - btnWidth - 10;
    const minBoundaryY = -150;
    const maxBoundaryY = boxHeight + 100;

    // Logic bật nẩy chống dồn góc chết
    if (targetX < minBoundaryX || targetX > maxBoundaryX) {
        dirX = -dirX;
        targetX = currentLeft + dirX * (minStep + Math.random() * 30);
    }
    if (targetY < minBoundaryY || targetY > maxBoundaryY) {
        dirY = -dirY;
        targetY = currentTop + dirY * (minStep + Math.random() * 30);
    }

    // Chống đè lên nút Có
    if (isOverlappingWithYes(targetX, targetY, btnWidth, btnHeight)) {
        if (targetX < btnYes.offsetLeft) {
            targetX = btnYes.offsetLeft - btnWidth - 20;
        } else {
            targetX = btnYes.offsetLeft + btnYes.offsetWidth + 20;
        }
    }

    // Ép cứng lề tuyệt đối trong div .trollclick
    if (targetX < minBoundaryX) targetX = minBoundaryX;
    if (targetX > maxBoundaryX) targetX = maxBoundaryX;

    const totalBoxHeight = trollBox.clientHeight;
    const currentTopInTotal = targetY + containerInside.offsetTop;

    if (currentTopInTotal < 15) {
        targetY = 15 - containerInside.offsetTop;
    }
    if (currentTopInTotal + btnHeight > totalBoxHeight - 15) {
        targetY = totalBoxHeight - 15 - btnHeight - containerInside.offsetTop;
    }

    // Thực thi di chuyển tức thì
    btnNo.style.left = targetX + 'px';
    btnNo.style.top = targetY + 'px';

    // KÍCH HOẠT HẸN GIỜ: Sau 5 giây (5000ms) nếu không có hành động nào khác, nút sẽ quay về chỗ cũ
    resetTimer = setTimeout(resetPosition, 5000);
}

// Bẫy quét rada hồng ngoại từ xa (20px) xung quanh nút
containerInside.addEventListener('mousemove', function (e) {
    const containerRect = containerInside.getBoundingClientRect();
    const curX = e.clientX - containerRect.left;
    const curY = e.clientY - containerRect.top;

    const bLeft = btnNo.offsetLeft;
    const bTop = btnNo.offsetTop;

    if (curX >= bLeft - 20 && curX <= bLeft + btnNo.offsetWidth + 20 &&
        curY >= bTop - 20 && curY <= bTop + btnNo.offsetHeight + 20) {
        moveButton(e);
    }
});

btnNo.addEventListener('mouseover', moveButton);
btnNo.addEventListener('mouseenter', moveButton);

btnNo.addEventListener('touchstart', function (e) {
    e.preventDefault();
    moveButton(e);
});

function handleYesClick() {
    customAlert.classList.add('show');
    setTimeout(() => {
        customAlert.classList.remove('show');
    }, 3000);
}
/*--- KT Trollclick ---*/