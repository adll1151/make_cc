import type { Metadata } from 'next';
import Link from 'next/link';
import { PageBackground } from '@/components/PageBackground';
import { getPlanLimits } from '@/services/auth';

export const metadata: Metadata = {
  title: '이용약관 — make_cc',
  description:
    'make_cc 한국어 영상 자막 자동 생성 서비스의 이용 조건, 이용자의 의무, 업로드 콘텐츠 권리, 데이터 보관, 책임 제한에 관한 약관입니다.',
};

const UPDATED = '2026년 10월 6일';
const CONTACT_EMAIL = 'shong7500@gmail.com';

export default function TermsPage() {
  const l = getPlanLimits();

  return (
    <main className="relative min-h-screen overflow-hidden">
      <PageBackground />
      <div className="grain-overlay" aria-hidden />

      <article className="mx-auto max-w-3xl px-6 py-24">
        <Link href="/" className="text-sm text-muted-foreground transition hover:text-foreground">
          ← make_cc 홈으로
        </Link>

        <h1 className="text-display mt-6 text-4xl sm:text-5xl">
          <span className="text-gradient">이용약관</span>
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">최종 업데이트: {UPDATED}</p>

        <p className="mt-8 leading-relaxed text-muted-foreground">
          본 약관은 make_cc(이하 &ldquo;서비스&rdquo;)가 제공하는 한국어 영상 자막 자동 생성·편집·번역·번인
          기능의 이용 조건을 정합니다. 서비스를 이용하면 본 약관에 동의한 것으로 봅니다.
        </p>

        <Section title="1. 서비스 내용">
          <ul className="list-disc space-y-2 pl-5">
            <li>업로드한 영상의 한국어 음성을 인식해 자막(SRT)을 자동으로 생성합니다.</li>
            <li>
              브라우저 편집, 음악·웃음 등 소리 자막(리치 CC), 자막 번역(영·일·중), 자막이 입혀진 번인
              영상(MP4), 섬네일 추천 기능을 제공합니다.
            </li>
            <li>
              자동 인식·번역 결과는 오류가 있을 수 있으며, 게시 전 이용자가 직접 확인하는 것을
              전제로 합니다.
            </li>
          </ul>
        </Section>

        <Section title="2. 이용 자격과 계정">
          <ul className="list-disc space-y-2 pl-5">
            <li>게스트는 회원가입 없이 이용할 수 있으며, 브라우저 쿠키로 작업을 구분합니다.</li>
            <li>
              회원은 이메일 매직 링크 또는 외부 로그인(OAuth)으로 가입합니다. 계정 관리 책임은
              이용자에게 있습니다.
            </li>
          </ul>
        </Section>

        <Section title="3. 플랜과 이용 한도">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              게스트: 영상 {l.guest.duration} · {l.guest.size}까지. 무료 회원: 영상 {l.member.duration} ·{' '}
              {l.member.size}까지.
            </li>
            <li>
              무료 플랜의 번역은 영상당 {l.free.translateLangsPerJob}개 언어, 번인 영상은{' '}
              {l.free.burnInResolution}p·워터마크 포함으로 제공됩니다.
            </li>
            <li>
              서비스 안정성을 위해 하루 전체 게스트 처리량에 상한을 둘 수 있으며, 한도는 사전
              안내 후 변경될 수 있습니다. 최신 내용은{' '}
              <Link href="/pricing" className="text-primary underline underline-offset-2">
                요금제
              </Link>
              에서 확인할 수 있습니다.
            </li>
            <li>유료(Pro) 플랜은 준비 중이며, 출시 시 요금과 조건을 별도로 안내합니다.</li>
          </ul>
        </Section>

        <Section title="4. 업로드 콘텐츠와 권리">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              업로드한 영상과 생성된 자막의 권리는 이용자에게 있습니다. 서비스는 자막 생성·제공에
              필요한 범위에서만 이를 처리합니다.
            </li>
            <li>
              <strong className="text-foreground">업로드한 영상·음성은 AI 학습에 사용하지 않습니다.</strong>
            </li>
            <li>
              이용자는 업로드할 권리가 있는 콘텐츠만 올려야 하며, 타인의 저작권·초상권·개인정보를
              침해하는 콘텐츠로 생긴 책임은 이용자에게 있습니다.
            </li>
          </ul>
        </Section>

        <Section title="5. 보관과 삭제">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              원본 영상은 처리 완료 후 게스트 {l.guest.retention}, 회원 {l.member.retention}이 지나면
              자동 삭제됩니다.
            </li>
            <li>
              회원의 자막은 다운로드를 위해 보관되며, 내 이력에서 작업을 직접 삭제할 수 있습니다.
              계정 삭제는 아래 문의처로 요청해 주세요. 필요한 파일은 직접 내려받아 보관해 주세요.
            </li>
            <li>
              자세한 개인정보 처리는{' '}
              <Link href="/privacy" className="text-primary underline underline-offset-2">
                개인정보처리방침
              </Link>
              을 따릅니다.
            </li>
          </ul>
        </Section>

        <Section title="6. 금지 행위">
          <ul className="list-disc space-y-2 pl-5">
            <li>불법 촬영물, 아동 대상 성적 콘텐츠 등 법령이 금지하는 콘텐츠의 업로드</li>
            <li>자동화 도구로 과도한 요청을 보내거나 이용 한도를 우회하는 행위</li>
            <li>서비스의 보안을 시험하거나 정상 운영을 방해하는 행위</li>
          </ul>
          <p className="mt-3">위반 시 사전 통지 없이 해당 작업을 삭제하거나 이용을 제한할 수 있습니다.</p>
        </Section>

        <Section title="7. 서비스 변경과 중단">
          서비스는 기능을 추가·변경하거나 점검·장애 등으로 일시 중단할 수 있습니다. 무료로 제공되는
          서비스 특성상, 중요한 변경은 사이트를 통해 미리 알리도록 노력합니다.
        </Section>

        <Section title="8. 책임의 제한">
          자동 생성된 자막·번역의 정확성을 보증하지 않으며, 이를 그대로 사용해 생긴 손해에 대해
          서비스는 고의 또는 중대한 과실이 없는 한 책임지지 않습니다. 중요한 원본은 이용자가 별도로
          보관해 주세요.
        </Section>

        <Section title="9. 약관 변경">
          약관을 변경할 때는 시행일과 변경 내용을 시행 7일 전부터 이 페이지에 게시합니다. 변경 후에도
          서비스를 계속 이용하면 변경된 약관에 동의한 것으로 봅니다.
        </Section>

        <Section title="10. 문의">
          약관에 관한 문의는{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
            {CONTACT_EMAIL}
          </a>
          로 보내 주세요.
        </Section>

        <div className="mt-12 border-t border-border/60 pt-8 text-sm text-muted-foreground">
          <Link href="/" className="transition hover:text-foreground">
            ← make_cc 홈으로 돌아가기
          </Link>
        </div>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
      <div className="mt-3 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
