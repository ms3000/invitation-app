// 사용자 페이지 전용 JavaScript
// =====================================

// 전역 변수
let guestbookData = JSON.parse(localStorage.getItem('guestbookData')) || [];
let isSupabaseConnected = false;
let guestbookSubscription = null;
let rsvpSubscription = null;
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
    
    // 선택된 버튼 강조
    const selectedBtn = document.querySelector(`[onclick="rsvpResponse('${response}')"]`);
    if (selectedBtn) {
        selectedBtn.style.opacity = '1';
        selectedBtn.style.background = response === 'yes' ? 
            'linear-gradient(135deg, #27ae60, #2ecc71)' : 
            'linear-gradient(135deg, #e74c3c, #c0392b)';
    }
    
    // Supabase에 저장
    if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
        window.supabaseConfig.saveRSVP(response).catch(error => {
            console.error('RSVP 저장 실패:', error);
        });
    }
    
    // QR 코드 생성 옵션 표시 (참석 선택 시)
    if (response === 'yes') {
        setTimeout(() => {
            showQRCodeGenerateOption();
        }, 1000);
    }
    
    showNotification(`${responseText}으로 응답이 저장되었습니다!`);
}

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
        
        // QR 코드 표시 영역 활성화
        const qrCodeSection = document.getElementById('qrCodeSection');
        const canvas = document.getElementById('qrCodeCanvas');
        
        if (!qrCodeSection || !canvas) {
            showNotification('QR 코드 표시 영역을 찾을 수 없습니다.', 'error');
            return;
        }
        
        // 캔버스에 QR 코드 생성
        await QRCode.toCanvas(canvas, qrString, {
            width: 256,
            height: 256,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        // QR 정보 업데이트
        document.getElementById('qrCodeId').textContent = qrId;
        document.getElementById('qrCodeName').textContent = guestName.trim();
        
        // QR 섹션 표시
        qrCodeSection.style.display = 'block';
        
        // 전역 변수에 저장
        currentQRCode = qrData;
        
        // Supabase에 QR 코드 저장
        if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
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
        showNotification('다운로드할 QR 코드가 없습니다.', 'error');
        return;
    }
    
    try {
        const link = document.createElement('a');
        link.href = canvas.toDataURL();
        link.download = `QR-Code-${currentQRCode.id}.png`;
        link.click();
        
        showNotification(`${currentQRCode.name}님의 QR 코드가 다운로드되었습니다.`);
    } catch (error) {
        console.error('QR 코드 다운로드 실패:', error);
        showNotification('QR 코드 다운로드에 실패했습니다.', 'error');
    }
}

// QR 코드 공유
function shareQRCode() {
    const canvas = document.getElementById('qrCodeCanvas');
    
    if (!canvas || !currentQRCode) {
        showNotification('공유할 QR 코드가 없습니다.', 'error');
        return;
    }
    
    if (navigator.share && canvas.toBlob) {
        canvas.toBlob(async (blob) => {
            try {
                const file = new File([blob], `QR-Code-${currentQRCode.id}.png`, { type: 'image/png' });
                
                await navigator.share({
                    title: '컨퍼런스 QR 코드',
                    text: `${currentQRCode.name}님의 입장용 QR 코드입니다.`,
                    files: [file]
                });
                
                showNotification('QR 코드가 공유되었습니다.');
            } catch (error) {
                console.error('QR 코드 공유 실패:', error);
                fallbackShare();
            }
        });
    } else {
        fallbackShare();
    }
    
    function fallbackShare() {
        const shareText = `컨퍼런스 입장용 QR 코드\n참석자: ${currentQRCode.name}\nQR ID: ${currentQRCode.id}`;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText).then(() => {
                showNotification('QR 코드 정보가 클립보드에 복사되었습니다.');
            });
        } else {
            showNotification('이 브라우저에서는 공유 기능을 지원하지 않습니다.');
        }
    }
}

// 방명록 메시지 제출
function submitGuestbook() {
    const nameInput = document.getElementById('guestName');
    const messageInput = document.getElementById('guestMessage');
    
    const name = nameInput.value.trim();
    const message = messageInput.value.trim();
    
    if (!name || !message) {
        showNotification('이름과 메시지를 모두 입력해주세요.', 'error');
        return;
    }
    
    if (name.length > 20) {
        showNotification('이름은 20자 이내로 입력해주세요.', 'error');
        return;
    }
    
    if (message.length > 200) {
        showNotification('메시지는 200자 이내로 입력해주세요.', 'error');
        return;
    }
    
    const guestbookMessage = {
        name: name,
        message: message,
        timestamp: new Date().toISOString()
    };
    
    // 로컬 스토리지에 저장
    guestbookData.push(guestbookMessage);
    localStorage.setItem('guestbookData', JSON.stringify(guestbookData));
    
    // Supabase에 저장
    if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
        window.supabaseConfig.saveGuestbookMessage(name, message).then(() => {
            console.log('방명록 Supabase 저장 완료');
        }).catch(error => {
            console.error('방명록 Supabase 저장 실패:', error);
        });
    }
    
    // 입력 필드 초기화
    nameInput.value = '';
    messageInput.value = '';
    
    // 방명록 새로고침
    loadGuestbookMessages();
    
    showNotification('방명록에 메시지가 등록되었습니다!');
}

// 방명록 메시지 로드
async function loadGuestbookMessages() {
    const messagesContainer = document.getElementById('guestbookMessages');
    if (!messagesContainer) return;
    
    try {
        let messages = [];
        
        if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
            // Supabase에서 메시지 로드
            messages = await window.supabaseConfig.loadGuestbookMessages();
        } else {
            // 로컬 스토리지에서 메시지 로드
            messages = guestbookData.slice().reverse(); // 최신순 정렬
        }
        
        if (messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="message-item">
                    <div class="message-content" style="text-align: center; color: #666;">
                        아직 방명록 메시지가 없습니다. 첫 번째 메시지를 남겨보세요!
                    </div>
                </div>
            `;
            return;
        }
        
        const messagesHtml = messages.map(msg => {
            const date = new Date(msg.created_at || msg.timestamp).toLocaleDateString('ko-KR');
            return `
                <div class="message-item">
                    <div class="message-header">
                        <span class="message-name">${escapeHtml(msg.name)}</span>
                        <span class="message-date">${date}</span>
                    </div>
                    <div class="message-content">
                        ${escapeHtml(msg.message)}
                    </div>
                </div>
            `;
        }).join('');
        
        messagesContainer.innerHTML = messagesHtml;
        
    } catch (error) {
        console.error('방명록 로드 실패:', error);
        messagesContainer.innerHTML = `
            <div class="message-item">
                <div class="message-content" style="text-align: center; color: #e74c3c;">
                    방명록을 불러오는데 실패했습니다.
                </div>
            </div>
        `;
    }
}

// Supabase 초기화
async function initializeSupabase() {
    if (typeof window.supabaseConfig !== 'undefined') {
        try {
            const success = await window.supabaseConfig.initialize();
            if (success) {
                isSupabaseConnected = true;
                console.log('✅ Supabase 연결 성공');
            } else {
                console.log('⚠️ Supabase 연결 실패 - 로컬 모드로 동작');
            }
        } catch (error) {
            console.error('Supabase 초기화 오류:', error);
        }
    }
}

// 실시간 구독 설정
function setupRealtimeSubscriptions() {
    if (!isSupabaseConnected || typeof window.supabaseConfig === 'undefined') {
        return;
    }
    
    try {
        // 방명록 실시간 구독
        guestbookSubscription = window.supabaseConfig.subscribeToGuestbook((newMessage) => {
            loadGuestbookMessages();
            showNotification(`${newMessage.name}님이 방명록을 남겼습니다.`, 'info');
        });
        
        console.log('✅ 실시간 구독 설정 완료');
    } catch (error) {
        console.error('실시간 구독 설정 실패:', error);
    }
}

// 갤러리 모달 설정
function setupGalleryModal() {
    const galleryItems = document.querySelectorAll('.gallery-item img');
    
    galleryItems.forEach(img => {
        img.addEventListener('click', function() {
            const modal = document.createElement('div');
            modal.className = 'gallery-modal';
            modal.innerHTML = `
                <div class="modal-backdrop" onclick="this.parentElement.remove()">
                    <div class="modal-content" onclick="event.stopPropagation()">
                        <img src="${this.src}" alt="${this.alt}">
                        <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // 애니메이션
            setTimeout(() => modal.classList.add('show'), 10);
        });
    });
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
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // 애니메이션 대상 요소들 관찰
    const animateElements = document.querySelectorAll('section, .card, .message-item');
    animateElements.forEach(el => {
        observer.observe(el);
    });
}

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

// 유틸리티 함수들
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
    } else {
        // 폴백 방법
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
}

function copyAccount(accountNumber) {
    copyToClipboard(accountNumber);
    showNotification('계좌번호가 복사되었습니다!');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 알림 표시 함수
function showNotification(message, type = 'success') {
    // 기존 알림 제거
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <span class="notification-message">${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // 애니메이션
    setTimeout(() => notification.classList.add('show'), 100);
    
    // 자동 제거
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
}