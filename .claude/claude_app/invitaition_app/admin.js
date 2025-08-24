// 관리자 페이지 전용 JavaScript
// =====================================

// 전역 변수
let isAdminLoggedIn = false;
let currentAdminUser = null;
let dashboardRealtimeMode = false;
let dashboardUpdateInterval = null;
let qrScannerStream = null;
let qrScannerInterval = null;

// 관리자 인증 정보 (실제 프로덕션에서는 서버에서 관리)
const ADMIN_CREDENTIALS = {
    'admin': 'admin123',
    'manager': 'manager456',
    'event_admin': 'event789'
};

// DOM 로드 완료 후 실행
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 관리자 페이지 초기화 시작...');
    
    // 로그인 상태 확인
    checkLoginStatus();
    
    // 라이브러리 로드
    await loadLibraries();
    
    // 이벤트 리스너 설정
    setupEventListeners();
    
    console.log('✅ 관리자 페이지 초기화 완료');
});

// 라이브러리 로드
async function loadLibraries() {
    try {
        // Supabase 초기화
        if (typeof window.supabaseConfig !== 'undefined') {
            await window.supabaseConfig.initialize();
            console.log('✅ Supabase 연결 완료');
        }
        
        // QR 라이브러리 로드
        await loadQRLibrary();
        await loadJsQRLibrary();
        console.log('✅ QR 라이브러리 준비 완료');
        
    } catch (error) {
        console.error('라이브러리 로드 실패:', error);
    }
}

// 로그인 상태 확인
function checkLoginStatus() {
    const savedLogin = localStorage.getItem('adminLogin');
    const loadingScreen = document.getElementById('loadingScreen');
    const loginScreen = document.getElementById('loginScreen');
    const adminDashboard = document.getElementById('adminDashboard');
    
    setTimeout(() => {
        loadingScreen.style.display = 'none';
        
        if (savedLogin) {
            try {
                const loginData = JSON.parse(savedLogin);
                const loginTime = new Date(loginData.timestamp);
                const now = new Date();
                const hoursDiff = (now - loginTime) / (1000 * 60 * 60);
                
                // 24시간 이내의 로그인만 유효
                if (hoursDiff < 24 && ADMIN_CREDENTIALS[loginData.adminId]) {
                    isAdminLoggedIn = true;
                    currentAdminUser = loginData.adminId;
                    showAdminDashboard();
                    return;
                }
            } catch (error) {
                console.error('저장된 로그인 정보 오류:', error);
            }
        }
        
        loginScreen.style.display = 'flex';
    }, 1500);
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 로그인 폼
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // 키보드 단축키
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'r' && isAdminLoggedIn) {
            e.preventDefault();
            refreshAllStats();
        }
    });
}

// 로그인 처리
async function handleLogin(e) {
    e.preventDefault();
    
    const adminId = document.getElementById('adminId').value.trim();
    const password = document.getElementById('adminPassword').value;
    
    if (!adminId || !password) {
        showNotification('ID와 비밀번호를 입력해주세요.', 'error');
        return;
    }
    
    // 인증 확인
    if (ADMIN_CREDENTIALS[adminId] === password) {
        // 로그인 성공
        isAdminLoggedIn = true;
        currentAdminUser = adminId;
        
        // 로그인 정보 저장 (24시간 유효)
        const loginData = {
            adminId: adminId,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('adminLogin', JSON.stringify(loginData));
        
        showNotification('로그인 성공!', 'success');
        
        setTimeout(() => {
            showAdminDashboard();
        }, 500);
        
    } else {
        showNotification('잘못된 관리자 정보입니다.', 'error');
    }
}

// 관리자 대시보드 표시
function showAdminDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const adminDashboard = document.getElementById('adminDashboard');
    const adminName = document.getElementById('adminName');
    
    loginScreen.style.display = 'none';
    adminDashboard.style.display = 'block';
    
    if (adminName && currentAdminUser) {
        adminName.textContent = currentAdminUser;
    }
    
    // 초기 데이터 로드
    setTimeout(() => {
        loadDashboardData();
    }, 500);
}

// 로그아웃
function logout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        isAdminLoggedIn = false;
        currentAdminUser = null;
        localStorage.removeItem('adminLogin');
        
        // 실시간 모드 중지
        if (dashboardRealtimeMode) {
            toggleRealtimeMode();
        }
        
        // QR 스캐너 중지
        if (qrScannerStream) {
            stopQRScanner();
        }
        
        showNotification('로그아웃되었습니다.', 'info');
        
        setTimeout(() => {
            location.reload();
        }, 1000);
    }
}

// 섹션 표시/숨김
function showSection(sectionName) {
    // 모든 섹션 숨김
    const sections = document.querySelectorAll('.admin-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    // 모든 네비게이션 버튼 비활성화
    const navButtons = document.querySelectorAll('.quick-nav-btn');
    navButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 선택된 섹션 표시
    const targetSection = document.getElementById(sectionName + 'Section');
    const targetButton = document.querySelector(`[onclick="showSection('${sectionName}')"]`);
    
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    if (targetButton) {
        targetButton.classList.add('active');
    }
    
    // 섹션별 데이터 로드
    loadSectionData(sectionName);
}

// 섹션별 데이터 로드
function loadSectionData(sectionName) {
    switch (sectionName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'attendees':
            loadAttendeesData();
            break;
        case 'guestbook':
            loadAdminGuestbookData();
            break;
        case 'qr':
            // QR 섹션은 별도 로드 없음
            break;
        case 'settings':
            loadSettingsData();
            break;
    }
}

// 대시보드 데이터 로드
async function loadDashboardData() {
    try {
        if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
            // Supabase에서 실제 데이터 로드
            const stats = await window.supabaseConfig.getRSVPStatistics();
            const guestbookMessages = await window.supabaseConfig.loadGuestbookMessages(1);
            
            if (stats) {
                document.getElementById('totalRsvp').textContent = stats.total_responses || 0;
                document.getElementById('yesRsvp').textContent = stats.yes_responses || 0;
                document.getElementById('noRsvp').textContent = stats.no_responses || 0;
                document.getElementById('maybeRsvp').textContent = stats.maybe_responses || 0;
                document.getElementById('totalGuestbook').textContent = stats.total_guestbook_messages || 0;
                document.getElementById('totalImages').textContent = stats.total_gallery_images || 0;
            }
            
            if (guestbookMessages && guestbookMessages.length > 0) {
                const recent = guestbookMessages[0];
                document.getElementById('recentGuestbook').textContent = recent.name || '-';
            }
            
        } else {
            // 로컬 데이터 사용
            loadLocalStats();
        }
        
        // QR 통계는 별도 로드
        loadQRStats();
        
    } catch (error) {
        console.error('대시보드 데이터 로드 실패:', error);
        loadLocalStats();
    }
}

// 로컬 통계 로드 (Supabase 연결 실패 시)
function loadLocalStats() {
    const rsvpResponse = localStorage.getItem('rsvpResponse');
    const guestbookData = JSON.parse(localStorage.getItem('guestbookData') || '[]');
    
    // RSVP 통계
    if (rsvpResponse === 'yes') {
        document.getElementById('totalRsvp').textContent = '1';
        document.getElementById('yesRsvp').textContent = '1';
    } else if (rsvpResponse === 'no') {
        document.getElementById('totalRsvp').textContent = '1';
        document.getElementById('noRsvp').textContent = '1';
    } else {
        document.getElementById('totalRsvp').textContent = '0';
    }
    
    // 방명록 통계
    document.getElementById('totalGuestbook').textContent = guestbookData.length;
    if (guestbookData.length > 0) {
        const recent = guestbookData[guestbookData.length - 1];
        document.getElementById('recentGuestbook').textContent = recent.name || '-';
    }
}

// QR 통계 로드
function loadQRStats() {
    // 로컬에서는 간단한 QR 통계
    const hasQRCode = localStorage.getItem('currentQRCode') || (typeof currentQRCode !== 'undefined' && currentQRCode);
    
    if (hasQRCode) {
        document.getElementById('qrGenerated').textContent = '1';
        document.getElementById('qrUsed').textContent = '0';
        document.getElementById('qrUsageRate').textContent = '0%';
    } else {
        document.getElementById('qrGenerated').textContent = '0';
        document.getElementById('qrUsed').textContent = '0';
        document.getElementById('qrUsageRate').textContent = '0%';
    }
}

// 참석자 데이터 로드
async function loadAttendeesData() {
    const attendeesList = document.getElementById('attendeesList');
    attendeesList.innerHTML = '<div class="loading">참석자 데이터 로드 중...</div>';
    
    try {
        if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
            // 실제 DB에서 참석자 목록 로드 로직 구현
            attendeesList.innerHTML = '<div class="no-data">참석자 관리 기능은 Supabase 연결 후 사용 가능합니다.</div>';
        } else {
            // 로컬 데이터로 시뮬레이션
            const rsvpResponse = localStorage.getItem('rsvpResponse');
            if (rsvpResponse) {
                attendeesList.innerHTML = `
                    <div class="attendee-item">
                        <div class="attendee-info">
                            <span class="attendee-name">로컬 사용자</span>
                            <span class="attendee-response ${rsvpResponse}">${rsvpResponse === 'yes' ? '참석' : '불참'}</span>
                        </div>
                        <div class="attendee-actions">
                            <button class="btn-small" onclick="showAttendeeDetails()">상세정보</button>
                        </div>
                    </div>
                `;
            } else {
                attendeesList.innerHTML = '<div class="no-data">아직 참석자가 없습니다.</div>';
            }
        }
    } catch (error) {
        console.error('참석자 데이터 로드 실패:', error);
        attendeesList.innerHTML = '<div class="error">데이터를 불러올 수 없습니다.</div>';
    }
}

// 관리자 방명록 데이터 로드
async function loadAdminGuestbookData() {
    const guestbookList = document.getElementById('adminGuestbookList');
    guestbookList.innerHTML = '<div class="loading">방명록 데이터 로드 중...</div>';
    
    try {
        let messages = [];
        
        if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
            messages = await window.supabaseConfig.loadGuestbookMessages(50);
        } else {
            messages = JSON.parse(localStorage.getItem('guestbookData') || '[]');
        }
        
        if (messages.length === 0) {
            guestbookList.innerHTML = '<div class="no-data">아직 방명록 메시지가 없습니다.</div>';
            return;
        }
        
        guestbookList.innerHTML = messages.map((message, index) => `
            <div class="admin-guestbook-item" data-id="${message.id || index}">
                <div class="guestbook-content">
                    <div class="guestbook-header">
                        <span class="guestbook-name">${message.name}</span>
                        <span class="guestbook-date">${formatDate(message.created_at || new Date())}</span>
                    </div>
                    <div class="guestbook-message">${message.message}</div>
                    ${message.email ? `<div class="guestbook-email">📧 ${message.email}</div>` : ''}
                </div>
                <div class="guestbook-actions">
                    <button class="btn-small btn-delete" onclick="deleteGuestbookMessage('${message.id || index}')">
                        <i class="fas fa-trash"></i>
                        삭제
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('방명록 데이터 로드 실패:', error);
        guestbookList.innerHTML = '<div class="error">데이터를 불러올 수 없습니다.</div>';
    }
}

// 설정 데이터 로드
function loadSettingsData() {
    const dbStatus = document.getElementById('dbStatus');
    const currentAdminId = document.getElementById('currentAdminId');
    
    // DB 연결 상태 확인
    if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
        dbStatus.innerHTML = '<span class="status-success">✅ 연결됨</span>';
    } else {
        dbStatus.innerHTML = '<span class="status-error">❌ 연결 안됨</span>';
    }
    
    // 현재 관리자 ID 표시
    if (currentAdminUser) {
        currentAdminId.textContent = currentAdminUser;
    }
}

// 실시간 모드 토글
function toggleRealtimeMode() {
    const toggleBtn = document.querySelector('.btn-toggle-realtime');
    
    if (!dashboardRealtimeMode) {
        // 실시간 모드 시작
        dashboardRealtimeMode = true;
        toggleBtn.innerHTML = '<i class="fas fa-pause"></i> 실시간 모드 중지';
        toggleBtn.classList.add('active');
        
        // 5초마다 데이터 업데이트
        dashboardUpdateInterval = setInterval(() => {
            loadDashboardData();
        }, 5000);
        
        showNotification('실시간 모드가 시작되었습니다.', 'info');
        
    } else {
        // 실시간 모드 중지
        dashboardRealtimeMode = false;
        toggleBtn.innerHTML = '<i class="fas fa-play"></i> 실시간 모드 시작';
        toggleBtn.classList.remove('active');
        
        if (dashboardUpdateInterval) {
            clearInterval(dashboardUpdateInterval);
            dashboardUpdateInterval = null;
        }
        
        showNotification('실시간 모드가 중지되었습니다.', 'info');
    }
}

// 모든 통계 새로고침
function refreshAllStats() {
    showNotification('데이터를 새로고침합니다...', 'info');
    loadDashboardData();
}

// 방명록 새로고침
function refreshGuestbook() {
    loadAdminGuestbookData();
    showNotification('방명록이 새로고침되었습니다.', 'success');
}

// QR 스캐너 시작 (기존 함수 재사용)
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
                facingMode: 'environment',
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
        
        showNotification('QR 코드 스캐너가 시작되었습니다.', 'success');
        
    } catch (error) {
        console.error('카메라 접근 실패:', error);
        showNotification('카메라에 접근할 수 없습니다.', 'error');
    }
}

// QR 스캐너 중지
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
    
    showNotification('QR 코드 스캐너가 중지되었습니다.', 'info');
}

// QR 코드 감지 처리
function handleQRCodeDetection(qrData) {
    console.log('QR 코드 감지:', qrData);
    
    try {
        const scannedData = JSON.parse(qrData);
        const scanResults = document.getElementById('scanResults');
        
        // 스캔 결과 표시
        scanResults.style.display = 'block';
        scanResults.innerHTML = `
            <div class="scan-success">
                <h4>✅ QR 코드 스캔 성공</h4>
                <div class="scan-info">
                    <p><strong>QR ID:</strong> ${scannedData.id}</p>
                    <p><strong>참석자:</strong> ${scannedData.name}</p>
                    <p><strong>생성시간:</strong> ${formatDate(scannedData.timestamp)}</p>
                    <p><strong>상태:</strong> ${scannedData.status}</p>
                </div>
                <button class="btn-confirm-entry" onclick="confirmEntry('${scannedData.id}')">
                    입장 확인
                </button>
            </div>
        `;
        
        // 스캐너 자동 중지
        stopQRScanner();
        
    } catch (error) {
        console.error('QR 코드 파싱 실패:', error);
        showNotification('올바르지 않은 QR 코드입니다.', 'error');
    }
}

// 입장 확인
function confirmEntry(qrId) {
    if (confirm('이 참석자의 입장을 확인하시겠습니까?')) {
        showNotification(`${qrId} 참석자 입장이 확인되었습니다.`, 'success');
        
        // 스캔 결과 숨김
        document.getElementById('scanResults').style.display = 'none';
    }
}

// 데이터 내보내기 함수들
function exportAttendees() {
    showNotification('참석자 데이터를 CSV로 내보냅니다...', 'info');
    // CSV 내보내기 로직 구현
}

function exportGuestbook() {
    const guestbookData = JSON.parse(localStorage.getItem('guestbookData') || '[]');
    if (guestbookData.length === 0) {
        showNotification('내보낼 방명록 데이터가 없습니다.', 'warning');
        return;
    }
    
    // CSV 형태로 변환
    const headers = ['이름', '메시지', '이메일', '작성시간'];
    const csvContent = [
        headers.join(','),
        ...guestbookData.map(item => [
            item.name,
            `"${item.message.replace(/"/g, '""')}"`,
            item.email || '',
            formatDate(item.timestamp || new Date())
        ].join(','))
    ].join('\n');
    
    // 파일 다운로드
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `방명록_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showNotification('방명록 데이터가 CSV로 내보내졌습니다.', 'success');
}

function exportAllData() {
    showNotification('전체 데이터를 내보냅니다...', 'info');
    // 전체 데이터 내보내기 로직 구현
}

// DB 연결 테스트
function testDbConnection() {
    const dbStatus = document.getElementById('dbStatus');
    dbStatus.innerHTML = '<span class="status-loading">🔄 테스트 중...</span>';
    
    setTimeout(() => {
        if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
            dbStatus.innerHTML = '<span class="status-success">✅ 연결 성공</span>';
            showNotification('데이터베이스 연결이 정상입니다.', 'success');
        } else {
            dbStatus.innerHTML = '<span class="status-error">❌ 연결 실패</span>';
            showNotification('데이터베이스 연결에 실패했습니다.', 'error');
        }
    }, 2000);
}

// 관리자 비밀번호 변경
function changeAdminPassword() {
    const newPassword = prompt('새 비밀번호를 입력하세요:');
    if (newPassword && newPassword.length >= 6) {
        // 실제로는 서버에서 처리해야 함
        showNotification('비밀번호가 변경되었습니다. (데모 모드)', 'success');
    } else if (newPassword) {
        showNotification('비밀번호는 6자 이상이어야 합니다.', 'error');
    }
}

// 방명록 메시지 삭제
function deleteGuestbookMessage(messageId) {
    if (confirm('이 방명록 메시지를 삭제하시겠습니까?')) {
        const guestbookData = JSON.parse(localStorage.getItem('guestbookData') || '[]');
        const filteredData = guestbookData.filter((_, index) => index.toString() !== messageId);
        localStorage.setItem('guestbookData', JSON.stringify(filteredData));
        
        loadAdminGuestbookData();
        showNotification('방명록 메시지가 삭제되었습니다.', 'success');
    }
}

// 참석자 상세정보 표시
function showAttendeeDetails() {
    showNotification('참석자 상세정보 기능은 추후 구현 예정입니다.', 'info');
}

// 유틸리티 함수들
function formatDate(dateInput) {
    const date = new Date(dateInput);
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 알림 표시 함수
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    container.appendChild(notification);
    
    // 애니메이션
    setTimeout(() => notification.classList.add('show'), 100);
    
    // 자동 제거
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}