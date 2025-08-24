-- Supabase 데이터베이스 스키마
-- 초청장 웹앱용 테이블 생성

-- 1. 행사(Events) 테이블
CREATE TABLE IF NOT EXISTS events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    description TEXT,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    location VARCHAR(500) NOT NULL,
    address VARCHAR(500) NOT NULL,
    max_attendees INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    host_name VARCHAR(100),
    host_email VARCHAR(255),
    host_phone VARCHAR(20)
);

-- 2. RSVP 응답 테이블
CREATE TABLE IF NOT EXISTS rsvp_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    response VARCHAR(20) NOT NULL CHECK (response IN ('yes', 'no', 'maybe')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- 3. 방명록(Guestbook) 테이블
CREATE TABLE IF NOT EXISTS guestbook_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    email VARCHAR(255),
    is_approved BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- 4. 갤러리 이미지 테이블
CREATE TABLE IF NOT EXISTS gallery_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    image_url VARCHAR(1000) NOT NULL,
    image_name VARCHAR(255),
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. QR 코드 테이블
CREATE TABLE IF NOT EXISTS qr_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    rsvp_id UUID REFERENCES rsvp_responses(id) ON DELETE CASCADE,
    qr_data TEXT NOT NULL,
    qr_image_url VARCHAR(1000),
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 이벤트 통계 뷰
CREATE OR REPLACE VIEW event_statistics AS
SELECT 
    e.id as event_id,
    e.title,
    e.event_date,
    COUNT(DISTINCT r.id) as total_responses,
    COUNT(DISTINCT CASE WHEN r.response = 'yes' THEN r.id END) as yes_responses,
    COUNT(DISTINCT CASE WHEN r.response = 'no' THEN r.id END) as no_responses,
    COUNT(DISTINCT CASE WHEN r.response = 'maybe' THEN r.id END) as maybe_responses,
    COUNT(DISTINCT g.id) as total_guestbook_messages,
    COUNT(DISTINCT gi.id) as total_gallery_images
FROM events e
LEFT JOIN rsvp_responses r ON e.id = r.event_id
LEFT JOIN guestbook_messages g ON e.id = g.event_id
LEFT JOIN gallery_images gi ON e.id = gi.event_id
GROUP BY e.id, e.title, e.event_date;

-- Row Level Security (RLS) 설정
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE guestbook_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 권한 정책 (인증 없이도 읽기 가능)
CREATE POLICY "Public read access for events" ON events
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read access for rsvp_responses" ON rsvp_responses
    FOR SELECT USING (true);

CREATE POLICY "Public read access for guestbook_messages" ON guestbook_messages
    FOR SELECT USING (is_approved = true);

CREATE POLICY "Public read access for gallery_images" ON gallery_images
    FOR SELECT USING (is_active = true);

-- 공개 삽입 권한 정책 (인증 없이도 작성 가능)
CREATE POLICY "Public insert access for rsvp_responses" ON rsvp_responses
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public insert access for guestbook_messages" ON guestbook_messages
    FOR INSERT WITH CHECK (true);

-- 기본 이벤트 데이터 삽입
INSERT INTO events (
    title, 
    subtitle, 
    description, 
    event_date, 
    location, 
    address,
    host_name,
    host_email,
    host_phone
) VALUES (
    '2024 비즈니스 혁신 컨퍼런스',
    '미래를 준비하는 리더들의 만남',
    '급변하는 비즈니스 환경에서 혁신적인 사고와 전략이 그 어느 때보다 중요한 시점입니다. 이번 컨퍼런스에서는 업계 최고의 전문가들과 함께 미래 비즈니스 트렌드를 살펴보고, 실무에 바로 적용할 수 있는 인사이트를 공유하고자 합니다.',
    '2024-12-15 14:00:00+09',
    '서울 강남구 컨벤션센터 대강당 (3층)',
    '서울특별시 강남구 테헤란로 123',
    '컨퍼런스주최자',
    'info@conference.com',
    '02-1234-5678'
) ON CONFLICT DO NOTHING;

-- 트리거 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rsvp_responses_updated_at BEFORE UPDATE ON rsvp_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();