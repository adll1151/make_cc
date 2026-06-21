import type { Metadata } from 'next';
import Link from 'next/link';
import { FloatingNav } from '@/components/ui/floating-nav';
import { AdSlot } from '@/components/ads/AdSlot';
import { AdsenseScript } from '@/components/ads/AdsenseScript';

export const metadata: Metadata = {
  title: '사용법 가이드 — make_cc 한국어 자막 자동 생성',
  description:
    '영상 업로드부터 자동 자막 생성, 브라우저 편집, 번인 자막 스튜디오, SRT 다운로드·공유까지 — make_cc 사용법을 단계별로 안내합니다.',
};

export default function GuidePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 aurora" aria-hidden />
      <div className="grain-overlay" aria-hidden />

      <FloatingNav />
      <AdsenseScript />

      <article className="mx-auto max-w-3xl px-6 pb-24 pt-32 sm:pt-40">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Guide</p>
        <h1 className="text-display mt-3 text-4xl sm:text-5xl">
          <span className="text-gradient">make_cc</span> 사용법
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          make_cc는 한국어 영상을 올리면 음성을 인식해 켜고 끌 수 있는 표준 자막(SRT)을 자동으로
          만들어 주는 도구입니다. 별도 프로그램 설치 없이 브라우저에서 업로드 · 미리보기 · 편집 ·
          다운로드 · 공유까지 끝낼 수 있어요. 처음이라면 아래 5단계만 따라오시면 됩니다.
        </p>

        <Step n="01" title="영상 업로드하기">
          <p>
            상단 메뉴의 <strong className="text-foreground">업로드</strong>를 눌러 영상을 선택하거나
            드래그&amp;드롭하세요. MP4, MOV, MKV, WebM 등 대부분의 영상 포맷과 음성 파일을 지원합니다.
            회원가입 없이 <strong className="text-foreground">게스트로도 무료 체험</strong>할 수 있고,
            로그인하면 처리 이력이 저장돼 나중에 다시 받을 수 있습니다.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>업로드 중 페이지를 떠나도 처리는 계속됩니다.</li>
            <li>음성이 또렷할수록 인식 정확도가 올라갑니다(배경음·잡음이 적을수록 유리).</li>
            <li>업로드한 원본 영상은 자막 생성이 끝나면 자동으로 삭제됩니다.</li>
          </ul>
        </Step>

        <Step n="02" title="자동 자막 생성 기다리기">
          <p>
            업로드가 끝나면 self-hosted <strong className="text-foreground">Whisper</strong>(large-v3,
            한국어) 엔진이 음성을 인식해 자막을 만듭니다. 진행 상태(대기 → 인식 중 → 완료)가 실시간으로
            표시되며, 5분 분량 영상은 평균 3분 안팎이면 완성됩니다. 회원은 처리가 끝나면 이메일 알림을
            받을 수 있어 화면을 지키고 있지 않아도 됩니다.
          </p>
        </Step>

        <Step n="03" title="미리보기 & 편집하기">
          <p>
            자막이 생성되면 브라우저 편집기에서 영상 위에 자막을 얹어 바로 확인할 수 있습니다. 오타나
            띄어쓰기, 타이밍이 살짝 어긋난 부분은 <strong className="text-foreground">라인 단위로 직접
            수정</strong>하면 됩니다. 음성 인식은 완벽하지 않으므로, 고유명사·전문 용어가 많은 영상은
            이 단계에서 한 번 훑어보는 것을 권장합니다.
          </p>
        </Step>

        <Step n="04" title="번인 자막 스튜디오 (선택)">
          <p>
            SRT처럼 켜고 끄는 자막이 아니라 <strong className="text-foreground">영상에 직접 박힌
            자막(번인)</strong>이 필요하다면 — 쇼츠·릴스·틱톡처럼 자막이 항상 보여야 하는 경우 — 번인
            스튜디오를 사용하세요. 폰트·크기·색·외곽선·위치·박스 배경을 고르고, 화면 비율(원본 / 9:16 /
            1:1)과 해상도를 선택해 자막이 입혀진 새 영상(MP4)을 만들 수 있습니다.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>한글 전용 폰트(Pretendard · Noto Sans KR)를 내장해 글자 깨짐 없이 렌더됩니다.</li>
            <li>세로형(9:16)을 고르면 가로 영상도 중앙을 기준으로 꽉 차게 변환됩니다.</li>
            <li>무료 플랜은 워터마크 + 720p, Pro 플랜은 워터마크 제거 + 최대 1080p로 출력됩니다.</li>
          </ul>
        </Step>

        <Step n="05" title="다운로드 & 공유하기">
          <p>
            완성된 <strong className="text-foreground">SRT 자막 파일</strong>을 내려받아 유튜브·영상
            편집 프로그램에 그대로 올릴 수 있습니다. 번인 영상을 만들었다면 MP4로 바로 저장됩니다.
            회원은 공유 링크를 생성해 다른 사람이 로그인 없이 자막을 받아갈 수 있도록 할 수도 있어요.
          </p>
        </Step>

        <section className="mt-12">
          <AdSlot className="min-h-[120px]" note="스폰서 광고" />
        </section>

        <section className="mt-12 rounded-2xl border border-border/60 bg-card/30 p-6">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            자막 품질을 높이는 팁
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">또렷한 오디오</strong>: 마이크 가까이에서 녹음하고
              배경음악은 말소리보다 낮게. 잡음이 적을수록 인식률이 좋아집니다.
            </li>
            <li>
              <strong className="text-foreground">고유명사 확인</strong>: 사람 이름, 브랜드, 전문
              용어는 편집 단계에서 한 번 점검하세요.
            </li>
            <li>
              <strong className="text-foreground">짧게 끊어 말하기</strong>: 문장이 너무 길면 한 줄에
              담기 어렵습니다. 자연스러운 호흡 단위로 끊으면 자막 가독성이 좋아집니다.
            </li>
          </ul>
        </section>

        <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-border/60 pt-8 text-sm">
          <Link
            href="/upload"
            className="rounded-full bg-foreground px-5 py-2 font-semibold text-background transition hover:opacity-90"
          >
            지금 영상 올려보기 →
          </Link>
          <Link href="/faq" className="text-muted-foreground transition hover:text-foreground">
            자주 묻는 질문 보기
          </Link>
          <Link href="/" className="text-muted-foreground transition hover:text-foreground">
            홈으로
          </Link>
        </div>
      </article>
    </main>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="scroll-fade mt-12">
      <div className="flex items-baseline gap-3">
        <span className="text-display text-2xl text-aurora">{n}</span>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
      </div>
      <div className="mt-3 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
