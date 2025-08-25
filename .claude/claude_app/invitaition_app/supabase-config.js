// Supabase 설정 파일
// 환경 변수나 설정에서 실제 값들을 가져와야 합니다

class SupabaseConfig {
    constructor() {
        // 실제 프로덕션에서는 환경 변수에서 가져와야 합니다
        this.supabaseUrl = 'https://mmtxkvxkuwmbpfzatzll.supabase.co'; // 예: https://xxxxx.supabase.co
        this.supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tdHhrdnhrdXdtYnBmemF0emxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4MzkxOTEsImV4cCI6MjA3MTQxNTE5MX0.7qAoKr33BmtXk0ackspuHUzEerr8eT39VW4yT5On8BY';
        
        // 현재 이벤트 ID (기본값, 실제로는 동적으로 설정)
        this.currentEventId = null;
        
        this.supabase = null;
        this.isInitialized = false;
    }

    // Supabase 초기화
    async initialize() {
        try {
            // Supabase 라이브러리 동적 로드
            if (typeof window !== 'undefined' && !window.supabase) {
                await this.loadSupabaseLibrary();
            }
            
            this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseAnonKey);
            this.isInitialized = true;
            
            // 기본 이벤트 ID 가져오기
            await this.loadCurrentEvent();
            
            console.log('Supabase 초기화 완료');
            return true;
        } catch (error) {
            console.error('Supabase 초기화 실패:', error);
            return false;
        }
    }

    // Supabase 라이브러리 동적 로드
    async loadSupabaseLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.5/dist/umd/supabase.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // 현재 활성 이벤트 로드
    async loadCurrentEvent() {
        if (!this.isInitialized) return null;

        try {
            const { data, error } = await this.supabase
                .from('events')
                .select('id, title')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0) {
                this.currentEventId = data[0].id;
                console.log('현재 이벤트 ID:', this.currentEventId);
                return data[0];
            }
            return null;
        } catch (error) {
            console.error('이벤트 로드 실패:', error);
            return null;
        }
    }

    // RSVP 응답 저장
    async saveRSVP(response, guestInfo = {}) {
        if (!this.isInitialized || !this.currentEventId) {
            throw new Error('Supabase가 초기화되지 않았거나 이벤트 ID가 없습니다.');
        }

        try {
            const rsvpData = {
                event_id: this.currentEventId,
                response: response,
                name: guestInfo.name || '',
                email: guestInfo.email || '',
                phone: guestInfo.phone || '',
                message: guestInfo.message || '',
                ip_address: await this.getClientIP(),
                user_agent: navigator.userAgent
            };

            const { data, error } = await this.supabase
                .from('rsvp_responses')
                .insert([rsvpData])
                .select();

            if (error) throw error;

            console.log('RSVP 저장 성공:', data);
            return data[0];
        } catch (error) {
            console.error('RSVP 저장 실패:', error);
            throw error;
        }
    }

    // 방명록 메시지 저장
    async saveGuestbookMessage(name, message, email = '') {
        if (!this.isInitialized || !this.currentEventId) {
            throw new Error('Supabase가 초기화되지 않았거나 이벤트 ID가 없습니다.');
        }

        try {
            const messageData = {
                event_id: this.currentEventId,
                name: name,
                message: message,
                email: email,
                ip_address: await this.getClientIP(),
                user_agent: navigator.userAgent
            };

            const { data, error } = await this.supabase
                .from('guestbook_messages')
                .insert([messageData])
                .select();

            if (error) throw error;

            console.log('방명록 저장 성공:', data);
            return data[0];
        } catch (error) {
            console.error('방명록 저장 실패:', error);
            throw error;
        }
    }

    // 방명록 메시지 로드
    async loadGuestbookMessages(limit = 50) {
        if (!this.isInitialized || !this.currentEventId) {
            return [];
        }

        try {
            const { data, error } = await this.supabase
                .from('guestbook_messages')
                .select('*')
                .eq('event_id', this.currentEventId)
                .eq('is_approved', true)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            console.log('방명록 로드 성공:', data);
            return data || [];
        } catch (error) {
            console.error('방명록 로드 실패:', error);
            return [];
        }
    }

    // RSVP 통계 조회
    async getRSVPStatistics() {
        if (!this.isInitialized || !this.currentEventId) {
            return null;
        }

        try {
            const { data, error } = await this.supabase
                .from('event_statistics')
                .select('*')
                .eq('event_id', this.currentEventId)
                .single();

            if (error) throw error;

            console.log('RSVP 통계:', data);
            return data;
        } catch (error) {
            console.error('RSVP 통계 조회 실패:', error);
            return null;
        }
    }

    // 실시간 방명록 구독
    subscribeToGuestbook(callback) {
        if (!this.isInitialized || !this.currentEventId) {
            return null;
        }

        const subscription = this.supabase
            .channel('guestbook_messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'guestbook_messages',
                filter: `event_id=eq.${this.currentEventId}`
            }, (payload) => {
                console.log('새 방명록 메시지:', payload.new);
                callback(payload.new);
            })
            .subscribe();

        return subscription;
    }

    // 실시간 RSVP 구독
    subscribeToRSVP(callback) {
        if (!this.isInitialized || !this.currentEventId) {
            return null;
        }

        const subscription = this.supabase
            .channel('rsvp_responses')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'rsvp_responses',
                filter: `event_id=eq.${this.currentEventId}`
            }, (payload) => {
                console.log('새 RSVP 응답:', payload.new);
                callback(payload.new);
            })
            .subscribe();

        return subscription;
    }

    // 클라이언트 IP 가져오기 (간단한 방법)
    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.error('IP 주소 가져오기 실패:', error);
            return null;
        }
    }

    // 이벤트 정보 조회
    async getEventInfo() {
        if (!this.isInitialized || !this.currentEventId) {
            return null;
        }

        try {
            const { data, error } = await this.supabase
                .from('events')
                .select('*')
                .eq('id', this.currentEventId)
                .single();

            if (error) throw error;

            console.log('이벤트 정보:', data);
            return data;
        } catch (error) {
            console.error('이벤트 정보 조회 실패:', error);
            return null;
        }
    }

    // 컨텐츠 데이터 저장
    async saveContentData(contentData) {
        if (!this.isInitialized) {
            throw new Error('Supabase가 초기화되지 않았습니다.');
        }

        try {
            // 이벤트 ID가 없으면 기본 이벤트 생성
            if (!this.currentEventId) {
                const defaultEvent = await this.createDefaultEvent();
                this.currentEventId = defaultEvent.id;
            }

            // 기존 컨텐츠 데이터 확인
            const { data: existing, error: selectError } = await this.supabase
                .from('event_content')
                .select('id')
                .eq('event_id', this.currentEventId)
                .maybeSingle(); // single() 대신 maybeSingle() 사용

            if (selectError) {
                console.warn('기존 컨텐츠 조회 실패, 새로 생성:', selectError);
            }

            const contentRecord = {
                event_id: this.currentEventId,
                content_data: contentData,
                updated_at: new Date().toISOString()
            };

            let result;
            if (existing && existing.id) {
                // 업데이트
                const { data, error } = await this.supabase
                    .from('event_content')
                    .update(contentRecord)
                    .eq('id', existing.id)
                    .select();

                if (error) throw error;
                result = data;
            } else {
                // 삽입
                const { data, error } = await this.supabase
                    .from('event_content')
                    .insert([contentRecord])
                    .select();

                if (error) throw error;
                result = data;
            }

            console.log('컨텐츠 데이터 저장 성공:', result);
            return result[0];
        } catch (error) {
            console.error('컨텐츠 데이터 저장 실패:', error);
            // 테이블이 없을 경우를 대비해 더 구체적인 오류 메시지 제공
            if (error.message && error.message.includes('404')) {
                throw new Error('데이터베이스 테이블이 설정되지 않았습니다. 로컬 저장소를 사용합니다.');
            }
            throw error;
        }
    }

    // 기본 이벤트 생성
    async createDefaultEvent() {
        if (!this.isInitialized) {
            throw new Error('Supabase가 초기화되지 않았습니다.');
        }

        try {
            const { data, error } = await this.supabase
                .from('events')
                .insert([{
                    title: '기본 컨퍼런스 이벤트',
                    is_active: true
                }])
                .select()
                .single();

            if (error) throw error;

            console.log('기본 이벤트 생성:', data);
            return data;
        } catch (error) {
            console.error('기본 이벤트 생성 실패:', error);
            throw error;
        }
    }

    // 컨텐츠 데이터 조회
    async getContentData() {
        if (!this.isInitialized) {
            return {};
        }

        try {
            // 이벤트 ID가 없으면 빈 객체 반환
            if (!this.currentEventId) {
                console.log('이벤트 ID가 없어 빈 컨텐츠 반환');
                return {};
            }

            const { data, error } = await this.supabase
                .from('event_content')
                .select('content_data')
                .eq('event_id', this.currentEventId)
                .maybeSingle(); // single() 대신 maybeSingle() 사용

            if (error) {
                console.warn('컨텐츠 데이터 조회 실패:', error);
                return {};
            }

            if (!data) {
                console.log('저장된 컨텐츠 데이터가 없음');
                return {};
            }

            console.log('컨텐츠 데이터 조회 성공:', data);
            return data.content_data || {};
        } catch (error) {
            console.error('컨텐츠 데이터 조회 실패:', error);
            return {};
        }
    }

    // 컨텐츠 데이터 초기화
    async resetContentData() {
        if (!this.isInitialized || !this.currentEventId) {
            throw new Error('Supabase가 초기화되지 않았거나 이벤트 ID가 없습니다.');
        }

        try {
            const { error } = await this.supabase
                .from('event_content')
                .delete()
                .eq('event_id', this.currentEventId);

            if (error) throw error;

            console.log('컨텐츠 데이터 초기화 완료');
            return true;
        } catch (error) {
            console.error('컨텐츠 데이터 초기화 실패:', error);
            throw error;
        }
    }

    // 갤러리 이미지 업로드
    async uploadGalleryImage(file, fileName) {
        if (!this.isInitialized) {
            throw new Error('Supabase가 초기화되지 않았습니다.');
        }

        try {
            const fileExt = fileName.split('.').pop();
            const filePath = `gallery/${this.currentEventId}/${Date.now()}.${fileExt}`;

            const { data, error } = await this.supabase.storage
                .from('event-images')
                .upload(filePath, file);

            if (error) throw error;

            // 공개 URL 생성
            const { data: urlData } = this.supabase.storage
                .from('event-images')
                .getPublicUrl(filePath);

            console.log('이미지 업로드 성공:', urlData.publicUrl);
            return urlData.publicUrl;
        } catch (error) {
            console.error('이미지 업로드 실패:', error);
            throw error;
        }
    }

    // 이벤트별 업로드된 이미지 목록 조회
    async getGalleryImages() {
        if (!this.isInitialized || !this.currentEventId) {
            return [];
        }

        try {
            const { data, error } = await this.supabase.storage
                .from('event-images')
                .list(`gallery/${this.currentEventId}`, {
                    limit: 100,
                    sortBy: { column: 'created_at', order: 'desc' }
                });

            if (error) throw error;

            // 공개 URL로 변환
            const imageUrls = data.map(file => {
                const { data: urlData } = this.supabase.storage
                    .from('event-images')
                    .getPublicUrl(`gallery/${this.currentEventId}/${file.name}`);
                return urlData.publicUrl;
            });

            console.log('갤러리 이미지 목록:', imageUrls);
            return imageUrls;
        } catch (error) {
            console.error('갤러리 이미지 목록 조회 실패:', error);
            return [];
        }
    }

    // 연결 상태 확인
    isConnected() {
        return this.isInitialized && this.supabase !== null;
    }

    // 환경 설정 업데이트 (실제 키 값 설정용)
    updateConfig(url, key) {
        this.supabaseUrl = url;
        this.supabaseAnonKey = key;
        this.isInitialized = false;
    }
}

// 전역 인스턴스 생성
window.supabaseConfig = new SupabaseConfig();

// 설정 도우미 함수들
window.supabaseHelpers = {
    // 실제 Supabase 설정 적용
    setupSupabase: async function(url, anonKey) {
        window.supabaseConfig.updateConfig(url, anonKey);
        const success = await window.supabaseConfig.initialize();
        if (success) {
            console.log('✅ Supabase 연결 성공!');
            // 기존 localStorage 데이터를 DB로 마이그레이션
            await this.migrateLocalStorageData();
        } else {
            console.error('❌ Supabase 연결 실패');
        }
        return success;
    },

    // localStorage 데이터를 DB로 마이그레이션
    migrateLocalStorageData: async function() {
        try {
            // 기존 방명록 데이터 마이그레이션
            const guestbookData = JSON.parse(localStorage.getItem('guestbookData') || '[]');
            for (const message of guestbookData) {
                try {
                    await window.supabaseConfig.saveGuestbookMessage(
                        message.name, 
                        message.message
                    );
                } catch (error) {
                    console.warn('방명록 마이그레이션 실패:', error);
                }
            }

            // 기존 RSVP 데이터 마이그레이션
            const rsvpResponse = localStorage.getItem('rsvpResponse');
            if (rsvpResponse) {
                try {
                    await window.supabaseConfig.saveRSVP(rsvpResponse);
                } catch (error) {
                    console.warn('RSVP 마이그레이션 실패:', error);
                }
            }

            console.log('✅ 로컬 데이터 마이그레이션 완료');
        } catch (error) {
            console.error('마이그레이션 실패:', error);
        }
    },

    // 개발용 테스트 데이터 생성
    createTestData: async function() {
        if (!window.supabaseConfig.isConnected()) {
            console.error('Supabase가 연결되지 않았습니다.');
            return;
        }

        try {
            // 테스트 방명록 메시지
            await window.supabaseConfig.saveGuestbookMessage(
                '테스트 사용자', 
                '이것은 테스트 메시지입니다!'
            );

            // 테스트 RSVP
            await window.supabaseConfig.saveRSVP('yes', {
                name: '김테스트',
                email: 'test@example.com',
                message: '참석하겠습니다!'
            });

            console.log('✅ 테스트 데이터 생성 완료');
        } catch (error) {
            console.error('테스트 데이터 생성 실패:', error);
        }
    }
};