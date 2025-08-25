// 컨텐츠 동기화 테스트 스크립트
// 브라우저 콘솔에서 실행하여 admin -> user 페이지 동기화 테스트

function testContentSync() {
    console.log('=== 컨텐츠 동기화 테스트 시작 ===');
    
    // 1. 테스트 데이터 생성
    const testContent = {
        eventTitle: '테스트 이벤트 제목 ' + new Date().toLocaleTimeString(),
        eventSubtitle: '테스트 부제목',
        heroImage: 'https://picsum.photos/400/300?random=' + Math.floor(Math.random() * 1000),
        eventDate: '2024년 12월 31일 (화) 오후 3시',
        eventLocation: '테스트 장소',
        greetingContent: '테스트 인사말입니다.\n\n현재 시간: ' + new Date().toLocaleString(),
        contactPhone: '010-1234-5678',
        contactEmail: 'test@example.com',
        galleryImages: [
            'https://picsum.photos/300/200?random=' + Math.floor(Math.random() * 1000),
            'https://picsum.photos/300/200?random=' + Math.floor(Math.random() * 1000)
        ]
    };
    
    console.log('테스트 데이터:', testContent);
    
    // 2. localStorage에 저장
    localStorage.setItem('contentData', JSON.stringify(testContent));
    console.log('✅ localStorage에 저장 완료');
    
    // 3. 업데이트 플래그 설정
    localStorage.setItem('contentUpdated', 'true');
    console.log('✅ 업데이트 플래그 설정');
    
    // 4. user.js의 loadDynamicContent() 강제 실행 (있는 경우)
    if (typeof loadDynamicContent === 'function') {
        console.log('📝 loadDynamicContent() 실행');
        loadDynamicContent();
    } else {
        console.warn('⚠️ loadDynamicContent() 함수를 찾을 수 없음');
    }
    
    // 5. 결과 확인
    setTimeout(() => {
        console.log('=== 5초 후 결과 확인 ===');
        
        // 제목 확인
        const titleEl = document.querySelector('.event-title');
        if (titleEl && titleEl.textContent === testContent.eventTitle) {
            console.log('✅ 제목 업데이트 성공:', titleEl.textContent);
        } else {
            console.error('❌ 제목 업데이트 실패. 현재값:', titleEl ? titleEl.textContent : 'null');
        }
        
        // 이미지 확인
        const heroImg = document.querySelector('.hero-image img');
        if (heroImg && heroImg.src === testContent.heroImage) {
            console.log('✅ 히어로 이미지 업데이트 성공:', heroImg.src);
        } else {
            console.error('❌ 히어로 이미지 업데이트 실패. 현재값:', heroImg ? heroImg.src : 'null');
        }
        
        console.log('=== 테스트 완료 ===');
    }, 5000);
}

function checkContentData() {
    console.log('=== 현재 컨텐츠 데이터 확인 ===');
    
    const stored = localStorage.getItem('contentData');
    if (stored) {
        const data = JSON.parse(stored);
        console.log('localStorage 데이터:', data);
    } else {
        console.log('localStorage에 contentData 없음');
    }
    
    const updateFlag = localStorage.getItem('contentUpdated');
    console.log('업데이트 플래그:', updateFlag);
    
    // DOM 요소들 확인
    const elements = {
        title: document.querySelector('.event-title'),
        subtitle: document.querySelector('.event-subtitle'),
        heroImage: document.querySelector('.hero-image img'),
        date: document.querySelector('.event-date span'),
        location: document.querySelector('.event-location span')
    };
    
    console.log('DOM 요소들:', elements);
    
    Object.keys(elements).forEach(key => {
        const el = elements[key];
        if (el) {
            console.log(`${key}:`, el.tagName === 'IMG' ? el.src : el.textContent);
        } else {
            console.warn(`${key} 요소를 찾을 수 없음`);
        }
    });
}

function forceContentReload() {
    console.log('=== 강제 컨텐츠 리로드 ===');
    
    if (typeof loadDynamicContent === 'function') {
        loadDynamicContent();
        console.log('✅ loadDynamicContent() 실행됨');
    } else {
        console.error('❌ loadDynamicContent() 함수를 찾을 수 없음');
        
        // user.js가 로드되지 않았을 가능성 체크
        console.log('스크립트 태그들:', Array.from(document.querySelectorAll('script')).map(s => s.src));
    }
}

// 자동 실행을 위한 함수들을 전역에 등록
window.testContentSync = testContentSync;
window.checkContentData = checkContentData;
window.forceContentReload = forceContentReload;

console.log('🚀 컨텐츠 동기화 테스트 도구가 로드되었습니다.');
console.log('사용 가능한 함수들:');
console.log('- testContentSync(): 전체 동기화 테스트');
console.log('- checkContentData(): 현재 데이터 상태 확인');
console.log('- forceContentReload(): 강제 컨텐츠 리로드');