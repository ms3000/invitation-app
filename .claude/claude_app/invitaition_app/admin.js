// 관리자 페이지 전용 JavaScript - v1.2 (오류 수정)
// =====================================
console.log('🚀 Admin.js v1.2 로드됨');

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
    
    try {
        // 이벤트 리스너 설정 (가장 먼저)
        setupEventListeners();
        
        // 로그인 상태 확인 (라이브러리 로드와 독립적으로)
        checkLoginStatus();
        
        // 라이브러리 로드 (백그라운드에서)
        loadLibraries().then(() => {
            console.log('✅ 라이브러리 로드 완료');
        }).catch(error => {
            console.warn('⚠️ 라이브러리 로드 실패 (일부 기능 제한될 수 있음):', error);
        });
        
        console.log('✅ 관리자 페이지 초기화 완료');
    } catch (error) {
        console.error('❌ 관리자 페이지 초기화 실패:', error);
        
        // 오류가 발생해도 로딩 화면을 숨기고 로그인 화면 표시
        const loadingScreen = document.getElementById('loadingScreen');
        const loginScreen = document.getElementById('loginScreen');
        
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        if (loginScreen) {
            loginScreen.style.display = 'block';
        }
        
        // showNotification이 정의되어 있는지 확인 후 사용
        if (typeof showNotification === 'function') {
            showNotification('페이지 로드 중 오류가 발생했습니다. 새로고침을 시도해주세요.', 'error');
        } else {
            alert('페이지 로드 중 오류가 발생했습니다. 새로고침을 시도해주세요.');
        }
    }
});

// 라이브러리 로드
async function loadLibraries() {
    const results = [];
    
    // Supabase 초기화
    try {
        if (typeof window.supabaseConfig !== 'undefined') {
            await window.supabaseConfig.initialize();
            console.log('✅ Supabase 연결 완료');
            results.push('supabase-ok');
        } else {
            console.warn('⚠️ Supabase 설정을 찾을 수 없음');
            results.push('supabase-skip');
        }
    } catch (error) {
        console.warn('⚠️ Supabase 초기화 실패:', error);
        results.push('supabase-error');
    }
    
    // QR 라이브러리 로드
    try {
        await loadQRLibrary();
        console.log('✅ QR 라이브러리 로드 완료');
        results.push('qrcode-ok');
    } catch (error) {
        console.warn('⚠️ QR 라이브러리 로드 실패:', error);
        results.push('qrcode-error');
    }
    
    try {
        if (typeof window.loadJsQRLibrary === 'function') {
            await window.loadJsQRLibrary();
            console.log('✅ jsQR 라이브러리 로드 완료');
            results.push('jsqr-ok');
        } else {
            console.warn('⚠️ jsQR 라이브러리 로더가 없음');
            results.push('jsqr-no-loader');
        }
    } catch (error) {
        console.warn('⚠️ jsQR 라이브러리 로드 실패:', error);
        results.push('jsqr-error');
    }
    
    console.log('📊 라이브러리 로드 결과:', results);
    return results;
}

// 로그인 상태 확인
function checkLoginStatus() {
    console.log('🔐 로그인 상태 확인 중...');
    
    // 즉시 로딩 화면 숨기기 (더 빠른 응답을 위해)
    const loadingScreen = document.getElementById('loadingScreen');
    const loginScreen = document.getElementById('loginScreen');
    const adminDashboard = document.getElementById('adminDashboard');
    
    // 먼저 로딩 화면을 숨김
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
        console.log('✅ 로딩 화면 숨김');
    }
    
    try {
        const savedLogin = localStorage.getItem('adminLogin');
        console.log('저장된 로그인 정보:', savedLogin ? '있음' : '없음');
        
        if (savedLogin) {
            try {
                const loginData = JSON.parse(savedLogin);
                const loginTime = new Date(loginData.timestamp);
                const now = new Date();
                const hoursDiff = (now - loginTime) / (1000 * 60 * 60);
                
                console.log(`로그인 시간 차이: ${hoursDiff.toFixed(1)}시간`);
                
                // 24시간 이내의 로그인만 유효
                if (hoursDiff < 24 && ADMIN_CREDENTIALS[loginData.adminId]) {
                    console.log('✅ 유효한 로그인 발견, 대시보드 표시');
                    isAdminLoggedIn = true;
                    currentAdminUser = loginData.adminId;
                    
                    // 로그인 화면 숨기기
                    if (loginScreen) {
                        loginScreen.style.display = 'none';
                    }
                    
                    showAdminDashboard();
                    return;
                } else {
                    // 만료된 로그인 정보 제거
                    localStorage.removeItem('adminLogin');
                    console.log('⚠️ 만료된 로그인 정보 삭제');
                }
            } catch (parseError) {
                console.error('❌ 로그인 데이터 파싱 오류:', parseError);
                localStorage.removeItem('adminLogin');
            }
        }
        
        // 로그인이 필요한 경우
        showLoginScreen();
        
    } catch (error) {
        console.error('❌ 로그인 상태 확인 중 오류:', error);
        showLoginScreen();
    }
}

// 로그인 화면 표시
function showLoginScreen() {
    const loginScreen = document.getElementById('loginScreen');
    const adminDashboard = document.getElementById('adminDashboard');
    
    if (loginScreen) {
        loginScreen.style.display = 'flex';
        console.log('✅ 로그인 화면 표시');
    } else {
        console.error('❌ 로그인 화면 엘리먼트를 찾을 수 없음');
        // 강제로 HTML 생성
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; font-family: Arial, sans-serif;">
                <h2>관리자 로그인</h2>
                <p>페이지 로드에 문제가 발생했습니다. 페이지를 새로고침 해주세요.</p>
                <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    새로고침
                </button>
            </div>
        `;
    }
    
    if (adminDashboard) {
        adminDashboard.style.display = 'none';
    }
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
        case 'content':
            loadContentData();
            break;
        case 'qr':
            // QR 섹션 로드시 참석자 명단 업데이트
            updateAttendeeList();
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
        let attendeesData = [];
        let loadSource = 'none';
        
        // Supabase에서 참석자 데이터 로드 시도
        if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
            try {
                attendeesData = await window.supabaseConfig.getAttendeesData();
                loadSource = 'supabase';
                console.log('Supabase에서 참석자 데이터 로드:', attendeesData);
            } catch (supabaseError) {
                console.warn('Supabase 참석자 데이터 로드 실패:', supabaseError);
            }
        }
        
        // 로컬 데이터로 보완
        if (attendeesData.length === 0) {
            const localAttendees = getLocalAttendeesData();
            if (localAttendees.length > 0) {
                attendeesData = localAttendees;
                loadSource = 'localStorage';
            }
        }
        
        if (attendeesData.length > 0) {
            // 참석자 목록 렌더링
            const attendeesHtml = attendeesData.map(attendee => `
                <div class="attendee-item" data-id="${attendee.id}">
                    <div class="attendee-header">
                        <div class="attendee-info">
                            <span class="attendee-name">${escapeHtml(attendee.name || '이름 없음')}</span>
                            <span class="attendee-response ${attendee.response || 'unknown'}">
                                ${getResponseText(attendee.response)}
                            </span>
                            <span class="attendee-date">${formatAttendeeDate(attendee.created_at || attendee.timestamp)}</span>
                        </div>
                        <div class="attendee-actions">
                            <button class="btn-small" onclick="toggleAttendeeDetails('${attendee.id}')">
                                <i class="fas fa-chevron-down"></i> 상세보기
                            </button>
                            ${(attendee.phone && attendee.email) ? `<button class="btn-small btn-qr" onclick="generateAttendeeQRCodeAdmin('${attendee.id}')">
                                <i class="fas fa-qrcode"></i> QR 생성
                            </button>` : ''}
                            ${loadSource === 'localStorage' ? `<button class="btn-small btn-delete" onclick="removeLocalAttendee('${attendee.id}')">
                                <i class="fas fa-trash"></i> 삭제
                            </button>` : ''}
                        </div>
                    </div>
                    <div class="attendee-details" id="details-${attendee.id}" style="display: none;">
                        <div class="detail-row">
                            ${attendee.email ? `<div class="detail-item">
                                <strong><i class="fas fa-envelope"></i> 이메일:</strong> 
                                <span>${escapeHtml(attendee.email)}</span>
                            </div>` : '<div class="detail-item detail-missing">이메일 정보 없음</div>'}
                            ${attendee.phone ? `<div class="detail-item">
                                <strong><i class="fas fa-phone"></i> 연락처:</strong> 
                                <span>${escapeHtml(attendee.phone)}</span>
                            </div>` : '<div class="detail-item detail-missing">연락처 정보 없음</div>'}
                        </div>
                        ${attendee.message ? `<div class="detail-item">
                            <strong><i class="fas fa-comment"></i> 메시지:</strong>
                            <p class="attendee-message">${escapeHtml(attendee.message)}</p>
                        </div>` : ''}
                        <div class="detail-item">
                            <strong><i class="fas fa-tag"></i> 데이터 출처:</strong> 
                            <span class="source-badge source-${attendee.source || 'unknown'}">${getSourceText(attendee.source)}</span>
                        </div>
                        <div class="qr-container" id="qr-container-${attendee.id}" style="display: none;">
                            <div class="qr-header">
                                <strong><i class="fas fa-qrcode"></i> 입장용 QR 코드</strong>
                            </div>
                            <div class="qr-content">
                                <canvas id="qr-canvas-${attendee.id}" width="200" height="200"></canvas>
                                <div class="qr-info">
                                    <div class="qr-id">ID: <span id="qr-id-${attendee.id}">-</span></div>
                                    <div class="qr-actions">
                                        <button class="btn-small" onclick="downloadAttendeeQR('${attendee.id}')">
                                            <i class="fas fa-download"></i> 다운로드
                                        </button>
                                        <button class="btn-small" onclick="copyQRInfo('${attendee.id}')">
                                            <i class="fas fa-copy"></i> 정보 복사
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
            
            attendeesList.innerHTML = attendeesHtml;
            
            // 성공 메시지
            showNotification(`참석자 ${attendeesData.length}명을 ${loadSource === 'supabase' ? '데이터베이스' : '로컬'}에서 불러왔습니다.`, 'success');
            
        } else {
            // 참석자가 없는 경우
            attendeesList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-users"></i>
                    <p>아직 참석자가 없습니다.</p>
                    <small>사용자가 RSVP 응답을 하면 여기에 표시됩니다.</small>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('참석자 데이터 로드 실패:', error);
        attendeesList.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>참석자 데이터를 불러오는 중 오류가 발생했습니다.</p>
                <button class="btn-small" onclick="loadAttendeesData()">다시 시도</button>
            </div>
        `;
        showNotification('참석자 데이터 로드에 실패했습니다.', 'error');
    }
}

// 로컬 참석자 데이터 가져오기
function getLocalAttendeesData() {
    const attendees = [];
    
    // 새로운 RSVP 데이터 (상세 정보 포함)
    const attendeeData = JSON.parse(localStorage.getItem('attendeeData') || '{}');
    const rsvpResponse = localStorage.getItem('rsvpResponse');
    
    if (attendeeData.name && rsvpResponse) {
        attendees.push({
            id: 'attendee-' + Date.now(),
            name: attendeeData.name,
            phone: attendeeData.phone,
            email: attendeeData.email,
            message: attendeeData.message,
            response: rsvpResponse,
            created_at: new Date().toISOString(),
            source: 'attendee'
        });
    }
    
    // 기존 RSVP 응답 데이터 (하위 호환성)
    if (!attendeeData.name && rsvpResponse) {
        attendees.push({
            id: 'rsvp-local',
            name: '로컬 사용자',
            response: rsvpResponse,
            created_at: new Date().toISOString(),
            source: 'rsvp'
        });
    }
    
    // 방명록 데이터에서 참석자 정보 추출
    const guestbookData = JSON.parse(localStorage.getItem('guestbookData') || '[]');
    guestbookData.forEach((entry, index) => {
        if (entry.name) {
            attendees.push({
                id: 'guestbook-' + index,
                name: entry.name,
                message: entry.message,
                response: 'yes', // 방명록을 남긴 사람은 참석으로 간주
                created_at: entry.timestamp,
                source: 'guestbook'
            });
        }
    });
    
    return attendees;
}

// 응답 텍스트 변환
function getResponseText(response) {
    switch(response) {
        case 'yes': return '참석';
        case 'no': return '불참';
        default: return '미응답';
    }
}

// 데이터 출처 텍스트 변환
function getSourceText(source) {
    switch(source) {
        case 'attendee': return 'RSVP 신청';
        case 'rsvp': return 'RSVP 응답';
        case 'guestbook': return '방명록';
        default: return '알 수 없음';
    }
}

// 참석자 상세정보 토글
function toggleAttendeeDetails(attendeeId) {
    const details = document.getElementById(`details-${attendeeId}`);
    const button = event.target.closest('button');
    const icon = button.querySelector('i');
    
    if (details.style.display === 'none') {
        details.style.display = 'block';
        icon.className = 'fas fa-chevron-up';
        button.innerHTML = '<i class="fas fa-chevron-up"></i> 접기';
    } else {
        details.style.display = 'none';
        icon.className = 'fas fa-chevron-down';
        button.innerHTML = '<i class="fas fa-chevron-down"></i> 상세보기';
    }
}

// 관리자에서 참석자 QR 코드 생성
async function generateAttendeeQRCodeAdmin(attendeeId) {
    try {
        // QR 라이브러리 확인
        if (typeof QRCode === 'undefined') {
            showNotification('QR 코드 라이브러리가 로드되지 않았습니다.', 'error');
            return;
        }
        
        // 참석자 데이터 찾기
        const attendeesData = await getAllAttendeesData();
        const attendee = attendeesData.find(a => a.id === attendeeId);
        
        if (!attendee) {
            showNotification('참석자 정보를 찾을 수 없습니다.', 'error');
            return;
        }
        
        if (!attendee.phone || !attendee.email) {
            showNotification('QR 코드 생성을 위해서는 연락처와 이메일이 필요합니다.', 'error');
            return;
        }
        
        const timestamp = Date.now();
        const qrId = `QR-${timestamp.toString(36).toUpperCase()}`;
        
        // QR 코드 데이터 생성
        const qrData = {
            id: qrId,
            name: attendee.name,
            phone: attendee.phone,
            email: attendee.email,
            eventId: window.supabaseConfig?.currentEventId || 'default-event',
            timestamp: timestamp,
            status: 'active',
            type: 'attendee'
        };
        
        const qrString = JSON.stringify(qrData);
        const canvas = document.getElementById(`qr-canvas-${attendeeId}`);
        const qrContainer = document.getElementById(`qr-container-${attendeeId}`);
        const qrIdElement = document.getElementById(`qr-id-${attendeeId}`);
        
        if (!canvas) {
            showNotification('QR 코드 캔버스를 찾을 수 없습니다.', 'error');
            return;
        }
        
        // 캔버스에 QR 코드 생성
        await QRCode.toCanvas(canvas, qrString, {
            width: 200,
            height: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        // QR 정보 업데이트
        qrIdElement.textContent = qrId;
        qrContainer.style.display = 'block';
        
        // 전역 저장 (다운로드용)
        window.attendeeQRCodes = window.attendeeQRCodes || {};
        window.attendeeQRCodes[attendeeId] = qrData;
        
        showNotification(`${attendee.name}님의 QR 코드가 생성되었습니다!`, 'success');
        
    } catch (error) {
        console.error('QR 코드 생성 실패:', error);
        showNotification('QR 코드 생성에 실패했습니다.', 'error');
    }
}

// 모든 참석자 데이터 가져오기 (통합)
async function getAllAttendeesData() {
    let attendeesData = [];
    
    // Supabase에서 시도
    if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
        try {
            attendeesData = await window.supabaseConfig.getAttendeesData();
        } catch (error) {
            console.warn('Supabase 데이터 로드 실패:', error);
        }
    }
    
    // 로컬 데이터로 보완
    if (attendeesData.length === 0) {
        attendeesData = getLocalAttendeesData();
    }
    
    return attendeesData;
}

// 참석자 QR 다운로드
function downloadAttendeeQR(attendeeId) {
    const canvas = document.getElementById(`qr-canvas-${attendeeId}`);
    const qrData = window.attendeeQRCodes?.[attendeeId];
    
    if (!canvas || !qrData) {
        showNotification('다운로드할 QR 코드가 없습니다.', 'error');
        return;
    }
    
    try {
        const link = document.createElement('a');
        link.href = canvas.toDataURL();
        link.download = `QR-${qrData.name}-${qrData.id}.png`;
        link.click();
        
        showNotification(`${qrData.name}님의 QR 코드가 다운로드되었습니다.`, 'success');
    } catch (error) {
        console.error('QR 다운로드 실패:', error);
        showNotification('QR 코드 다운로드에 실패했습니다.', 'error');
    }
}

// QR 코드 정보 복사
function copyQRInfo(attendeeId) {
    const qrData = window.attendeeQRCodes?.[attendeeId];
    
    if (!qrData) {
        showNotification('복사할 QR 정보가 없습니다.', 'error');
        return;
    }
    
    const qrInfo = `참석자 QR 코드 정보
이름: ${qrData.name}
연락처: ${qrData.phone}
이메일: ${qrData.email}
QR ID: ${qrData.id}
생성시간: ${new Date(qrData.timestamp).toLocaleString('ko-KR')}`;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(qrInfo).then(() => {
            showNotification('QR 코드 정보가 복사되었습니다.', 'success');
        });
    } else {
        showNotification('클립보드 복사를 지원하지 않는 브라우저입니다.', 'error');
    }
}

// 로컬 참석자 삭제
function removeLocalAttendee(attendeeId) {
    if (!confirm('이 참석자 정보를 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        if (attendeeId === 'rsvp-local' || attendeeId.startsWith('attendee-')) {
            // RSVP 데이터 삭제
            localStorage.removeItem('rsvpResponse');
            localStorage.removeItem('attendeeData');
            showNotification('RSVP 데이터가 삭제되었습니다.', 'success');
        } else if (attendeeId.startsWith('guestbook-')) {
            // 방명록 데이터 삭제
            const index = parseInt(attendeeId.replace('guestbook-', ''));
            const guestbookData = JSON.parse(localStorage.getItem('guestbookData') || '[]');
            
            if (index >= 0 && index < guestbookData.length) {
                guestbookData.splice(index, 1);
                localStorage.setItem('guestbookData', JSON.stringify(guestbookData));
                showNotification('방명록 데이터가 삭제되었습니다.', 'success');
            } else {
                showNotification('삭제할 데이터를 찾을 수 없습니다.', 'error');
                return;
            }
        }
        
        // QR 데이터도 삭제
        if (window.attendeeQRCodes && window.attendeeQRCodes[attendeeId]) {
            delete window.attendeeQRCodes[attendeeId];
        }
        
        // 참석자 목록 다시 로드
        loadAttendeesData();
        
    } catch (error) {
        console.error('참석자 삭제 실패:', error);
        showNotification('참석자 삭제에 실패했습니다.', 'error');
    }
}

// 참석자 날짜 포맷
function formatAttendeeDate(dateStr) {
    if (!dateStr) return '';
    
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return '';
    }
}

// 참석자 상세 정보 토글
function toggleAttendeeDetails(attendeeId) {
    const attendeeItem = document.querySelector(`[data-id="${attendeeId}"]`);
    if (!attendeeItem) return;
    
    const details = attendeeItem.querySelector('.attendee-details');
    const button = attendeeItem.querySelector('button');
    
    if (details.style.display === 'none' || !details.style.display) {
        details.style.display = 'block';
        button.textContent = '간략히';
    } else {
        details.style.display = 'none';
        button.textContent = '상세보기';
    }
}

// 로컬 참석자 제거
function removeLocalAttendee(attendeeId) {
    if (!confirm('이 참석자 정보를 삭제하시겠습니까?')) return;
    
    try {
        if (attendeeId === 'rsvp-local') {
            localStorage.removeItem('rsvpResponse');
            showNotification('RSVP 응답이 삭제되었습니다.', 'success');
        } else if (attendeeId.startsWith('guestbook-')) {
            const index = parseInt(attendeeId.replace('guestbook-', ''));
            const guestbookData = JSON.parse(localStorage.getItem('guestbookData') || '[]');
            
            if (index >= 0 && index < guestbookData.length) {
                guestbookData.splice(index, 1);
                localStorage.setItem('guestbookData', JSON.stringify(guestbookData));
                showNotification('방명록 항목이 삭제되었습니다.', 'success');
            }
        }
        
        // 참석자 목록 새로고침
        loadAttendeesData();
        
    } catch (error) {
        console.error('참석자 삭제 실패:', error);
        showNotification('참석자 삭제에 실패했습니다.', 'error');
    }
}

// HTML 이스케이프 함수
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    console.log('🚀 QR 스캐너 시작 시도...');
    
    try {
        // jsQR 라이브러리 확인 및 로드
        if (typeof jsQR === 'undefined') {
            console.log('⚠️ jsQR 라이브러리 없음, 로드 시도...');
            
            if (typeof window.loadJsQRLibrary === 'function') {
                await window.loadJsQRLibrary();
                
                if (typeof jsQR === 'undefined') {
                    showNotification('QR 스캔 라이브러리 로드에 실패했습니다. 페이지를 새로고침해주세요.', 'error');
                    return;
                }
            } else {
                showNotification('QR 스캔 기능을 사용할 수 없습니다. jsQR 라이브러리가 로드되지 않았습니다.', 'error');
                return;
            }
        }
        
        console.log('✅ jsQR 라이브러리 확인됨');
        
        // 카메라 권한 확인
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showNotification('이 브라우저에서는 카메라 접근이 지원되지 않습니다.', 'error');
            return;
        }
        
        console.log('✅ 카메라 API 지원 확인됨');
        
        const video = document.getElementById('qrScannerVideo');
        const canvas = document.getElementById('qrScannerCanvas');
        const placeholder = document.querySelector('.scanner-placeholder');
        
        // 카메라 스트림 얻기
        console.log('📷 카메라 스트림 요청 중...');
        
        const constraints = {
            video: { 
                facingMode: 'environment', // 후면 카메라 우선
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };
        
        try {
            qrScannerStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('✅ 카메라 스트림 획득 성공');
        } catch (cameraError) {
            console.warn('⚠️ 후면 카메라 실패, 전면 카메라 시도...', cameraError);
            
            // 후면 카메라 실패시 전면 카메라 시도
            try {
                qrScannerStream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        facingMode: 'user',
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
                });
                console.log('✅ 전면 카메라 스트림 획득 성공');
            } catch (frontCameraError) {
                console.warn('⚠️ 전면 카메라도 실패, 기본 카메라 시도...', frontCameraError);
                
                // 모든 특정 설정 없이 기본 카메라 시도
                try {
                    qrScannerStream = await navigator.mediaDevices.getUserMedia({
                        video: true
                    });
                    console.log('✅ 기본 카메라 스트림 획득 성공');
                } catch (basicCameraError) {
                    console.error('❌ 모든 카메라 접근 실패:', basicCameraError);
                    showNotification('카메라에 접근할 수 없습니다. 카메라 권한을 허용해주세요.', 'error');
                    return;
                }
            }
        }
        
        video.srcObject = qrScannerStream;
        video.play();
        
        // UI 업데이트
        video.style.display = 'block';
        placeholder.style.display = 'none';
        document.querySelector('.btn-start-scan').style.display = 'none';
        document.querySelector('.btn-stop-scan').style.display = 'inline-flex';
        
        // QR 스캔 시작 함수
        const startScanning = () => {
            console.log('🔍 QR 스캔 루프 시작');
            
            // 캔버스 크기 설정
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const context = canvas.getContext('2d');
            
            console.log(`📐 캔버스 크기: ${canvas.width} x ${canvas.height}`);
            console.log(`📐 비디오 크기: ${video.videoWidth} x ${video.videoHeight}`);
            
            let scanCount = 0;
            
            qrScannerInterval = setInterval(() => {
                scanCount++;
                
                if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
                    // 현재 비디오 크기에 맞춰 캔버스 크기 조정
                    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        console.log(`📐 캔버스 크기 재조정: ${canvas.width} x ${canvas.height}`);
                    }
                    
                    try {
                        // 비디오 프레임을 캔버스에 그리기
                        context.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                        
                        // QR 코드 감지 시도
                        const code = jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: "dontInvert"
                        });
                        
                        // 10번마다 스캔 상태 로그 (너무 많은 로그 방지)
                        if (scanCount % 50 === 0) {
                            console.log(`🔍 QR 스캔 중... (${scanCount}번째 시도)`);
                        }
                        
                        if (code) {
                            console.log('🎉 QR 코드 발견!', code.data);
                            clearInterval(qrScannerInterval);
                            handleQRCodeDetection(code.data);
                        }
                        
                    } catch (scanError) {
                        console.error('QR 스캔 중 오류:', scanError);
                    }
                } else {
                    if (scanCount % 50 === 0) {
                        console.log('⏳ 비디오 데이터 대기 중...', {
                            readyState: video.readyState,
                            videoWidth: video.videoWidth,
                            videoHeight: video.videoHeight
                        });
                    }
                }
            }, 100);
        };
        
        // 비디오가 로드될 때까지 기다림
        video.addEventListener('loadedmetadata', startScanning);
        
        // 비디오가 이미 로드된 경우 즉시 시작
        if (video.readyState >= video.HAVE_METADATA) {
            startScanning();
        } else {
            console.log('⏳ 비디오 메타데이터 로드 대기 중...');
        }
        
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
    console.log('🔍 QR 코드 감지 시작:', qrData);
    console.log('QR 데이터 타입:', typeof qrData);
    console.log('QR 데이터 길이:', qrData.length);
    
    const scanResults = document.getElementById('scanResults');
    
    if (!scanResults) {
        console.error('❌ scanResults 엘리먼트를 찾을 수 없음');
        alert('QR 스캔 결과를 표시할 영역을 찾을 수 없습니다.');
        return;
    }
    
    try {
        console.log('📋 JSON 파싱 시도...');
        const scannedData = JSON.parse(qrData);
        console.log('✅ 파싱된 QR 데이터:', scannedData);
        
        // 중복 스캔 방지
        const scannedAttendees = JSON.parse(localStorage.getItem('scannedAttendees') || '[]');
        const alreadyScanned = scannedAttendees.find(attendee => attendee.id === scannedData.id);
        
        if (alreadyScanned) {
            scanResults.style.display = 'block';
            scanResults.innerHTML = `
                <div class="scan-warning">
                    <h4>⚠️ 이미 입장 확인된 참석자입니다</h4>
                    <div class="scan-info">
                        <p><strong>참석자:</strong> ${scannedData.name}</p>
                        <p><strong>첫 입장시간:</strong> ${formatDate(alreadyScanned.entryTime)}</p>
                        <p><strong>QR ID:</strong> ${scannedData.id}</p>
                    </div>
                </div>
            `;
            stopQRScanner();
            return;
        }
        
        // 스캔 결과 표시
        console.log('🎉 스캔 결과 표시 시작');
        scanResults.style.display = 'block';
        scanResults.innerHTML = `
            <div class="scan-success">
                <h4>✅ QR 코드 스캔 성공</h4>
                <div class="scan-info">
                    <p><strong>QR ID:</strong> ${scannedData.id}</p>
                    <p><strong>참석자:</strong> ${scannedData.name}</p>
                    <p><strong>연락처:</strong> ${scannedData.phone || '정보 없음'}</p>
                    <p><strong>이메일:</strong> ${scannedData.email || '정보 없음'}</p>
                    <p><strong>생성시간:</strong> ${formatDate(scannedData.timestamp)}</p>
                    <p><strong>상태:</strong> ${scannedData.status}</p>
                </div>
                <div class="scan-actions">
                    <button class="btn-confirm-entry" onclick="confirmEntry('${scannedData.id}', ${JSON.stringify(scannedData).replace(/"/g, '&quot;')})">
                        <i class="fas fa-check"></i> 입장 확인
                    </button>
                    <button class="btn-reject-entry" onclick="rejectEntry('${scannedData.id}')">
                        <i class="fas fa-times"></i> 입장 거부
                    </button>
                </div>
            </div>
        `;
        
        console.log('✅ 스캔 결과 UI 업데이트 완료');
        
        // 스캐너 자동 중지
        console.log('⏸️ QR 스캐너 자동 중지');
        stopQRScanner();
        
        // 알림도 표시
        showNotification(`QR 코드 스캔 완료: ${scannedData.name}`, 'success');
        
    } catch (error) {
        console.error('QR 코드 파싱 실패:', error);
        scanResults.style.display = 'block';
        scanResults.innerHTML = `
            <div class="scan-error">
                <h4>❌ QR 코드 인식 실패</h4>
                <p>올바르지 않은 QR 코드이거나 인식할 수 없는 형식입니다.</p>
                <p class="scan-data-debug">스캔된 데이터: ${qrData.substring(0, 100)}...</p>
            </div>
        `;
        showNotification('올바르지 않은 QR 코드입니다.', 'error');
    }
}

// 입장 확인
function confirmEntry(qrId, scannedData) {
    try {
        const attendeeData = typeof scannedData === 'string' ? JSON.parse(scannedData) : scannedData;
        const entryTime = new Date().toISOString();
        
        // 참석자 정보를 스캔된 참석자 목록에 추가
        const scannedAttendees = JSON.parse(localStorage.getItem('scannedAttendees') || '[]');
        const attendeeRecord = {
            ...attendeeData,
            entryTime: entryTime,
            status: 'entered',
            scannedAt: new Date().toISOString()
        };
        
        scannedAttendees.push(attendeeRecord);
        localStorage.setItem('scannedAttendees', JSON.stringify(scannedAttendees));
        
        // Supabase에도 저장
        if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
            window.supabaseConfig.recordAttendeeEntry(attendeeRecord).catch(error => {
                console.warn('Supabase 입장 기록 저장 실패:', error);
            });
        }
        
        // UI 업데이트
        const scanResults = document.getElementById('scanResults');
        scanResults.innerHTML = `
            <div class="scan-confirmed">
                <h4>✅ 입장이 확인되었습니다</h4>
                <div class="scan-info">
                    <p><strong>참석자:</strong> ${attendeeData.name}</p>
                    <p><strong>입장시간:</strong> ${formatDate(entryTime)}</p>
                </div>
            </div>
        `;
        
        // 실시간 참석자 명단 업데이트
        updateAttendeeList();
        
        showNotification(`${attendeeData.name}님의 입장이 확인되었습니다.`, 'success');
        
        // 5초 후 스캔 결과 초기화
        setTimeout(() => {
            scanResults.style.display = 'none';
        }, 5000);
        
    } catch (error) {
        console.error('입장 확인 실패:', error);
        showNotification('입장 확인 처리에 실패했습니다.', 'error');
    }
}

// 입장 거부
function rejectEntry(qrId) {
    const scanResults = document.getElementById('scanResults');
    scanResults.innerHTML = `
        <div class="scan-rejected">
            <h4>❌ 입장이 거부되었습니다</h4>
            <p>QR ID: ${qrId}</p>
        </div>
    `;
    
    showNotification('입장이 거부되었습니다.', 'info');
    
    // 3초 후 스캔 결과 초기화
    setTimeout(() => {
        scanResults.style.display = 'none';
    }, 3000);
}

// 테스트 QR 코드 생성
async function generateTestQRCode() {
    console.log('🧪 테스트 QR 코드 생성 시작');
    
    try {
        // QR 라이브러리 확인
        if (typeof QRCode === 'undefined') {
            console.log('⚠️ QR 라이브러리 로드 시도...');
            if (typeof window.loadQRLibrary === 'function') {
                await window.loadQRLibrary();
                if (typeof QRCode === 'undefined') {
                    showNotification('QR 코드 생성 라이브러리를 로드할 수 없습니다.', 'error');
                    return;
                }
            } else {
                showNotification('QR 코드 생성 라이브러리가 없습니다.', 'error');
                return;
            }
        }
        
        const timestamp = Date.now();
        const qrId = `TEST-QR-${timestamp.toString(36).toUpperCase()}`;
        
        // 테스트 QR 데이터 생성
        const testQRData = {
            id: qrId,
            name: '테스트 참석자',
            phone: '010-1234-5678',
            email: 'test@example.com',
            eventId: 'test-event',
            timestamp: timestamp,
            status: 'active',
            type: 'attendee'
        };
        
        const qrString = JSON.stringify(testQRData);
        console.log('🏷️ 테스트 QR 데이터:', testQRData);
        console.log('📝 테스트 QR 문자열:', qrString);
        
        // QR 코드를 표시할 임시 div 생성
        const existingTestDiv = document.getElementById('testQRDisplay');
        if (existingTestDiv) {
            existingTestDiv.remove();
        }
        
        const testQRDiv = document.createElement('div');
        testQRDiv.id = 'testQRDisplay';
        testQRDiv.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: white; padding: 20px; border-radius: 10px; 
                        box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; text-align: center;">
                <h3>🧪 테스트 QR 코드</h3>
                <canvas id="testQRCanvas" width="256" height="256"></canvas>
                <p><strong>QR ID:</strong> ${qrId}</p>
                <p><strong>참석자:</strong> ${testQRData.name}</p>
                <div style="margin-top: 15px;">
                    <button onclick="document.getElementById('testQRDisplay').remove()" 
                            style="background: #e74c3c; color: white; border: none; padding: 10px 20px; 
                                   border-radius: 5px; cursor: pointer; margin-right: 10px;">
                        닫기
                    </button>
                    <button onclick="testQRScan('${qrString}')" 
                            style="background: #27ae60; color: white; border: none; padding: 10px 20px; 
                                   border-radius: 5px; cursor: pointer;">
                        이 QR로 테스트 스캔
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(testQRDiv);
        
        // QR 코드 생성
        const testCanvas = document.getElementById('testQRCanvas');
        await QRCode.toCanvas(testCanvas, qrString, {
            width: 256,
            height: 256,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        console.log('✅ 테스트 QR 코드 생성 완료');
        showNotification('테스트 QR 코드가 생성되었습니다!', 'success');
        
    } catch (error) {
        console.error('❌ 테스트 QR 코드 생성 실패:', error);
        showNotification('테스트 QR 코드 생성에 실패했습니다.', 'error');
    }
}

// 테스트 QR 스캔 시뮬레이션
function testQRScan(qrString) {
    console.log('🧪 테스트 QR 스캔 시뮬레이션 시작');
    
    // 테스트 QR 창 닫기
    const testDiv = document.getElementById('testQRDisplay');
    if (testDiv) {
        testDiv.remove();
    }
    
    // QR 스캔 결과 처리 함수 직접 호출
    handleQRCodeDetection(qrString);
}

// 실시간 참석자 명단 업데이트
function updateAttendeeList() {
    const attendeeListContainer = document.getElementById('scannedAttendeesList');
    if (!attendeeListContainer) return;
    
    const scannedAttendees = JSON.parse(localStorage.getItem('scannedAttendees') || '[]');
    
    if (scannedAttendees.length === 0) {
        attendeeListContainer.innerHTML = `
            <div class="no-data">
                <i class="fas fa-users"></i>
                <p>아직 입장 확인된 참석자가 없습니다.</p>
                <small>QR 코드를 스캔하면 여기에 표시됩니다.</small>
            </div>
        `;
        return;
    }
    
    // 최신 입장순으로 정렬
    scannedAttendees.sort((a, b) => new Date(b.entryTime) - new Date(a.entryTime));
    
    const attendeeListHtml = scannedAttendees.map((attendee, index) => `
        <div class="scanned-attendee-item" data-id="${attendee.id}">
            <div class="attendee-number">${index + 1}</div>
            <div class="attendee-details">
                <div class="attendee-main-info">
                    <span class="attendee-name">${escapeHtml(attendee.name)}</span>
                    <span class="entry-time">${formatDate(attendee.entryTime)}</span>
                </div>
                <div class="attendee-contact-info">
                    ${attendee.phone ? `<span class="phone"><i class="fas fa-phone"></i> ${attendee.phone}</span>` : ''}
                    ${attendee.email ? `<span class="email"><i class="fas fa-envelope"></i> ${attendee.email}</span>` : ''}
                </div>
                <div class="qr-info">
                    <span class="qr-id">QR: ${attendee.id}</span>
                    <span class="scan-time">스캔: ${formatDate(attendee.scannedAt)}</span>
                </div>
            </div>
            <div class="attendee-actions">
                <button class="btn-small btn-delete" onclick="removeScannedAttendee('${attendee.id}', ${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    attendeeListContainer.innerHTML = attendeeListHtml;
    
    // 통계 업데이트
    updateAttendeeStats(scannedAttendees.length);
}

// 참석자 통계 업데이트
function updateAttendeeStats(count) {
    const statsContainer = document.querySelector('.attendee-stats');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-item">
                <div class="stat-number">${count}</div>
                <div class="stat-label">총 입장자</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${new Date().toLocaleDateString('ko-KR')}</div>
                <div class="stat-label">오늘 날짜</div>
            </div>
        `;
    }
}

// 스캔된 참석자 삭제
function removeScannedAttendee(attendeeId, index) {
    if (confirm('이 참석자를 명단에서 제거하시겠습니까?')) {
        try {
            const scannedAttendees = JSON.parse(localStorage.getItem('scannedAttendees') || '[]');
            
            // ID 또는 인덱스로 찾아서 삭제
            const attendeeIndex = scannedAttendees.findIndex(attendee => attendee.id === attendeeId);
            
            if (attendeeIndex !== -1) {
                const removedAttendee = scannedAttendees[attendeeIndex];
                scannedAttendees.splice(attendeeIndex, 1);
                localStorage.setItem('scannedAttendees', JSON.stringify(scannedAttendees));
                
                // Supabase에서도 삭제
                if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
                    window.supabaseConfig.removeAttendeeEntry(attendeeId).catch(error => {
                        console.warn('Supabase 입장 기록 삭제 실패:', error);
                    });
                }
                
                updateAttendeeList();
                showNotification(`${removedAttendee.name}님이 참석자 명단에서 제거되었습니다.`, 'success');
            } else {
                showNotification('삭제할 참석자를 찾을 수 없습니다.', 'error');
            }
            
        } catch (error) {
            console.error('참석자 삭제 실패:', error);
            showNotification('참석자 삭제에 실패했습니다.', 'error');
        }
    }
}

// 행사 실 참석자 명단 Excel 다운로드
function downloadAttendeeExcel() {
    const scannedAttendees = JSON.parse(localStorage.getItem('scannedAttendees') || '[]');
    
    if (scannedAttendees.length === 0) {
        showNotification('다운로드할 참석자 데이터가 없습니다.', 'error');
        return;
    }
    
    try {
        // CSV 형식으로 데이터 생성 (Excel에서 읽기 가능)
        const headers = ['순번', '참석자명', '연락처', '이메일', '입장시간', 'QR코드ID', '스캔시간'];
        const csvContent = [
            // BOM 추가 (한글 깨짐 방지)
            '\uFEFF',
            // 헤더
            headers.join(','),
            // 데이터 (입장 순서대로 정렬)
            ...scannedAttendees
                .sort((a, b) => new Date(a.entryTime) - new Date(b.entryTime))
                .map((attendee, index) => [
                    index + 1,
                    `"${attendee.name || ''}"`,
                    `"${attendee.phone || ''}"`,
                    `"${attendee.email || ''}"`,
                    `"${formatExcelDate(attendee.entryTime)}"`,
                    `"${attendee.id || ''}"`,
                    `"${formatExcelDate(attendee.scannedAt)}"`
                ].join(','))
        ].join('\n');
        
        // 파일 다운로드
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        
        const today = new Date().toISOString().split('T')[0];
        link.download = `행사참석자명단_${today}_${scannedAttendees.length}명.csv`;
        
        // 다운로드 실행
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification(`참석자 명단 (${scannedAttendees.length}명)이 Excel 파일로 다운로드되었습니다.`, 'success');
        
    } catch (error) {
        console.error('Excel 다운로드 실패:', error);
        showNotification('Excel 파일 다운로드에 실패했습니다.', 'error');
    }
}

// Excel용 날짜 포맷
function formatExcelDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// 참석자 명단 초기화
function clearAttendeeList() {
    if (confirm('모든 참석자 명단을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        localStorage.removeItem('scannedAttendees');
        
        // Supabase에서도 삭제
        if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
            window.supabaseConfig.clearAllAttendeeEntries().catch(error => {
                console.warn('Supabase 참석자 명단 삭제 실패:', error);
            });
        }
        
        updateAttendeeList();
        showNotification('모든 참석자 명단이 삭제되었습니다.', 'success');
    }
}

// 모든 참석자 데이터 삭제 (RSVP, 방명록, QR 스캔 기록 포함)
function clearAllAttendeeData() {
    const confirmMessage = `모든 참석자 관련 데이터를 삭제하시겠습니까?

삭제될 데이터:
• RSVP 응답 및 참석자 정보
• 방명록 메시지
• QR 스캔 입장 기록
• 생성된 QR 코드

이 작업은 되돌릴 수 없습니다.`;
    
    if (confirm(confirmMessage)) {
        try {
            // 로컬 스토리지 데이터 삭제
            localStorage.removeItem('rsvpResponse');
            localStorage.removeItem('attendeeData');
            localStorage.removeItem('guestbookData');
            localStorage.removeItem('scannedAttendees');
            
            // QR 코드 데이터 삭제
            if (window.attendeeQRCodes) {
                window.attendeeQRCodes = {};
            }
            
            // Supabase에서도 삭제 시도 (함수가 존재하는 경우만)
            if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
                try {
                    const supabaseTasks = [];
                    
                    // 존재하는 함수들만 호출
                    if (typeof window.supabaseConfig.clearAllRSVPData === 'function') {
                        supabaseTasks.push(window.supabaseConfig.clearAllRSVPData());
                    }
                    if (typeof window.supabaseConfig.clearAllGuestbookData === 'function') {
                        supabaseTasks.push(window.supabaseConfig.clearAllGuestbookData());
                    }
                    if (typeof window.supabaseConfig.clearAllAttendeeEntries === 'function') {
                        supabaseTasks.push(window.supabaseConfig.clearAllAttendeeEntries());
                    }
                    if (typeof window.supabaseConfig.clearAllQRCodes === 'function') {
                        supabaseTasks.push(window.supabaseConfig.clearAllQRCodes());
                    }
                    
                    if (supabaseTasks.length > 0) {
                        Promise.allSettled(supabaseTasks).then(results => {
                            const failures = results.filter(result => result.status === 'rejected');
                            if (failures.length > 0) {
                                console.warn('일부 데이터베이스 삭제 실패:', failures);
                                showNotification('로컬 데이터는 삭제되었지만 일부 데이터베이스 삭제에 실패했습니다.', 'warning');
                            } else {
                                showNotification('모든 참석자 데이터가 완전히 삭제되었습니다.', 'success');
                            }
                        });
                    } else {
                        console.log('Supabase 삭제 함수들이 구현되지 않음');
                        showNotification('로컬 데이터가 삭제되었습니다. (데이터베이스 연동 기능 미구현)', 'success');
                    }
                } catch (error) {
                    console.error('Supabase 삭제 중 오류:', error);
                    showNotification('로컬 데이터는 삭제되었지만 데이터베이스 삭제에 실패했습니다.', 'warning');
                }
            } else {
                showNotification('모든 참석자 데이터가 삭제되었습니다.', 'success');
            }
            
            // UI 새로고침
            loadAttendeesData();
            loadAdminGuestbookData();
            updateAttendeeList();
            
        } catch (error) {
            console.error('참석자 데이터 삭제 실패:', error);
            showNotification('데이터 삭제 중 오류가 발생했습니다.', 'error');
        }
    }
}

// 데이터 내보내기 함수들
function exportAttendees() {
    showNotification('참석자 데이터를 CSV로 내보냅니다...', 'info');
    
    try {
        const attendees = getLocalAttendeesData();
        
        if (attendees.length === 0) {
            showNotification('내보낼 참석자 데이터가 없습니다.', 'error');
            return;
        }
        
        // CSV 형식으로 데이터 생성
        const headers = ['참석자명', '연락처', '이메일', '메시지', '응답상태', '등록일시', '데이터출처'];
        const csvContent = [
            // BOM 추가 (한글 깨짐 방지)
            '\uFEFF',
            // 헤더
            headers.join(','),
            // 데이터
            ...attendees.map(attendee => [
                `"${attendee.name || ''}"`,
                `"${attendee.phone || ''}"`,
                `"${attendee.email || ''}"`,
                `"${(attendee.message || '').replace(/"/g, '""')}"`,
                `"${getResponseText(attendee.response)}"`,
                `"${formatExcelDate(attendee.created_at || attendee.timestamp)}"`,
                `"${getSourceText(attendee.source)}"`
            ].join(','))
        ].join('\n');
        
        // 파일 다운로드
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        
        const today = new Date().toISOString().split('T')[0];
        link.download = `참석자데이터_${today}_${attendees.length}명.csv`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification(`참석자 데이터 (${attendees.length}명)가 CSV 파일로 내보내졌습니다.`, 'success');
        
    } catch (error) {
        console.error('CSV 내보내기 실패:', error);
        showNotification('CSV 파일 내보내기에 실패했습니다.', 'error');
    }
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
async function deleteGuestbookMessage(messageId) {
    if (confirm('이 방명록 메시지를 삭제하시겠습니까?')) {
        console.log('삭제 시도 - messageId:', messageId, 'type:', typeof messageId);
        
        try {
            const guestbookData = JSON.parse(localStorage.getItem('guestbookData') || '[]');
            console.log('현재 방명록 데이터:', guestbookData);
            
            // messageId를 숫자로 변환하여 인덱스로 사용
            const indexToDelete = parseInt(messageId);
            
            console.log('삭제할 인덱스:', indexToDelete, '방명록 길이:', guestbookData.length);
            
            if (isNaN(indexToDelete) || indexToDelete < 0 || indexToDelete >= guestbookData.length) {
                console.error('잘못된 인덱스:', indexToDelete);
                showNotification(`삭제할 메시지를 찾을 수 없습니다. (인덱스: ${indexToDelete})`, 'error');
                return;
            }
            
            // 삭제할 메시지 정보 로그
            const messageToDelete = guestbookData[indexToDelete];
            console.log('삭제할 메시지:', messageToDelete);
            
            // 해당 인덱스의 메시지 삭제
            guestbookData.splice(indexToDelete, 1);
            localStorage.setItem('guestbookData', JSON.stringify(guestbookData));
            
            // Supabase에서도 삭제 시도
            if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
                try {
                    // Supabase에서는 실제 ID를 사용해야 할 수도 있음
                    if (messageToDelete.id) {
                        await window.supabaseConfig.deleteGuestbookMessage(messageToDelete.id);
                    }
                    console.log('✅ Supabase에서 방명록 삭제 완료');
                } catch (error) {
                    console.warn('Supabase 방명록 삭제 실패:', error);
                }
            }
            
            // UI 새로고침
            loadAdminGuestbookData();
            showNotification('방명록 메시지가 삭제되었습니다.', 'success');
            
        } catch (error) {
            console.error('방명록 삭제 실패:', error);
            showNotification('방명록 삭제에 실패했습니다.', 'error');
        }
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

// 컨텐츠 관리 관련 함수들
// ===============================

// 컨텐츠 데이터 로드
async function loadContentData() {
    try {
        let contentData = {};
        let loadSource = 'default';
        
        // 먼저 localStorage에서 시도
        try {
            const localData = JSON.parse(localStorage.getItem('contentData') || '{}');
            if (Object.keys(localData).length > 0) {
                contentData = localData;
                loadSource = 'localStorage';
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
                }
            } catch (supabaseError) {
                console.warn('Supabase 데이터 로드 실패, localStorage 사용:', supabaseError);
            }
        }
        
        // 기본값으로 현재 index.html 값들 설정
        const defaultContent = {
            heroImage: 'https://picsum.photos/400/300?random=1',
            eventTitle: '2024 비즈니스 혁신 컨퍼런스',
            eventSubtitle: '미래를 준비하는 리더들의 만남',
            eventDate: '2024년 12월 15일 (일) 오후 2시',
            eventLocation: '서울 강남구 컨벤션센터',
            greetingContent: '안녕하세요!\n\n급변하는 비즈니스 환경에서 혁신적인 사고와 전략이 그 어느 때보다 중요한 시점입니다.\n\n이번 컨퍼런스에서는 업계 최고의 전문가들과 함께 미래 비즈니스 트렌드를 살펴보고, 실무에 바로 적용할 수 있는 인사이트를 공유하고자 합니다.\n\n여러분의 소중한 참석을 기다리겠습니다.',
            greetingSignature: '주최자 일동',
            eventDetailTime: '2024년 12월 15일 (일)\n오후 2:00 ~ 오후 6:00',
            eventDetailLocation: '서울 강남구 컨벤션센터\n대강당 (3층)',
            eventTarget: '기업 임직원, 창업가\n비즈니스 관계자',
            eventFee: '무료 (사전 등록 필수)',
            locationAddress: '서울특별시 강남구 테헤란로 123\n컨벤션센터 3층 대강당',
            subwayInfo: '지하철 2호선 강남역 3번 출구 도보 5분',
            busInfo: '버스 146, 360, 740 강남역 하차',
            parkingInfo: '지하 주차장 이용 가능 (2시간 무료)',
            contactPhone: '02-1234-5678',
            contactEmail: 'info@conference.com',
            donationMessage: '후원을 통해 더 나은 행사를 만들어가겠습니다.',
            bankName: '국민은행',
            accountNumber: '123456-78-901234',
            accountHolder: '컨퍼런스주최자',
            galleryImages: [
                'https://picsum.photos/300/200?random=2',
                'https://picsum.photos/300/200?random=3',
                'https://picsum.photos/300/200?random=4',
                'https://picsum.photos/300/200?random=5'
            ]
        };
        
        // 저장된 데이터와 기본값 병합
        contentData = { ...defaultContent, ...contentData };
        
        // 폼 필드에 데이터 설정
        populateContentForm(contentData);
        
        // 로드 성공 알림
        console.log(`컨텐츠 데이터 로드 완료 (${loadSource})`);
        if (loadSource !== 'default') {
            showNotification(`컨텐츠 데이터를 ${loadSource === 'supabase' ? '데이터베이스' : '로컬'}에서 불러왔습니다.`, 'success');
        }
        
    } catch (error) {
        console.error('컨텐츠 데이터 로드 실패:', error);
        showNotification('컨텐츠 데이터를 불러오는 중 오류가 발생했습니다. 기본값을 사용합니다.', 'warning');
        
        // 기본값으로 폼 초기화
        try {
            populateContentForm({});
        } catch (formError) {
            console.error('폼 초기화 실패:', formError);
        }
    }
}

// 폼에 컨텐츠 데이터 설정
function populateContentForm(contentData) {
    // 각 입력 필드에 데이터 설정
    Object.keys(contentData).forEach(key => {
        const element = document.getElementById(key);
        if (element && key !== 'galleryImages') {
            element.value = contentData[key] || '';
        }
    });
    
    // 갤러리 이미지 별도 처리
    if (contentData.galleryImages) {
        loadGalleryImages(contentData.galleryImages);
    }
}

// 갤러리 이미지 로드
function loadGalleryImages(images) {
    const galleryContainer = document.getElementById('galleryImages');
    if (!galleryContainer) return;
    
    galleryContainer.innerHTML = images.map((imageUrl, index) => `
        <div class="gallery-item-editor">
            <img src="${imageUrl}" alt="갤러리 이미지 ${index + 1}">
            <div class="gallery-item-controls">
                <input type="url" value="${imageUrl}" onchange="updateGalleryImage(${index}, this.value)">
                <button class="btn-small btn-delete" onclick="removeGalleryImage(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// 갤러리 이미지 추가
function addGalleryImage() {
    const imageUrl = prompt('이미지 URL을 입력하세요:');
    if (imageUrl) {
        const currentContent = getCurrentContentData();
        if (!currentContent.galleryImages) {
            currentContent.galleryImages = [];
        }
        currentContent.galleryImages.push(imageUrl);
        loadGalleryImages(currentContent.galleryImages);
        showNotification('갤러리 이미지가 추가되었습니다.', 'success');
    }
}

// 갤러리 이미지 업데이트
function updateGalleryImage(index, newUrl) {
    const currentContent = getCurrentContentData();
    if (currentContent.galleryImages && currentContent.galleryImages[index]) {
        currentContent.galleryImages[index] = newUrl;
        showNotification('갤러리 이미지가 업데이트되었습니다.', 'success');
    }
}

// 갤러리 이미지 제거
function removeGalleryImage(index) {
    if (confirm('이 이미지를 삭제하시겠습니까?')) {
        const currentContent = getCurrentContentData();
        if (currentContent.galleryImages) {
            currentContent.galleryImages.splice(index, 1);
            loadGalleryImages(currentContent.galleryImages);
            showNotification('갤러리 이미지가 삭제되었습니다.', 'success');
        }
    }
}

// 현재 폼 데이터 가져오기
function getCurrentContentData() {
    const formData = {};
    
    // 일반 입력 필드들
    const fieldIds = [
        'heroImage', 'eventTitle', 'eventSubtitle', 'eventDate', 'eventLocation',
        'greetingContent', 'greetingSignature', 'eventDetailTime', 'eventDetailLocation',
        'eventTarget', 'eventFee', 'locationAddress', 'subwayInfo', 'busInfo', 
        'parkingInfo', 'contactPhone', 'contactEmail', 'donationMessage', 
        'bankName', 'accountNumber', 'accountHolder'
    ];
    
    fieldIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            formData[id] = element.value;
        }
    });
    
    // 갤러리 이미지들
    const galleryContainer = document.getElementById('galleryImages');
    if (galleryContainer) {
        const imageInputs = galleryContainer.querySelectorAll('input[type="url"]');
        formData.galleryImages = Array.from(imageInputs).map(input => input.value);
    }
    
    return formData;
}

// 모든 컨텐츠 저장
async function saveAllContent() {
    try {
        const contentData = getCurrentContentData();
        
        // 항상 localStorage에 저장 (백업용)
        localStorage.setItem('contentData', JSON.stringify(contentData));
        
        // Supabase 저장 시도 (실패해도 계속 진행)
        let supabaseSaved = false;
        if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
            try {
                await window.supabaseConfig.saveContentData(contentData);
                supabaseSaved = true;
                console.log('Supabase 저장 성공');
            } catch (supabaseError) {
                console.warn('Supabase 저장 실패, localStorage로 백업됨:', supabaseError);
            }
        }
        
        // 성공 메시지
        if (supabaseSaved) {
            showNotification('모든 컨텐츠가 저장되었습니다. (데이터베이스)', 'success');
        } else {
            showNotification('모든 컨텐츠가 로컬에 저장되었습니다. (오프라인 모드)', 'info');
        }
        
        // index.html 페이지도 업데이트
        updateIndexPageContent(contentData);
        
    } catch (error) {
        console.error('컨텐츠 저장 실패:', error);
        showNotification('컨텐츠 저장 중 오류가 발생했습니다.', 'error');
    }
}

// index.html 페이지 컨텐츠 업데이트 (postMessage 사용)
function updateIndexPageContent(contentData) {
    try {
        // 만약 같은 도메인의 index.html이 열려있다면 postMessage로 업데이트 알림
        if (window.opener) {
            window.opener.postMessage({
                type: 'contentUpdate',
                data: contentData
            }, '*');
        }
        
        // localStorage에 업데이트 플래그 설정
        localStorage.setItem('contentUpdated', 'true');
        
    } catch (error) {
        console.error('페이지 업데이트 알림 실패:', error);
    }
}

// 모든 컨텐츠 초기화
function resetAllContent() {
    if (confirm('모든 컨텐츠를 초기값으로 되돌리시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        if (typeof window.supabaseConfig !== 'undefined' && window.supabaseConfig.isConnected()) {
            // DB에서 컨텐츠 삭제
            window.supabaseConfig.resetContentData();
        }
        
        // 로컬 스토리지에서 컨텐츠 삭제
        localStorage.removeItem('contentData');
        
        // 페이지 새로고침하여 기본값 로드
        loadContentData();
        showNotification('모든 컨텐츠가 초기화되었습니다.', 'info');
    }
}

// 이미지 업로드 (실제로는 파일 선택 다이얼로그)
function uploadImage(fieldId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            // 실제로는 서버에 업로드해야 하지만, 데모용으로 ObjectURL 사용
            const imageUrl = URL.createObjectURL(file);
            
            const fieldElement = document.getElementById(fieldId);
            if (fieldElement) {
                fieldElement.value = imageUrl;
                showNotification('이미지가 업로드되었습니다. (데모용 - 임시 URL)', 'success');
            }
        }
    };
    
    input.click();
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