// 전역 변수
let guestbookData = JSON.parse(localStorage.getItem('guestbookData')) || [];
let isSupabaseConnected = false;
let guestbookSubscription = null;
let rsvpSubscription = null;
let qrScannerStream = null;
let qrScannerInterval = null;
let currentQRCode = null;

// DOM 로드 완료 후 실행
document.addEventListener('DOMContentLoaded', async function() {
    // Supabase 초기화 시도
    await initializeSupabase();
    
    // 방명록 메시지 로드
    await loadGuestbookMessages();
    
    // 갤러리 이미지 클릭 이벤트
    setupGalleryModal();
    
    // 스크롤 애니메이션 설정
    setupScrollAnimations();
    
    // 실시간 구독 설정
    setupRealtimeSubscriptions();
});

// 길찾기 기능
function openNavigation() {
    const address = "서울특별시 강남구 테헤란로 123";
    
    // 모바일 디바이스 감지
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        // 카카오맵 앱이 있으면 카카오맵으로, 없으면 구글맵으로
        const kakaoUrl = `kakaomap://search?q=${encodeURIComponent(address)}`;
        const googleUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}`;
        
        // 카카오맵 앱 실행 시도
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = kakaoUrl;
        document.body.appendChild(iframe);
        
        // 1초 후 카카오맵이 실행되지 않았으면 구글맵으로
        setTimeout(() => {
            document.body.removeChild(iframe);
            window.open(googleUrl, '_blank');
        }, 1000);
    } else {
        // 데스크탑에서는 구글맵 웹 버전
        const googleUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}`;
        window.open(googleUrl, '_blank');
    }
}

// 전화 걸기 기능
function makeCall(phoneNumber) {
    // 모바일에서는 전화 앱 실행, 데스크탑에서는 번호 복사
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        window.location.href = `tel:${phoneNumber}`;
    } else {
        // 데스크탑에서는 번호를 클립보드에 복사
        copyToClipboard(phoneNumber);
        showNotification(`전화번호가 복사되었습니다: ${phoneNumber}`);
    }
}

// 이메일 보내기 기능
function sendEmail(email) {
    const subject = encodeURIComponent('컨퍼런스 관련 문의');
    const body = encodeURIComponent('안녕하세요. 컨퍼런스 관련해서 문의드립니다.\n\n');
    
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}

// RSVP 응답 기능
function rsvpResponse(response) {
    const responses = {
        'yes': '참석',
        'no': '불참'
    };
    
    const responseText = responses[response];
    
    // 로컬 스토리지에 응답 저장
    localStorage.setItem('rsvpResponse', response);
    
    // 시각적 피드백
    const buttons = document.querySelectorAll('.btn-rsvp');
    buttons.forEach(btn => {
        btn.style.opacity = '0.5';
        btn.disabled = true;
    });
    
    const selectedBtn = response === 'yes' ? 
        document.querySelector('.btn-yes') : 
        document.querySelector('.btn-no');
    
    selectedBtn.style.opacity = '1';
    selectedBtn.innerHTML = `<i class="fas fa-check"></i> ${responseText} 완료`;
    
    showNotification(`${responseText} 응답이 등록되었습니다.`);
    
    // 실제 서버 전송 (추후 구현)
    // sendRSVPToServer(response);
}

// 방명록 제출 기능
function submitGuestbook() {
    const nameInput = document.getElementById('guestName');
    const messageInput = document.getElementById('guestMessage');
    
    const name = nameInput.value.trim();
    const message = messageInput.value.trim();
    
    if (!name) {
        showNotification('이름을 입력해주세요.', 'error');
        nameInput.focus();
        return;
    }
    
    if (!message) {
        showNotification('메시지를 입력해주세요.', 'error');
        messageInput.focus();
        return;
    }
    
    // 새 메시지 객체 생성
    const newMessage = {
        id: Date.now(),
        name: name,
        message: message,
        date: new Date().toISOString().split('T')[0]
    };
    
    // 데이터 배열에 추가 (최신순으로)
    guestbookData.unshift(newMessage);
    
    // 로컬 스토리지에 저장
    localStorage.setItem('guestbookData', JSON.stringify(guestbookData));
    
    // 방명록 다시 로드
    loadGuestbookMessages();
    
    // 입력 폼 초기화
    nameInput.value = '';
    messageInput.value = '';
    
    showNotification('메시지가 등록되었습니다.');
    
    // 실제 서버 전송 (추후 구현)
    // sendGuestbookToServer(newMessage);
}

// 방명록 메시지 로드
function loadGuestbookMessages() {
    const messagesContainer = document.getElementById('guestbookMessages');
    
    if (guestbookData.length === 0) {
        messagesContainer.innerHTML = `
            <div class="message-item">
                <div class="message-content" style="text-align: center; color: #999;">
                    아직 등록된 메시지가 없습니다.<br>
                    첫 번째 메시지를 남겨보세요!
                </div>
            </div>
        `;
        return;
    }
    
    const messagesHtml = guestbookData.map(msg => `
        <div class="message-item">
            <div class="message-header">
                <span class="message-name">${escapeHtml(msg.name)}</span>
                <span class="message-date">${msg.date}</span>
            </div>
            <div class="message-content">
                ${escapeHtml(msg.message)}
            </div>
        </div>
    `).join('');
    
    messagesContainer.innerHTML = messagesHtml;
}

// 계좌번호 복사 기능
function copyAccount(accountNumber) {
    copyToClipboard(accountNumber);
    showNotification('계좌번호가 복사되었습니다.');
}

// 클립보드에 텍스트 복사
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        // 최신 브라우저
        navigator.clipboard.writeText(text);
    } else {
        // 구형 브라우저 호환
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
    }
}

// 알림 메시지 표시
function showNotification(message, type = 'success') {
    // 기존 알림 제거
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // 새 알림 생성
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // 스타일 적용
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        font-size: 0.9rem;
        max-width: 90%;
        animation: slideInDown 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // 3초 후 자동 제거
    setTimeout(() => {
        notification.style.animation = 'slideOutUp 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

// HTML 이스케이프 처리
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// 갤러리 모달 설정
function setupGalleryModal() {
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    galleryItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            openImageModal(item.querySelector('img'), index);
        });
    });
}

// 이미지 모달 열기
function openImageModal(img, index) {
    // 모달 HTML 생성
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <div class="modal-backdrop">
            <div class="modal-content">
                <button class="modal-close">&times;</button>
                <img src="${img.src}" alt="${img.alt}">
                <div class="modal-nav">
                    <button class="modal-prev">‹</button>
                    <span class="modal-counter">${index + 1} / ${document.querySelectorAll('.gallery-item').length}</span>
                    <button class="modal-next">›</button>
                </div>
            </div>
        </div>
    `;
    
    // 모달 스타일
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 2000;
        animation: fadeIn 0.3s ease-out;
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // 이벤트 리스너
    modal.querySelector('.modal-close').addEventListener('click', closeImageModal);
    modal.querySelector('.modal-backdrop').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeImageModal();
    });
    
    // 키보드 이벤트
    document.addEventListener('keydown', handleModalKeyboard);
}

// 이미지 모달 닫기
function closeImageModal() {
    const modal = document.querySelector('.image-modal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            modal.remove();
            document.body.style.overflow = '';
            document.removeEventListener('keydown', handleModalKeyboard);
        }, 300);
    }
}

// 모달 키보드 이벤트 핸들러
function handleModalKeyboard(e) {
    if (e.key === 'Escape') {
        closeImageModal();
    }
}

// 스크롤 애니메이션 설정
function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.6s ease-out';
                entry.target.style.opacity = '1';
            }
        });
    }, observerOptions);
    
    // 섹션들에 애니메이션 적용
    document.querySelectorAll('section').forEach(section => {
        section.style.opacity = '0';
        observer.observe(section);
    });
}

// CSS 애니메이션 정의
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInDown {
        from {
            transform: translate(-50%, -100%);
            opacity: 0;
        }
        to {
            transform: translate(-50%, 0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutUp {
        from {
            transform: translate(-50%, 0);
            opacity: 1;
        }
        to {
            transform: translate(-50%, -100%);
            opacity: 0;
        }
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    .image-modal .modal-backdrop {
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    }
    
    .image-modal .modal-content {
        position: relative;
        max-width: 90%;
        max-height: 90%;
        text-align: center;
    }
    
    .image-modal .modal-close {
        position: absolute;
        top: -40px;
        right: 0;
        background: none;
        border: none;
        color: white;
        font-size: 2rem;
        cursor: pointer;
        z-index: 1001;
    }
    
    .image-modal img {
        max-width: 100%;
        max-height: calc(100vh - 120px);
        border-radius: 10px;
    }
    
    .image-modal .modal-nav {
        margin-top: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 20px;
        color: white;
    }
    
    .image-modal .modal-prev,
    .image-modal .modal-next {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        font-size: 1.5rem;
        cursor: pointer;
        transition: background 0.3s ease;
    }
    
    .image-modal .modal-prev:hover,
    .image-modal .modal-next:hover {
        background: rgba(255, 255, 255, 0.3);
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
`;
document.head.appendChild(style);

// 디버깅 도구
window.debugQR = {
    // QR 라이브러리 로드 상태 확인
    checkQRLibrary: function() {
        console.log('QRCode 라이브러리 상태:', typeof QRCode !== 'undefined' ? '로드됨' : '로드 안됨');
        if (typeof QRCode !== 'undefined') {
            console.log('QRCode 객체:', QRCode);
        }
    },
    
    // 수동 QR 코드 생성 테스트
    testQRGeneration: async function() {
        try {
            await generateQRCode();
        } catch (error) {
            console.error('테스트 QR 생성 실패:', error);
        }
    },
    
    // 현재 QR 코드 상태
    getCurrentQR: function() {
        console.log('현재 QR 코드:', currentQRCode);
        const canvas = document.getElementById('qrCodeCanvas');
        if (canvas) {
            console.log('QR 캔버스 상태:', canvas.width, 'x', canvas.height);
        }
    }
};

// Supabase 설정 도우미 함수 (디버깅용)
window.debugSupabase = {
    // 수동 Supabase 연결 테스트
    testConnection: async function(url, key) {
        try {
            if (window.supabaseHelpers) {
                const success = await window.supabaseHelpers.setupSupabase(url, key);
                console.log('테스트 결과:', success ? '성공' : '실패');
                return success;
            }
        } catch (error) {
            console.error('테스트 오류:', error);
            return false;
        }
    },
    
    // 테스트 데이터 생성
    createTestData: function() {
        if (window.supabaseHelpers) {
            window.supabaseHelpers.createTestData();
        }
    },
    
    // 현재 연결 상태 확인
    checkStatus: function() {
        console.log('Supabase 연결 상태:', isSupabaseConnected);
        if (window.supabaseConfig) {
            console.log('Supabase 클라이언트 상태:', window.supabaseConfig.isConnected());
        }
    }
};

// Supabase 초기화 함수
async function initializeSupabase() {
    try {
        // supabase-config.js가 로드되었는지 확인
        if (typeof window.supabaseConfig !== 'undefined') {
            // 실제 프로덕션에서는 환경 변수를 사용하세요
            // 예시: 기본 값으로 설정 (실제 프로젝트에서는 수정 필요)
            const supabaseUrl = 'YOUR_SUPABASE_URL';
            const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
            
            if (supabaseUrl !== 'YOUR_SUPABASE_URL' && supabaseKey !== 'YOUR_SUPABASE_ANON_KEY') {
                const success = await window.supabaseHelpers.setupSupabase(supabaseUrl, supabaseKey);
                if (success) {
                    isSupabaseConnected = true;
                    console.log('✅ Supabase 연결 성공!');
                } else {
                    console.log('❌ Supabase 연결 실패 - 로컬 저장소 사용');
                }
            } else {
                console.log('🚧 Supabase 설정이 필요합니다. 로컬 저장소만 사용합니다.');
            }
        } else {
            console.log('🚧 supabase-config.js가 로드되지 않음 - 로컬 저장소만 사용');
        }
    } catch (error) {
        console.error('Supabase 초기화 오류:', error);
    }
}

// 실시간 구독 설정
function setupRealtimeSubscriptions() {
    if (!isSupabaseConnected || !window.supabaseConfig) return;
    
    try {
        // 방명록 실시간 구독
        guestbookSubscription = window.supabaseConfig.subscribeToGuestbook((newMessage) => {
            console.log('새 방명록 메시지 수신:', newMessage);
            // 새 메시지를 화면에 추가
            addNewGuestbookMessage(newMessage);
        });
        
        // RSVP 실시간 구독
        rsvpSubscription = window.supabaseConfig.subscribeToRSVP((newRSVP) => {
            console.log('새 RSVP 응답 수신:', newRSVP);
            // RSVP 통계 업데이트 등의 처리를 여기서 할 수 있습니다
        });
        
        console.log('✅ 실시간 구독 설정 완료');
    } catch (error) {
        console.error('실시간 구독 설정 오륙:', error);
    }
}

// 새 방명록 메시지를 화면에 추가
function addNewGuestbookMessage(message) {
    const messagesContainer = document.getElementById('guestbookMessages');
    const date = new Date(message.created_at).toLocaleDateString('ko-KR');
    
    const messageHtml = `
        <div class="message-item" style="animation: fadeInUp 0.5s ease-out;">
            <div class="message-header">
                <span class="message-name">${escapeHtml(message.name)}</span>
                <span class="message-date">${date}</span>
            </div>
            <div class="message-content">
                ${escapeHtml(message.message)}
            </div>
        </div>
    `;
    
    // 빈 메시지 처리
    const emptyMessage = messagesContainer.querySelector('.message-item .message-content[style*="text-align: center"]');
    if (emptyMessage) {
        messagesContainer.innerHTML = messageHtml;
    } else {
        messagesContainer.insertAdjacentHTML('afterbegin', messageHtml);
    }
}

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    // 실시간 구독 정리
    if (guestbookSubscription) {
        guestbookSubscription.unsubscribe();
    }
    if (rsvpSubscription) {
        rsvpSubscription.unsubscribe();
    }
});

// 페이지 로드 시 저장된 RSVP 응답 확인
document.addEventListener('DOMContentLoaded', function() {
    const savedResponse = localStorage.getItem('rsvpResponse');
    if (savedResponse) {
        // 저장된 응답이 있으면 버튼 상태 업데이트
        setTimeout(() => {
            rsvpResponse(savedResponse);
        }, 500);
    }
});

// 서비스 워커 등록 (PWA 지원)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// ==============================================
// QR 코드 관련 기능
// ==============================================

// QR 코드 라이브러리 로드 확인

// QR 코드 생성 기능
async function generateQRCode() {
    try {
        // QR 코드 라이브러리 대기
        showNotification('QR 코드 생성 준비 중...', 'info');
        if (typeof window.waitForQRLibrary === 'function') {
            await window.waitForQRLibrary();
        } else {
            throw new Error('QR 라이브러리 로더가 준비되지 않았습니다');
        }
        
        // 참석자 정보 가져오기
        const guestName = prompt('이름을 입력해주세요:');
        if (!guestName || guestName.trim() === '') {
            showNotification('QR 코드 생성이 취소되었습니다.', 'error');
            return;
        }
        
        const timestamp = Date.now();
        const qrId = `QR-${timestamp.toString(36).toUpperCase()}`;
        
        // QR 코드 데이터 생성
        const qrData = {
            id: qrId,
            name: guestName.trim(),
            eventId: window.supabaseConfig?.currentEventId || 'default-event',
            timestamp: timestamp,
            status: 'active'
        };
        
        const qrString = JSON.stringify(qrData);
        
        // QR 코드 캔버스에 그리기
        const canvas = document.getElementById('qrCodeCanvas');
        if (!canvas) {
            throw new Error('QR 코드 캔버스를 찾을 수 없습니다.');
        }
        
        await QRCode.toCanvas(canvas, qrString, {
            width: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        // QR 코드 정보 표시
        document.getElementById('qrCodeId').textContent = qrId;
        document.getElementById('qrCodeName').textContent = guestName.trim();
        
        // QR 코드 섹션 표시
        document.getElementById('qrCodeSection').style.display = 'block';
        
        // 전역 변수에 저장
        currentQRCode = qrData;
        
        // Supabase에 QR 코드 정보 저장
        if (isSupabaseConnected && window.supabaseConfig) {
            await saveQRCodeToDB(qrData, canvas.toDataURL());
        }
        
        console.log('QR 코드 생성 완료:', qrId);
        showNotification(`${guestName.trim()}님의 QR 코드가 생성되었습니다!`);
        
    } catch (error) {
        console.error('QR 코드 생성 실패:', error);
        
        // 구체적인 오류 메시지 제공
        if (error.message.includes('라이브러리') || error.message.includes('QRCode')) {
            showNotification('QR 코드 라이브러리 로드에 실패했습니다. 네트워크 연결을 확인하고 페이지를 새로고침해주세요.', 'error');
        } else if (error.message.includes('CDN') || error.message.includes('로드')) {
            showNotification('외부 라이브러리 연결에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
        } else if (error.message.includes('타임아웃')) {
            showNotification('라이브러리 로드 시간이 초과되었습니다. 페이지를 새로고침해주세요.', 'error');
        } else {
            showNotification(`QR 코드 생성에 실패했습니다: ${error.message}`, 'error');
        }
        
        // 개발자를 위한 디버깅 정보
        console.log('🛠️ QR 라이브러리 상태 확인:', typeof window.debugQR === 'object' ? window.debugQR.checkQRLibrary() : '디버깅 도구 없음');
    }
}

// QR 코드를 DB에 저장
async function saveQRCodeToDB(qrData, imageDataUrl) {
    try {
        const { data, error } = await window.supabaseConfig.supabase
            .from('qr_codes')
            .insert([{
                event_id: window.supabaseConfig.currentEventId,
                qr_data: JSON.stringify(qrData),
                qr_image_url: imageDataUrl,
                is_used: false
            }])
            .select();
            
        if (error) throw error;
        console.log('QR 코드 DB 저장 완료:', data);
    } catch (error) {
        console.error('QR 코드 DB 저장 실패:', error);
    }
}

// QR 코드 다운로드
function downloadQRCode() {
    const canvas = document.getElementById('qrCodeCanvas');
    if (!canvas || !currentQRCode) {
        showNotification('QR 코드가 생성되지 않았습니다.', 'error');
        return;
    }
    
    try {
        // 캔버스에 내용이 있는지 확인
        const dataUrl = canvas.toDataURL();
        if (dataUrl === 'data:,' || dataUrl.length < 100) {
            throw new Error('QR 코드 데이터가 비어있습니다.');
        }
        
        const link = document.createElement('a');
        link.download = `QR-Code-${currentQRCode.id}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification(`${currentQRCode.name}님의 QR 코드가 다운로드되었습니다.`);
    } catch (error) {
        console.error('QR 코드 다운로드 실패:', error);
        showNotification('QR 코드 다운로드에 실패했습니다. QR 코드를 다시 생성해주세요.', 'error');
    }
}

// QR 코드 공유
function shareQRCode() {
    const canvas = document.getElementById('qrCodeCanvas');
    if (!canvas || !currentQRCode) {
        showNotification('QR 코드가 생성되지 않았습니다.', 'error');
        return;
    }
    
    if (navigator.share) {
        // 모바일 Web Share API 사용
        canvas.toBlob(async (blob) => {
            const file = new File([blob], `QR-Code-${currentQRCode.id}.png`, { type: 'image/png' });
            
            try {
                await navigator.share({
                    title: '컨퍼런스 입장용 QR 코드',
                    text: `${currentQRCode.name}님의 입장용 QR 코드입니다.`,
                    files: [file]
                });
                showNotification('QR 코드가 공유되었습니다.');
            } catch (error) {
                console.error('공유 실패:', error);
                fallbackShare();
            }
        });
    } else {
        fallbackShare();
    }
}

// 공유 폴백 (클립보드 복사)
function fallbackShare() {
    const shareText = `컨퍼런스 입장용 QR 코드\n참석자: ${currentQRCode.name}\nQR ID: ${currentQRCode.id}`;
    
    copyToClipboard(shareText);
    showNotification('QR 코드 정보가 복사되었습니다.');
}

// ==============================================
// QR 코드 스캔 기능
// ==============================================

// QR 코드 스캐너 시작
async function startQRScanner() {
    try {
        // jsQR 라이브러리 확인
        if (typeof jsQR === 'undefined') {
            showNotification('QR 스캔 기능을 사용할 수 없습니다. jsQR 라이브러리가 로드되지 않았습니다.', 'error');
            return;
        }
        
        const video = document.getElementById('qrScannerVideo');
        const canvas = document.getElementById('qrScannerCanvas');
        const placeholder = document.querySelector('.scanner-placeholder');
        
        // 카메라 스트림 얻기
        qrScannerStream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment', // 후면 카메라 우선
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });
        
        video.srcObject = qrScannerStream;
        video.play();
        
        // UI 업데이트
        video.style.display = 'block';
        placeholder.style.display = 'none';
        document.querySelector('.btn-start-scan').style.display = 'none';
        document.querySelector('.btn-stop-scan').style.display = 'inline-flex';
        
        // QR 코드 스캔 시작
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const context = canvas.getContext('2d');
        
        qrScannerInterval = setInterval(() => {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                
                if (code) {
                    handleQRCodeDetection(code.data);
                }
            }
        }, 100);
        
        showNotification('QR 코드 스캐너가 시작되었습니다.');
        
    } catch (error) {
        console.error('카메라 접근 실패:', error);
        showNotification('카메라에 접근할 수 없습니다.', 'error');
    }
}

// QR 코드 스캐너 정지
function stopQRScanner() {
    if (qrScannerStream) {
        qrScannerStream.getTracks().forEach(track => track.stop());
        qrScannerStream = null;
    }
    
    if (qrScannerInterval) {
        clearInterval(qrScannerInterval);
        qrScannerInterval = null;
    }
    
    const video = document.getElementById('qrScannerVideo');
    const placeholder = document.querySelector('.scanner-placeholder');
    
    video.style.display = 'none';
    placeholder.style.display = 'block';
    document.querySelector('.btn-start-scan').style.display = 'inline-flex';
    document.querySelector('.btn-stop-scan').style.display = 'none';
    
    // 스캔 결과 숨기기
    document.getElementById('scanResult').style.display = 'none';
}

// QR 코드 검출 처리
function handleQRCodeDetection(qrData) {
    try {
        const data = JSON.parse(qrData);
        
        // 유효한 QR 코드인지 확인
        if (data.id && data.name && data.eventId) {
            displayScanResult(data);
            stopQRScanner(); // 스캔 중지
        } else {
            console.log('유효하지 않은 QR 코드 형식');
        }
    } catch (error) {
        console.log('비-JSON QR 코드:', qrData);
        // 비-JSON QR 코드도 표시 (예: URL 등)
        displayScanResult({ id: 'UNKNOWN', name: qrData.substring(0, 50), status: 'unknown' });
        stopQRScanner();
    }
}

// 스캔 결과 표시
function displayScanResult(data) {
    const resultDiv = document.getElementById('scanResult');
    const nameSpan = resultDiv.querySelector('.result-name');
    const statusSpan = resultDiv.querySelector('.result-status');
    
    nameSpan.textContent = data.name || 'Unknown';
    statusSpan.textContent = data.status === 'unknown' ? '비인식 QR' : '입장 대기';
    statusSpan.style.background = data.status === 'unknown' ? '#e67e22' : '#27ae60';
    
    resultDiv.style.display = 'block';
    
    // 전역 변수에 저장
    window.currentScannedQR = data;
    
    showNotification(`QR 코드가 스캔되었습니다: ${data.name}`);
}

// 입장 승인 처리
async function approveEntry() {
    const scannedData = window.currentScannedQR;
    if (!scannedData) {
        showNotification('스캔된 QR 코드가 없습니다.', 'error');
        return;
    }
    
    try {
        // Supabase에 입장 기록 저장
        if (isSupabaseConnected && window.supabaseConfig) {
            await updateQRCodeStatus(scannedData.id, true);
        }
        
        showNotification(`${scannedData.name}님의 입장이 승인되었습니다.`);
        
        // UI 업데이트
        const statusSpan = document.querySelector('.result-status');
        statusSpan.textContent = '입장 완료';
        statusSpan.style.background = '#2ecc71';
        
        document.querySelector('.btn-approve').disabled = true;
        document.querySelector('.btn-approve').innerHTML = '<i class="fas fa-check"></i> 입장 완료';
        
    } catch (error) {
        console.error('입장 승인 실패:', error);
        showNotification('입장 승인에 실패했습니다.', 'error');
    }
}

// QR 코드 사용 상태 업데이트
async function updateQRCodeStatus(qrId, isUsed) {
    try {
        const { data, error } = await window.supabaseConfig.supabase
            .from('qr_codes')
            .update({ 
                is_used: isUsed,
                used_at: isUsed ? new Date().toISOString() : null
            })
            .like('qr_data', `%"id":"${qrId}"%`)
            .select();
            
        if (error) throw error;
        console.log('QR 코드 상태 업데이트 완료:', data);
    } catch (error) {
        console.error('QR 코드 상태 업데이트 실패:', error);
    }
}

// ==============================================
// 관리자 모드 기능
// ==============================================

// 관리자 모드 토글
function toggleAdminMode() {
    isAdminMode = !isAdminMode;
    
    const qrScannerSection = document.getElementById('qrScannerSection');
    const adminDashboard = document.getElementById('adminDashboard');
    const adminToggleBtn = document.querySelector('.btn-admin-toggle');
    
    if (isAdminMode) {
        qrScannerSection.style.display = 'block';
        adminDashboard.style.display = 'block';
        adminToggleBtn.innerHTML = '<i class="fas fa-user"></i> 사용자 모드';
        adminToggleBtn.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
        showNotification('관리자 모드가 활성화되었습니다.');
        
        // 대시보드 데이터 로드
        loadDashboardData();
    } else {
        qrScannerSection.style.display = 'none';
        adminDashboard.style.display = 'none';
        adminToggleBtn.innerHTML = '<i class="fas fa-cog"></i> 관리자 모드';
        adminToggleBtn.style.background = 'linear-gradient(135deg, #6c5ce7, #5f4fcf)';
        showNotification('사용자 모드로 돌아갔습니다.');
        
        // 스캐너 중지
        if (qrScannerStream) {
            stopQRScanner();
        }
        
        // 실시간 모드 해제
        if (dashboardRealtimeMode) {
            toggleRealtimeMode();
        }
    }
}

// ==============================================
// 관리자 대시보드 기능
// ==============================================

// 대시보드 데이터 로드
async function loadDashboardData() {
    try {
        showNotification('대시보드 데이터를 로드 중...', 'info');
        
        // 병렬로 데이터 로드
        await Promise.all([
            loadStatistics(),
            loadAttendeeList(),
            loadAdminGuestbook(),
            loadQRStats()
        ]);
        
        console.log('대시보드 데이터 로드 완료');
        
    } catch (error) {
        console.error('대시보드 데이터 로드 실패:', error);
        showNotification('대시보드 데이터 로드에 실패했습니다.', 'error');
    }
}

// 통계 데이터 로드
async function loadStatistics() {
    try {
        let totalResponses = 0;
        let yesResponses = 0;
        let noResponses = 0;
        let entryCount = 0;
        
        if (isSupabaseConnected && window.supabaseConfig) {
            // Supabase에서 데이터 로드
            const { data: rsvpData } = await window.supabaseConfig.supabase
                .from('rsvp_responses')
                .select('response')
                .eq('event_id', window.supabaseConfig.currentEventId);
            
            const { data: qrData } = await window.supabaseConfig.supabase
                .from('qr_codes')
                .select('is_used')
                .eq('event_id', window.supabaseConfig.currentEventId)
                .eq('is_used', true);
            
            if (rsvpData) {
                totalResponses = rsvpData.length;
                yesResponses = rsvpData.filter(r => r.response === 'yes').length;
                noResponses = rsvpData.filter(r => r.response === 'no').length;
            }
            
            if (qrData) {
                entryCount = qrData.length;
            }
        } else {
            // 로컬 데이터 사용
            const savedResponse = localStorage.getItem('rsvpResponse');
            if (savedResponse) {
                totalResponses = 1;
                if (savedResponse === 'yes') yesResponses = 1;
                if (savedResponse === 'no') noResponses = 1;
            }
        }
        
        // UI 업데이트
        document.getElementById('totalResponses').textContent = totalResponses;
        document.getElementById('yesResponses').textContent = yesResponses;
        document.getElementById('noResponses').textContent = noResponses;
        document.getElementById('entryCount').textContent = entryCount;
        
        console.log('통계 데이터 로드 완료');
        
    } catch (error) {
        console.error('통계 데이터 로드 실패:', error);
        // 오류 시 기본값 설정
        document.getElementById('totalResponses').textContent = '0';
        document.getElementById('yesResponses').textContent = '0';
        document.getElementById('noResponses').textContent = '0';
        document.getElementById('entryCount').textContent = '0';
    }
}

// 참석자 목록 로드
async function loadAttendeeList() {
    try {
        const attendeeList = document.getElementById('attendeeList');
        const noDataDiv = document.getElementById('noAttendeeData');
        
        let attendees = [];
        
        if (isSupabaseConnected && window.supabaseConfig) {
            // Supabase에서 RSVP 데이터 로드
            const { data: rsvpData } = await window.supabaseConfig.supabase
                .from('rsvp_responses')
                .select('*')
                .eq('event_id', window.supabaseConfig.currentEventId)
                .order('created_at', { ascending: false });
                
            // QR 코드 사용 데이터 로드
            const { data: qrData } = await window.supabaseConfig.supabase
                .from('qr_codes')
                .select('*')
                .eq('event_id', window.supabaseConfig.currentEventId);
            
            if (rsvpData) {
                attendees = rsvpData.map(rsvp => {
                    const qrUsed = qrData?.find(qr => {
                        try {
                            const qrObj = JSON.parse(qr.qr_data);
                            return qrObj.name === rsvp.name;
                        } catch {
                            return false;
                        }
                    });
                    
                    return {
                        id: rsvp.id,
                        name: rsvp.name || '익명',
                        response: rsvp.response,
                        created_at: rsvp.created_at,
                        email: rsvp.email,
                        message: rsvp.message,
                        hasEntered: qrUsed?.is_used || false,
                        entryTime: qrUsed?.used_at
                    };
                });
            }
        } else {
            // 로컬 데이터 사용
            const savedResponse = localStorage.getItem('rsvpResponse');
            if (savedResponse) {
                attendees = [{
                    id: 'local-1',
                    name: '로컬 사용자',
                    response: savedResponse,
                    created_at: new Date().toISOString(),
                    hasEntered: false
                }];
            }
        }
        
        if (attendees.length === 0) {
            noDataDiv.style.display = 'block';
            // 헤더만 남기고 나머지 제거
            const items = attendeeList.querySelectorAll('.attendee-item:not(.attendee-header)');
            items.forEach(item => item.remove());
        } else {
            noDataDiv.style.display = 'none';
            displayAttendees(attendees);
        }
        
        console.log('참석자 목록 로드 완료:', attendees.length, '명');
        
    } catch (error) {
        console.error('참석자 목록 로드 실패:', error);
    }
}

// 참석자 목록 표시
function displayAttendees(attendees) {
    const attendeeList = document.getElementById('attendeeList');
    
    // 기존 데이터 제거 (헤더 제외)
    const items = attendeeList.querySelectorAll('.attendee-item:not(.attendee-header)');
    items.forEach(item => item.remove());
    
    attendees.forEach(attendee => {
        const attendeeItem = document.createElement('div');
        attendeeItem.className = 'attendee-item';
        attendeeItem.innerHTML = `
            <div class="attendee-name" data-label="이름">${escapeHtml(attendee.name)}</div>
            <div class="attendee-response" data-label="응답">
                <span class="response-badge ${attendee.response}">
                    ${attendee.response === 'yes' ? '참석' : attendee.response === 'no' ? '불참' : '미정'}
                </span>
            </div>
            <div class="attendee-time" data-label="시간">
                ${new Date(attendee.created_at).toLocaleString('ko-KR')}
            </div>
            <div class="attendee-entry" data-label="입장">
                <span class="entry-status ${attendee.hasEntered ? 'entered' : 'pending'}">
                    ${attendee.hasEntered ? '입장 완료' : '대기'}
                </span>
            </div>
            <div class="attendee-actions" data-label="액션">
                <button class="btn-small" onclick="viewAttendeeDetails('${attendee.id}')">
                    <i class="fas fa-eye"></i>
                    보기
                </button>
                ${attendee.response !== 'no' && !attendee.hasEntered ? 
                    `<button class="btn-small" onclick="manualEntry('${attendee.id}')">
                        <i class="fas fa-door-open"></i>
                        입장
                    </button>` : ''
                }
                <button class="btn-small danger" onclick="removeAttendee('${attendee.id}')">
                    <i class="fas fa-trash"></i>
                    삭제
                </button>
            </div>
        `;
        
        attendeeList.appendChild(attendeeItem);
    });
    
    // 전역 변수에 저장
    window.currentAttendees = attendees;
}

// 방명록 데이터 로드 (관리자용)
async function loadAdminGuestbook() {
    try {
        const adminGuestbookList = document.getElementById('adminGuestbookList');
        let messages = [];
        
        if (isSupabaseConnected && window.supabaseConfig) {
            messages = await window.supabaseConfig.loadGuestbookMessages(50);
        } else {
            messages = guestbookData;
        }
        
        if (messages.length === 0) {
            adminGuestbookList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-comments"></i>
                    <p>등록된 방명록 메시지가 없습니다.</p>
                </div>
            `;
            return;
        }
        
        const messagesHtml = messages.map(msg => {
            const date = msg.created_at ? 
                new Date(msg.created_at).toLocaleString('ko-KR') : 
                (msg.date || new Date().toLocaleString('ko-KR'));
                
            return `
                <div class="admin-message-item">
                    <div class="admin-message-header">
                        <span class="admin-message-name">${escapeHtml(msg.name)}</span>
                        <span class="admin-message-date">${date}</span>
                    </div>
                    <div class="admin-message-content">
                        ${escapeHtml(msg.message)}
                    </div>
                    <div class="admin-message-actions">
                        <button class="btn-small" onclick="approveMessage('${msg.id}')">
                            <i class="fas fa-check"></i>
                            승인
                        </button>
                        <button class="btn-small danger" onclick="deleteMessage('${msg.id}')">
                            <i class="fas fa-trash"></i>
                            삭제
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        adminGuestbookList.innerHTML = messagesHtml;
        
        console.log('관리자 방명록 로드 완료:', messages.length, '개 메시지');
        
    } catch (error) {
        console.error('관리자 방명록 로드 실패:', error);
    }
}

// QR 코드 통계 로드
async function loadQRStats() {
    try {
        let generated = 0;
        let used = 0;
        let usageRate = 0;
        
        if (isSupabaseConnected && window.supabaseConfig) {
            const { data: qrData } = await window.supabaseConfig.supabase
                .from('qr_codes')
                .select('is_used')
                .eq('event_id', window.supabaseConfig.currentEventId);
            
            if (qrData) {
                generated = qrData.length;
                used = qrData.filter(qr => qr.is_used).length;
                usageRate = generated > 0 ? Math.round((used / generated) * 100) : 0;
            }
        } else {
            // 로컬에서는 currentQRCode가 있으면 1개 생성된 것으로 간주
            if (currentQRCode) {
                generated = 1;
                used = 0; // 로컬에선 사용 여부를 알 수 없음
            }
        }
        
        document.getElementById('qrGenerated').textContent = generated;
        document.getElementById('qrUsed').textContent = used;
        document.getElementById('qrUsageRate').textContent = `${usageRate}%`;
        
        console.log('QR 코드 통계 로드 완료');
        
    } catch (error) {
        console.error('QR 코드 통계 로드 실패:', error);
    }
}

// 대시보드 새로고침
async function refreshDashboard() {
    const refreshBtn = document.querySelector('.dashboard-controls .btn-control');
    const originalText = refreshBtn.innerHTML;
    
    refreshBtn.innerHTML = '<div class="loading"></div> 새로고침 중...';
    refreshBtn.disabled = true;
    
    try {
        await loadDashboardData();
        showNotification('대시보드가 새로고침되었습니다.');
    } catch (error) {
        showNotification('대시보드 새로고침에 실패했습니다.', 'error');
    } finally {
        refreshBtn.innerHTML = originalText;
        refreshBtn.disabled = false;
    }
}

// 데이터 내보내기
function exportData() {
    try {
        const attendees = window.currentAttendees || [];
        
        const csvContent = [
            '이름,응답,등록시간,이메일,메시지,입장상태',
            ...attendees.map(attendee => [
                attendee.name,
                attendee.response === 'yes' ? '참석' : attendee.response === 'no' ? '불참' : '미정',
                new Date(attendee.created_at).toLocaleString('ko-KR'),
                attendee.email || '',
                (attendee.message || '').replace(/,/g, ';'),
                attendee.hasEntered ? '입장완료' : '대기'
            ].join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `참석자_목록_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('참석자 데이터가 내보내기되었습니다.');
        
    } catch (error) {
        console.error('데이터 내보내기 실패:', error);
        showNotification('데이터 내보내기에 실패했습니다.', 'error');
    }
}

// 실시간 모드 토글
function toggleRealtimeMode() {
    dashboardRealtimeMode = !dashboardRealtimeMode;
    
    const realtimeBtn = document.querySelector('.dashboard-controls .btn-control:nth-child(3)');
    
    if (dashboardRealtimeMode) {
        realtimeBtn.classList.add('active');
        realtimeBtn.innerHTML = '<i class="fas fa-broadcast-tower"></i> 실시간 모드 (활성)';
        
        // 30초마다 자동 업데이트
        dashboardUpdateInterval = setInterval(() => {
            loadDashboardData();
        }, 30000);
        
        showNotification('실시간 모드가 활성화되었습니다.');
    } else {
        realtimeBtn.classList.remove('active');
        realtimeBtn.innerHTML = '<i class="fas fa-broadcast-tower"></i> 실시간 모드';
        
        if (dashboardUpdateInterval) {
            clearInterval(dashboardUpdateInterval);
            dashboardUpdateInterval = null;
        }
        
        showNotification('실시간 모드가 비활성화되었습니다.');
    }
}

// 참석자 필터링
function filterAttendees() {
    const filter = document.getElementById('statusFilter').value;
    const attendees = window.currentAttendees || [];
    
    let filteredAttendees = attendees;
    
    if (filter !== 'all') {
        filteredAttendees = attendees.filter(attendee => {
            switch (filter) {
                case 'yes':
                    return attendee.response === 'yes';
                case 'no':
                    return attendee.response === 'no';
                case 'entered':
                    return attendee.hasEntered;
                default:
                    return true;
            }
        });
    }
    
    displayAttendees(filteredAttendees);
}

// 참석자 검색
function searchAttendees() {
    const searchTerm = document.getElementById('searchAttendee').value.toLowerCase();
    const attendees = window.currentAttendees || [];
    
    if (!searchTerm) {
        displayAttendees(attendees);
        return;
    }
    
    const filteredAttendees = attendees.filter(attendee => 
        attendee.name.toLowerCase().includes(searchTerm) ||
        (attendee.email && attendee.email.toLowerCase().includes(searchTerm))
    );
    
    displayAttendees(filteredAttendees);
}

// 참석자 세부 정보 보기
function viewAttendeeDetails(attendeeId) {
    const attendee = window.currentAttendees?.find(a => a.id === attendeeId);
    if (!attendee) return;
    
    const details = `
이름: ${attendee.name}
응답: ${attendee.response === 'yes' ? '참석' : attendee.response === 'no' ? '불참' : '미정'}
등록시간: ${new Date(attendee.created_at).toLocaleString('ko-KR')}
이메일: ${attendee.email || '없음'}
메시지: ${attendee.message || '없음'}
입장상태: ${attendee.hasEntered ? '입장완료' : '대기중'}
${attendee.entryTime ? `입장시간: ${new Date(attendee.entryTime).toLocaleString('ko-KR')}` : ''}
    `;
    
    alert(details);
}

// 수동 입장 처리
async function manualEntry(attendeeId) {
    const attendee = window.currentAttendees?.find(a => a.id === attendeeId);
    if (!attendee) return;
    
    if (confirm(`${attendee.name}님의 입장을 승인하시겠습니까?`)) {
        try {
            // Supabase에 입장 기록 업데이트
            if (isSupabaseConnected && window.supabaseConfig) {
                // QR 코드 데이터에서 해당 참석자의 QR 코드 찾기
                const { data: qrData } = await window.supabaseConfig.supabase
                    .from('qr_codes')
                    .select('*')
                    .eq('event_id', window.supabaseConfig.currentEventId)
                    .like('qr_data', `%"name":"${attendee.name}"%`);
                
                if (qrData && qrData.length > 0) {
                    await window.supabaseConfig.supabase
                        .from('qr_codes')
                        .update({ 
                            is_used: true,
                            used_at: new Date().toISOString()
                        })
                        .eq('id', qrData[0].id);
                }
            }
            
            showNotification(`${attendee.name}님의 입장이 승인되었습니다.`);
            
            // 대시보드 새로고침
            await loadDashboardData();
            
        } catch (error) {
            console.error('수동 입장 실패:', error);
            showNotification('입장 처리에 실패했습니다.', 'error');
        }
    }
}

// 참석자 삭제
async function removeAttendee(attendeeId) {
    const attendee = window.currentAttendees?.find(a => a.id === attendeeId);
    if (!attendee) return;
    
    if (confirm(`${attendee.name}님의 데이터를 삭제하시겠습니까?`)) {
        try {
            if (isSupabaseConnected && window.supabaseConfig) {
                // RSVP 데이터 삭제
                await window.supabaseConfig.supabase
                    .from('rsvp_responses')
                    .delete()
                    .eq('id', attendeeId);
                
                // 관련 QR 코드도 삭제
                await window.supabaseConfig.supabase
                    .from('qr_codes')
                    .delete()
                    .like('qr_data', `%"name":"${attendee.name}"%`);
            }
            
            showNotification(`${attendee.name}님의 데이터가 삭제되었습니다.`);
            
            // 대시보드 새로고침
            await loadDashboardData();
            
        } catch (error) {
            console.error('참석자 삭제 실패:', error);
            showNotification('참석자 삭제에 실패했습니다.', 'error');
        }
    }
}

// 방명록 새로고침
function refreshGuestbook() {
    loadAdminGuestbook();
}

// 방명록 내보내기
function exportGuestbook() {
    try {
        const messages = guestbookData || [];
        
        const csvContent = [
            '이름,메시지,등록시간',
            ...messages.map(msg => [
                msg.name,
                (msg.message || '').replace(/,/g, ';'),
                new Date(msg.created_at || msg.date).toLocaleString('ko-KR')
            ].join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `방명록_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('방명록 데이터가 내보내기되었습니다.');
        
    } catch (error) {
        console.error('방명록 내보내기 실패:', error);
        showNotification('방명록 내보내기에 실패했습니다.', 'error');
    }
}

// 방명록 메시지 승인
function approveMessage(messageId) {
    showNotification('메시지가 승인되었습니다.');
    // 실제 구현시 Supabase에서 is_approved = true로 업데이트
}

// 방명록 메시지 삭제
async function deleteMessage(messageId) {
    if (confirm('이 메시지를 삭제하시겠습니까?')) {
        try {
            if (isSupabaseConnected && window.supabaseConfig) {
                await window.supabaseConfig.supabase
                    .from('guestbook_messages')
                    .delete()
                    .eq('id', messageId);
            } else {
                // 로컬 데이터에서 삭제
                const index = guestbookData.findIndex(msg => msg.id == messageId);
                if (index > -1) {
                    guestbookData.splice(index, 1);
                    localStorage.setItem('guestbookData', JSON.stringify(guestbookData));
                }
            }
            
            showNotification('메시지가 삭제되었습니다.');
            loadAdminGuestbook();
            
        } catch (error) {
            console.error('메시지 삭제 실패:', error);
            showNotification('메시지 삭제에 실패했습니다.', 'error');
        }
    }
}

// RSVP 응답에 QR 코드 생성 추가
const originalRsvpResponse = rsvpResponse;
rsvpResponse = async function(response) {
    await originalRsvpResponse(response);
    
    // 참석 응답시 QR 코드 생성
    if (response === 'yes') {
        // 좋 여유를 두고 QR 코드 생성
        setTimeout(async () => {
            try {
                await generateQRCode();
            } catch (error) {
                console.error('QR 코드 자동 생성 실패:', error);
                // 수동 생성 옵션 제공
                showQRCodeGenerateOption();
            }
        }, 2000); // 2초로 여유 시간 늘림
    }
    
    // 관리자 모드인 경우 대시보드 업데이트
    if (isAdminMode) {
        setTimeout(() => loadDashboardData(), 1500);
    }
};

// 수동 QR 코드 생성 옵션 표시
function showQRCodeGenerateOption() {
    const rsvpContent = document.querySelector('.rsvp-content');
    
    // 이미 버튼이 있으면 리턴
    if (rsvpContent.querySelector('.btn-generate-qr')) return;
    
    const generateBtn = document.createElement('button');
    generateBtn.className = 'btn-rsvp btn-generate-qr';
    generateBtn.innerHTML = '<i class="fas fa-qrcode"></i> QR 코드 생성';
    generateBtn.style.marginTop = '15px';
    
    // QR 라이브러리 상태에 따라 버튼 활성화/비활성화
    if (typeof QRCode === 'undefined') {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-qrcode"></i> QR 라이브러리 로드 중...';
        generateBtn.title = 'QR 라이브러리가 로드되는 중입니다';
        
        // 주기적으로 QR 라이브러리 상태 확인
        const checkLibrary = setInterval(() => {
            if (typeof QRCode !== 'undefined') {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="fas fa-qrcode"></i> QR 코드 생성';
                generateBtn.title = '';
                clearInterval(checkLibrary);
            }
        }, 1000);
        
        // 30초 후에도 로드되지 않으면 포기
        setTimeout(() => {
            if (typeof QRCode === 'undefined') {
                generateBtn.innerHTML = '<i class="fas fa-qrcode"></i> QR 기능 사용 불가';
                generateBtn.title = 'QR 라이브러리 로드에 실패했습니다';
                clearInterval(checkLibrary);
            }
        }, 30000);
    }
    
    generateBtn.onclick = () => generateQRCode();
    
    const explanation = document.createElement('p');
    explanation.style.marginTop = '10px';
    explanation.style.fontSize = '0.9rem';
    explanation.style.color = '#666';
    explanation.textContent = '행사 당일 입장용 QR 코드를 생성하세요.';
    
    rsvpContent.appendChild(explanation);
    rsvpContent.appendChild(generateBtn);
}

// 방명록 제출에 대시보드 업데이트 추가
const originalSubmitGuestbook = submitGuestbook;
submitGuestbook = async function() {
    await originalSubmitGuestbook();
    
    // 관리자 모드인 경우 방명록 새로고침
    if (isAdminMode) {
        setTimeout(() => loadAdminGuestbook(), 1000);
    }
};