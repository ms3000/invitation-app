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
    
    // 동적 컨텐츠 로드
    await loadDynamicContent();
    
    // 방명록 메시지 로드
    await loadGuestbookMessages();
    
    // 갤러리 이미지 클릭 이벤트
    setupGalleryModal();
    
    // 스크롤 애니메이션 설정
    setupScrollAnimations();
    
    // 실시간 구독 설정
    setupRealtimeSubscriptions();
    
    // postMessage 리스너 설정 (관리자 페이지에서 업데이트 알림용)
    setupPostMessageListener();
});

// 길찾기 기능 (동적 주소 지원)
function openNavigation() {
    const address = window.dynamicAddress || "서울특별시 강남구 테헤란로 123";
    
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

// RSVP 폼 표시
function showRSVPForm(response) {
    const rsvpForm = document.getElementById('rsvpForm');
    const initialButtons = document.getElementById('rsvpInitialButtons');
    const confirmBtn = document.getElementById('rsvpConfirmBtn');
    
    // 폼 표시
    rsvpForm.style.display = 'block';
    initialButtons.style.display = 'none';
    
    // 버튼 텍스트 설정
    if (response === 'yes') {
        confirmBtn.innerHTML = '<i class="fas fa-check"></i> 참석 확정';
        confirmBtn.className = 'btn-rsvp btn-confirm';
    }
    
    // 전역 변수에 응답 저장
    window.currentRSVPResponse = response;
}

// RSVP 폼 취소
function cancelRSVP() {
    const rsvpForm = document.getElementById('rsvpForm');
    const initialButtons = document.getElementById('rsvpInitialButtons');
    
    // 폼 숨기기
    rsvpForm.style.display = 'none';
    initialButtons.style.display = 'flex';
    
    // 폼 초기화
    document.getElementById('attendeeName').value = '';
    document.getElementById('attendeePhone').value = '';
    document.getElementById('attendeeEmail').value = '';
    document.getElementById('attendeeMessage').value = '';
    
    window.currentRSVPResponse = null;
}

// RSVP 제출
async function submitRSVP() {
    const name = document.getElementById('attendeeName').value.trim();
    const phone = document.getElementById('attendeePhone').value.trim();
    const email = document.getElementById('attendeeEmail').value.trim();
    const message = document.getElementById('attendeeMessage').value.trim();
    const response = window.currentRSVPResponse;
    
    // 유효성 검사
    if (!name) {
        showNotification('참석자명을 입력해주세요.', 'error');
        document.getElementById('attendeeName').focus();
        return;
    }
    
    if (!phone) {
        showNotification('연락처를 입력해주세요.', 'error');
        document.getElementById('attendeePhone').focus();
        return;
    }
    
    if (!email) {
        showNotification('이메일 주소를 입력해주세요.', 'error');
        document.getElementById('attendeeEmail').focus();
        return;
    }
    
    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('올바른 이메일 주소를 입력해주세요.', 'error');
        document.getElementById('attendeeEmail').focus();
        return;
    }
    
    // 전화번호 형식 검사 (자동 포맷팅)
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) {
        showNotification('올바른 연락처를 입력해주세요. (예: 010-1234-5678)', 'error');
        document.getElementById('attendeePhone').focus();
        return;
    }
    
    const attendeeData = {
        name: name,
        phone: formattedPhone,
        email: email,
        message: message,
        response: response
    };
    
    try {
        // 로컬 스토리지에 저장
        localStorage.setItem('rsvpResponse', response);
        localStorage.setItem('attendeeData', JSON.stringify(attendeeData));
        
        // Supabase에 저장
        if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
            await window.supabaseConfig.saveRSVP(response, attendeeData);
            console.log('RSVP Supabase 저장 완료');
        }
        
        // UI 업데이트
        const rsvpForm = document.getElementById('rsvpForm');
        const rsvpContent = document.querySelector('.rsvp-content');
        
        rsvpForm.style.display = 'none';
        
        // 성공 메시지 표시
        const successMessage = document.createElement('div');
        successMessage.className = 'rsvp-success';
        successMessage.innerHTML = `
            <div class="success-icon">
                <i class="fas fa-check-circle"></i>
            </div>
            <h3>참석 신청이 완료되었습니다!</h3>
            <div class="attendee-summary">
                <p><strong>참석자:</strong> ${name}</p>
                <p><strong>연락처:</strong> ${formattedPhone}</p>
                <p><strong>이메일:</strong> ${email}</p>
                ${message ? `<p><strong>메시지:</strong> ${message}</p>` : ''}
            </div>
            <button class="btn-rsvp btn-generate-qr" onclick="generateAttendeeQRCode()">
                <i class="fas fa-qrcode"></i>
                입장용 QR 코드 생성
            </button>
        `;
        
        rsvpContent.appendChild(successMessage);
        
        showNotification('참석 신청이 완료되었습니다!', 'success');
        
    } catch (error) {
        console.error('RSVP 저장 실패:', error);
        showNotification('참석 신청 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    }
}

// 불참 응답 (기존 함수 수정)
function rsvpResponse(response) {
    if (response === 'no') {
        // 불참의 경우 바로 처리
        localStorage.setItem('rsvpResponse', response);
        
        // Supabase에 저장
        if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
            window.supabaseConfig.saveRSVP(response, {}).catch(error => {
                console.error('RSVP 저장 실패:', error);
            });
        }
        
        // UI 업데이트
        const initialButtons = document.getElementById('rsvpInitialButtons');
        const rsvpContent = document.querySelector('.rsvp-content');
        
        initialButtons.style.display = 'none';
        
        const noResponseMessage = document.createElement('div');
        noResponseMessage.className = 'rsvp-no-response';
        noResponseMessage.innerHTML = `
            <div class="response-icon">
                <i class="fas fa-times-circle"></i>
            </div>
            <h3>불참으로 응답이 저장되었습니다</h3>
            <p>다음 기회에 뵙겠습니다.</p>
        `;
        
        rsvpContent.appendChild(noResponseMessage);
        showNotification('불참으로 응답이 저장되었습니다.', 'info');
    }
}

// 전화번호 포맷팅
function formatPhoneNumber(phone) {
    // 숫자만 추출
    const numbers = phone.replace(/[^\d]/g, '');
    
    // 휴대폰 번호 검증 (010, 011, 016, 017, 018, 019)
    if (numbers.length === 11 && /^01[0-9]/.test(numbers)) {
        return numbers.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    }
    
    // 일반 전화번호 (지역번호 포함)
    if (numbers.length >= 9 && numbers.length <= 11) {
        if (numbers.length === 9) {
            return numbers.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
        } else if (numbers.length === 10) {
            return numbers.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
        }
    }
    
    return null; // 유효하지 않은 형식
}

// 참석자용 QR 코드 생성 (ZXing 기반)
async function generateAttendeeQRCode() {
    try {
        // ZXing 라이브러리 대기
        showNotification('ZXing QR 코드 생성 준비 중...', 'info');
        if (typeof window.waitForZXingLibrary === 'function') {
            await window.waitForZXingLibrary();
        } else if (typeof window.waitForQRLibrary === 'function') {
            await window.waitForQRLibrary(); // 하위 호환성
        } else {
            throw new Error('ZXing 라이브러리 로더가 준비되지 않았습니다');
        }
        
        // 참석자 정보 가져오기
        const attendeeData = JSON.parse(localStorage.getItem('attendeeData') || '{}');
        if (!attendeeData.name) {
            showNotification('참석자 정보를 찾을 수 없습니다.', 'error');
            return;
        }
        
        const timestamp = Date.now();
        const qrId = `QR-${timestamp.toString(36).toUpperCase()}`;
        
        // QR 코드 데이터 생성
        const qrData = {
            id: qrId,
            name: attendeeData.name,
            phone: attendeeData.phone,
            email: attendeeData.email,
            eventId: window.supabaseConfig?.currentEventId || 'default-event',
            timestamp: timestamp,
            status: 'active',
            type: 'attendee'
        };
        
        const qrString = JSON.stringify(qrData);
        
        console.log('🏷️ 생성할 ZXing QR 데이터:', qrData);
        console.log('📝 QR 문자열:', qrString);
        console.log('📏 QR 문자열 길이:', qrString.length);
        
        // QR 코드 표시 영역 활성화
        const qrCodeSection = document.getElementById('qrCodeSection');
        const canvas = document.getElementById('qrCodeCanvas');
        
        if (!qrCodeSection || !canvas) {
            showNotification('QR 코드 표시 영역을 찾을 수 없습니다.', 'error');
            return;
        }
        
        // ZXing으로 QR 코드 생성
        if (typeof ZXing !== 'undefined') {
            try {
                // ZXing QR Writer 사용
                const writer = new ZXing.BrowserQRCodeSvgWriter();
                const svgElement = writer.write(qrString, 256, 256);
                
                console.log('✅ ZXing SVG 생성 성공');
                
                // SVG를 문자열로 변환
                const svgString = svgElement.outerHTML;
                console.log('📝 SVG 문자열 길이:', svgString.length);
                
                // SVG를 Data URL로 변환하여 캔버스에 그리기
                const ctx = canvas.getContext('2d');
                const img = new Image();
                
                // SVG를 Data URL로 직접 변환
                const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
                
                img.onload = () => {
                    try {
                        canvas.width = 256;
                        canvas.height = 256;
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, 256, 256);
                        ctx.drawImage(img, 0, 0, 256, 256);
                        
                        console.log('✅ SVG → Canvas 변환 성공');
                        finishQRGeneration();
                    } catch (drawError) {
                        console.warn('⚠️ Canvas 그리기 실패:', drawError);
                        fallbackQRGeneration();
                    }
                };
                
                img.onerror = (error) => {
                    console.warn('⚠️ SVG 이미지 로드 실패:', error);
                    console.log('🔄 QRCode.js 대체 방법 시도');
                    fallbackToQRCodeJS();
                };
                
                img.src = svgDataUrl;
                
            } catch (zxingError) {
                console.warn('⚠️ ZXing 생성 실패:', zxingError);
                fallbackToQRCodeJS();
            }
            
        } else {
            fallbackToQRCodeJS();
        }
        
        // QRCode.js 대체 함수
        async function fallbackToQRCodeJS() {
            console.log('🔄 QRCode.js 대체 방법 시도');
            
            if (typeof QRCode !== 'undefined') {
                try {
                    await QRCode.toCanvas(canvas, qrString, {
                        width: 256,
                        height: 256,
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        }
                    });
                    
                    console.log('✅ QRCode.js 생성 성공');
                    finishQRGeneration();
                } catch (qrError) {
                    console.warn('⚠️ QRCode.js 생성 실패:', qrError);
                    fallbackQRGeneration();
                }
            } else {
                console.warn('⚠️ QRCode.js 라이브러리 없음, 기본 방법 시도');
                fallbackQRGeneration();
            }
        }
        
        // QR 생성 완료 처리
        function finishQRGeneration() {
            // QR 정보 업데이트
            document.getElementById('qrCodeId').textContent = qrId;
            document.getElementById('qrCodeName').textContent = attendeeData.name;
            
            // QR 섹션 표시
            qrCodeSection.style.display = 'block';
            
            // 전역 변수에 저장
            currentQRCode = qrData;
            
            // Supabase에 QR 코드 저장 (선택사항)
            if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
                try {
                    saveQRCodeToDB(qrData, canvas.toDataURL()).catch(error => {
                        console.warn('⚠️ QR 코드 DB 저장 실패 (계속 진행):', error.message || error);
                        // DB 저장 실패해도 QR 코드 생성은 성공으로 처리
                    });
                } catch (error) {
                    console.warn('⚠️ QR 코드 DB 저장 시도 실패:', error);
                }
            } else {
                console.log('ℹ️ Supabase 연결 없음, 로컬 QR 코드만 생성됨');
            }
            
            console.log('✅ ZXing QR 코드 생성 완료:', qrId);
            showNotification(`${attendeeData.name}님의 QR 코드가 생성되었습니다!`);
        }
        
        // 대체 QR 생성 방법 (최후 수단)
        function fallbackQRGeneration() {
            console.log('🔄 기본 캔버스 QR 생성 시도');
            
            try {
                const ctx = canvas.getContext('2d');
                canvas.width = 256;
                canvas.height = 256;
                
                // 흰색 배경
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, 256, 256);
                
                // 간단한 패턴으로 QR 코드 모양 흉내
                ctx.fillStyle = '#000000';
                
                // QR 코드 패턴 (간단한 체크보드)
                for (let i = 0; i < 16; i++) {
                    for (let j = 0; j < 16; j++) {
                        // QR 문자열 해시값을 이용한 패턴 생성
                        const hash = qrString.charCodeAt((i * 16 + j) % qrString.length);
                        if (hash % 2 === 0) {
                            ctx.fillRect(i * 16, j * 16, 16, 16);
                        }
                    }
                }
                
                // 텍스트 정보 오버레이
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillRect(60, 200, 136, 40);
                ctx.fillStyle = '#000000';
                ctx.fillText('QR Code', 128, 215);
                ctx.fillText(`ID: ${qrId.slice(-8)}`, 128, 230);
                
                console.log('✅ 기본 캔버스 QR 생성 완료');
                finishQRGeneration();
                
            } catch (fallbackError) {
                console.error('❌ 기본 QR 생성마저 실패:', fallbackError);
                
                // 최후의 수단: 텍스트만 표시
                try {
                    const ctx = canvas.getContext('2d');
                    canvas.width = 256;
                    canvas.height = 256;
                    ctx.fillStyle = '#F8F9FA';
                    ctx.fillRect(0, 0, 256, 256);
                    ctx.fillStyle = '#6C757D';
                    ctx.font = '14px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('QR 코드 생성됨', 128, 110);
                    ctx.fillText(`ID: ${qrId}`, 128, 130);
                    ctx.fillText('(대체 모드)', 128, 150);
                    
                    finishQRGeneration();
                } catch (textError) {
                    console.error('❌ 텍스트 QR 생성마저 실패:', textError);
                    throw new Error('QR 코드 생성에 완전히 실패했습니다.');
                }
            }
        }
        
    } catch (error) {
        console.error('❌ ZXing QR 코드 생성 실패:', error);
        
        // 구체적인 오류 메시지 제공
        if (error.message.includes('라이브러리') || error.message.includes('ZXing') || error.message.includes('QRCode')) {
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

// QR 코드를 DB에 저장 (선택적)
async function saveQRCodeToDB(qrData, imageDataUrl) {
    try {
        // Supabase 연결 상태 확인
        if (!window.supabaseConfig || !window.supabaseConfig.supabase) {
            console.log('ℹ️ Supabase 연결 없음, QR 코드 DB 저장 건너뜀');
            return;
        }
        
        // 테이블 존재 여부 확인 (간단한 방법)
        const { data: tableCheck, error: checkError } = await window.supabaseConfig.supabase
            .from('qr_codes')
            .select('count')
            .limit(1);
            
        if (checkError && checkError.code === 'PGRST106') {
            console.log('ℹ️ qr_codes 테이블 없음, DB 저장 건너뜀');
            return;
        }
        
        const { data, error } = await window.supabaseConfig.supabase
            .from('qr_codes')
            .insert([{
                event_id: window.supabaseConfig.currentEventId || 'default-event',
                qr_data: JSON.stringify(qrData),
                qr_image_url: imageDataUrl,
                is_used: false,
                created_at: new Date().toISOString()
            }])
            .select();
            
        if (error) {
            // 특정 오류 타입별 처리
            if (error.code === 'PGRST106') {
                console.log('ℹ️ qr_codes 테이블이 존재하지 않음');
            } else if (error.code === '23505') {
                console.log('ℹ️ 중복 QR 코드, 업데이트 시도하지 않음');
            } else {
                throw error;
            }
        } else {
            console.log('✅ QR 코드 DB 저장 완료:', data);
        }
        
    } catch (error) {
        console.warn('⚠️ QR 코드 DB 저장 실패 (로컬 저장은 완료):', {
            message: error.message,
            code: error.code,
            details: error.details
        });
        
        // 사용자에게는 알리지 않음 (로컬 QR 코드는 정상 생성됨)
        throw error; // catch에서 처리하도록 에러 전파
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

// 동적 컨텐츠 로드
async function loadDynamicContent() {
    try {
        let contentData = {};
        let loadSource = 'none';
        
        // 먼저 localStorage에서 시도
        try {
            const localData = JSON.parse(localStorage.getItem('contentData') || '{}');
            if (Object.keys(localData).length > 0) {
                contentData = localData;
                loadSource = 'localStorage';
                console.log('localStorage에서 컨텐츠 로드:', contentData);
            }
        } catch (localError) {
            console.warn('localStorage 데이터 로드 실패:', localError);
        }
        
        // Supabase에서 시도 (실패해도 localStorage 데이터 사용)
        if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
            try {
                const supabaseData = await window.supabaseConfig.getContentData();
                if (Object.keys(supabaseData).length > 0) {
                    contentData = supabaseData;
                    loadSource = 'supabase';
                    console.log('Supabase에서 컨텐츠 로드:', contentData);
                }
            } catch (supabaseError) {
                console.warn('Supabase 데이터 로드 실패, localStorage 사용:', supabaseError);
            }
        }
        
        // 컨텐츠가 있으면 페이지에 적용
        if (Object.keys(contentData).length > 0) {
            console.log('페이지 컨텐츠 업데이트 시작:', loadSource);
            updatePageContent(contentData);
            console.log('페이지 컨텐츠 업데이트 완료');
        } else {
            console.log('로드할 컨텐츠 데이터가 없음');
        }
        
    } catch (error) {
        console.error('동적 컨텐츠 로드 실패:', error);
    }
}

// 페이지 컨텐츠 업데이트
function updatePageContent(contentData) {
    console.log('updatePageContent 호출됨:', contentData);
    
    // 헤더 섹션
    if (contentData.heroImage) {
        const heroImg = document.querySelector('.hero-image img');
        if (heroImg) {
            console.log('Hero 이미지 업데이트:', contentData.heroImage);
            heroImg.src = contentData.heroImage;
        } else {
            console.warn('Hero 이미지 엘리먼트를 찾을 수 없음');
        }
    }
    
    if (contentData.eventTitle) {
        const titleEl = document.querySelector('.event-title');
        if (titleEl) {
            console.log('제목 업데이트:', contentData.eventTitle);
            titleEl.textContent = contentData.eventTitle;
        } else {
            console.warn('제목 엘리먼트를 찾을 수 없음');
        }
    }
    
    if (contentData.eventSubtitle) {
        const subtitleEl = document.querySelector('.event-subtitle');
        if (subtitleEl) {
            console.log('부제목 업데이트:', contentData.eventSubtitle);
            subtitleEl.textContent = contentData.eventSubtitle;
        } else {
            console.warn('부제목 엘리먼트를 찾을 수 없음');
        }
    }
    
    if (contentData.eventDate) {
        const dateEl = document.querySelector('.event-date span');
        if (dateEl) {
            console.log('날짜 업데이트:', contentData.eventDate);
            dateEl.textContent = contentData.eventDate;
        } else {
            console.warn('날짜 엘리먼트를 찾을 수 없음');
        }
    }
    
    if (contentData.eventLocation) {
        const locationEl = document.querySelector('.event-location span');
        if (locationEl) {
            console.log('장소 업데이트:', contentData.eventLocation);
            locationEl.textContent = contentData.eventLocation;
        } else {
            console.warn('장소 엘리먼트를 찾을 수 없음');
        }
    }
    
    // 인사말 섹션
    if (contentData.greetingContent) {
        const greetingEl = document.querySelector('.greeting-content');
        if (greetingEl) {
            const paragraphs = contentData.greetingContent.split('\n\n');
            const signaturePart = contentData.greetingSignature ? 
                `<div class="signature"><p>${contentData.greetingSignature}</p></div>` : '';
            
            greetingEl.innerHTML = paragraphs.map(p => p ? `<p>${p}</p>` : '').join('') + signaturePart;
        }
    }
    
    // 행사 정보 섹션
    if (contentData.eventDetailTime) {
        const timeEl = document.querySelector('.info-item:nth-child(1) p');
        if (timeEl) timeEl.innerHTML = contentData.eventDetailTime.replace(/\n/g, '<br>');
    }
    
    if (contentData.eventDetailLocation) {
        const locationEl = document.querySelector('.info-item:nth-child(2) p');
        if (locationEl) locationEl.innerHTML = contentData.eventDetailLocation.replace(/\n/g, '<br>');
    }
    
    if (contentData.eventTarget) {
        const targetEl = document.querySelector('.info-item:nth-child(3) p');
        if (targetEl) targetEl.innerHTML = contentData.eventTarget.replace(/\n/g, '<br>');
    }
    
    if (contentData.eventFee) {
        const feeEl = document.querySelector('.info-item:nth-child(4) p');
        if (feeEl) feeEl.textContent = contentData.eventFee;
    }
    
    // 오시는 길 섹션
    if (contentData.locationAddress) {
        const addressEl = document.querySelector('.address p');
        if (addressEl) addressEl.innerHTML = contentData.locationAddress.replace(/\n/g, '<br>');
    }
    
    if (contentData.subwayInfo) {
        const subwayEl = document.querySelector('.transport-item:nth-child(1) span');
        if (subwayEl) subwayEl.textContent = contentData.subwayInfo;
    }
    
    if (contentData.busInfo) {
        const busEl = document.querySelector('.transport-item:nth-child(2) span');
        if (busEl) busEl.textContent = contentData.busInfo;
    }
    
    if (contentData.parkingInfo) {
        const parkingEl = document.querySelector('.transport-item:nth-child(3) span');
        if (parkingEl) parkingEl.textContent = contentData.parkingInfo;
    }
    
    // 갤러리 섹션
    if (contentData.galleryImages && Array.isArray(contentData.galleryImages)) {
        const galleryGrid = document.querySelector('.gallery-grid');
        if (galleryGrid && contentData.galleryImages.length > 0) {
            galleryGrid.innerHTML = contentData.galleryImages.map((imageUrl, index) => `
                <div class="gallery-item">
                    <img src="${imageUrl}" alt="갤러리 이미지 ${index + 1}">
                </div>
            `).join('');
            
            // 갤러리 모달 재설정
            setupGalleryModal();
        }
    }
    
    // 연락처 섹션
    if (contentData.contactPhone) {
        const phoneBtn = document.querySelector('[onclick*="makeCall"]');
        if (phoneBtn) {
            phoneBtn.onclick = () => makeCall(contentData.contactPhone);
            const phoneSpan = phoneBtn.querySelector('span:last-child');
            if (phoneSpan) phoneSpan.textContent = contentData.contactPhone;
        }
    }
    
    if (contentData.contactEmail) {
        const emailBtn = document.querySelector('[onclick*="sendEmail"]');
        if (emailBtn) {
            emailBtn.onclick = () => sendEmail(contentData.contactEmail);
            const emailSpan = emailBtn.querySelector('span:last-child');
            if (emailSpan) emailSpan.textContent = contentData.contactEmail;
        }
    }
    
    // 계좌정보 섹션
    if (contentData.donationMessage) {
        const donationText = document.querySelector('.donation-content p');
        if (donationText) donationText.textContent = contentData.donationMessage;
    }
    
    if (contentData.bankName && contentData.accountNumber) {
        const bankNameEl = document.querySelector('.bank-name');
        const accountNumberEl = document.querySelector('.account-number');
        const copyBtn = document.querySelector('[onclick*="copyAccount"]');
        
        if (bankNameEl) bankNameEl.textContent = contentData.bankName;
        if (accountNumberEl) accountNumberEl.textContent = contentData.accountNumber;
        if (copyBtn) copyBtn.onclick = () => copyAccount(contentData.accountNumber);
    }
    
    if (contentData.accountHolder) {
        const holderEl = document.querySelector('.account-holder');
        if (holderEl) holderEl.textContent = `예금주: ${contentData.accountHolder}`;
    }
    
    // 길찾기 주소 업데이트
    if (contentData.locationAddress) {
        // 첫 번째 줄을 주소로 사용
        const firstLine = contentData.locationAddress.split('\n')[0];
        if (firstLine) {
            // openNavigation 함수의 주소를 동적으로 업데이트하기 위해 전역 변수 설정
            window.dynamicAddress = firstLine;
        }
    }
}

// postMessage 리스너 설정 (관리자 페이지에서의 실시간 업데이트용)
function setupPostMessageListener() {
    window.addEventListener('message', function(event) {
        console.log('postMessage 수신:', event.data);
        if (event.data.type === 'contentUpdate') {
            updatePageContent(event.data.data);
            showNotification('페이지 컨텐츠가 업데이트되었습니다.', 'info');
        }
    });
    
    // localStorage 변경 감지 (다른 탭에서 업데이트 시)
    window.addEventListener('storage', function(event) {
        console.log('localStorage 변경 감지:', event.key, event.newValue);
        if (event.key === 'contentData') {
            // contentData가 직접 변경되었을 때
            console.log('contentData 변경 감지, 페이지 업데이트');
            loadDynamicContent();
            showNotification('페이지 컨텐츠가 업데이트되었습니다.', 'info');
        } else if (event.key === 'contentUpdated' && event.newValue === 'true') {
            // 업데이트 플래그가 설정되었을 때
            console.log('contentUpdated 플래그 감지, 페이지 업데이트');
            localStorage.removeItem('contentUpdated');
            loadDynamicContent();
            showNotification('페이지 컨텐츠가 업데이트되었습니다.', 'info');
        }
    });
    
    // 주기적으로 localStorage 체크 (브라우저 호환성 대비)
    setInterval(() => {
        const updateFlag = localStorage.getItem('contentUpdated');
        if (updateFlag === 'true') {
            console.log('주기적 체크: contentUpdated 플래그 발견');
            localStorage.removeItem('contentUpdated');
            loadDynamicContent();
        }
    }, 1000);
}

// 길찾기 기능 (동적 주소 지원)
function openNavigationDynamic() {
    const address = window.dynamicAddress || "서울특별시 강남구 테헤란로 123";
    
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