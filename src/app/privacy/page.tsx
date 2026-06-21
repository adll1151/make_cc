import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '개인정보처리방침 — make_cc',
  description:
    'make_cc 서비스의 개인정보 수집·이용·보관·파기, 쿠키 및 Google AdSense 광고 쿠키 사용에 관한 안내입니다.',
};

const UPDATED = '2026년 6월 17일';
const CONTACT_EMAIL = 'shong7500@gmail.com';

export default function PrivacyPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 aurora" aria-hidden />
      <div className="grain-overlay" aria-hidden />

      <article className="mx-auto max-w-3xl px-6 py-24">
        <Link
          href="/"
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← make_cc 홈으로
        </Link>

        <h1 className="text-display mt-6 text-4xl sm:text-5xl">
          <span className="text-gradient">개인정보처리방침</span>
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">최종 업데이트: {UPDATED}</p>

        <p className="mt-8 leading-relaxed text-muted-foreground">
          make_cc(이하 &ldquo;서비스&rdquo;)는 이용자의 개인정보를 중요하게 생각하며, 관련 법령을
          준수합니다. 본 방침은 서비스가 어떤 정보를 수집·이용·보관·파기하는지, 그리고 광고 및
          쿠키를 어떻게 사용하는지 설명합니다.
        </p>

        <Section title="1. 수집하는 정보">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">계정 정보</strong>: 회원가입 시 이메일 주소(매직
              링크/OAuth). 비밀번호는 저장하지 않습니다.
            </li>
            <li>
              <strong className="text-foreground">업로드한 영상/오디오</strong>: 자막 생성을 위해
              일시적으로 처리됩니다. 학습에 사용되지 않습니다.
            </li>
            <li>
              <strong className="text-foreground">생성된 자막(SRT) 및 잡 기록</strong>: 미리보기·편집·다운로드·공유
              제공을 위해 저장됩니다.
            </li>
            <li>
              <strong className="text-foreground">자동 수집 정보</strong>: 접속 로그, 브라우저/기기
              정보, 쿠키 등 서비스 운영·보안·통계 목적의 기술 정보.
            </li>
          </ul>
        </Section>

        <Section title="2. 이용 목적">
          <ul className="list-disc space-y-2 pl-5">
            <li>음성 인식을 통한 자막 자동 생성 및 편집·공유 기능 제공</li>
            <li>회원 인증, 잡 상태 알림(이메일 등)</li>
            <li>서비스 품질 개선, 오류 분석, 보안 및 부정 이용 방지</li>
            <li>광고 게재 및 광고 성과 측정(아래 4항 참조)</li>
          </ul>
        </Section>

        <Section title="3. 보관 및 파기">
          <p className="leading-relaxed">
            업로드된 영상/오디오 원본은 자막 처리 완료 후 자동 삭제됩니다(게스트: 처리 후 약 1시간
            이내 — 번인 자막 영상 생성에 필요한 최소 기간만 보관, 회원: 보관 기간 경과 후). 생성된
            자막과 잡 기록은 이용자가 삭제하거나 계정을 탈퇴할 때까지
            보관되며, 요청 시 지체 없이 파기합니다. 법령상 보존 의무가 있는 정보는 해당 기간 동안
            보관합니다.
          </p>
        </Section>

        <Section title="4. 쿠키 및 광고 (Google AdSense)">
          <p className="leading-relaxed">
            본 서비스는 로그인 세션 유지, 게스트 식별, 이용 통계를 위해 쿠키를 사용합니다. 또한
            무료 이용자에게 광고를 게재하기 위해 <strong className="text-foreground">Google
            AdSense</strong>를 사용합니다.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5">
            <li>
              Google을 포함한 제3자 광고 사업자는 쿠키를 사용하여 이용자의 본 사이트 및 다른
              사이트 방문 기록을 바탕으로 맞춤 광고를 게재할 수 있습니다.
            </li>
            <li>
              Google은 광고 쿠키(예: DoubleClick 쿠키)를 사용해 인터넷상의 방문 기록에 기반한
              광고를 제공합니다.
            </li>
            <li>
              이용자는{' '}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Google 광고 설정
              </a>
              에서 맞춤 광고를 비활성화할 수 있으며,{' '}
              <a
                href="https://www.aboutads.info/choices/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                www.aboutads.info
              </a>
              에서 제3자 사업자의 광고 쿠키를 일괄 비활성화할 수 있습니다.
            </li>
            <li>
              브라우저 설정에서 쿠키를 차단하거나 삭제할 수 있습니다. 다만 일부 기능이 제한될 수
              있습니다.
            </li>
          </ul>
          <p className="mt-4 leading-relaxed">
            유럽경제지역(EEA)·영국·스위스 이용자에게는 Google 인증 동의 관리 플랫폼(CMP)을 통해
            광고 쿠키 사용에 대한 동의를 받습니다. Google의 데이터 사용에 관한 자세한 내용은{' '}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Google 파트너 사이트 정책
            </a>
            을 참고하세요.
          </p>
        </Section>

        <Section title="5. 제3자 제공 및 처리 위탁">
          <p className="leading-relaxed">
            서비스는 운영을 위해 다음의 외부 서비스를 이용하며, 목적 달성에 필요한 범위 내에서만
            정보가 처리됩니다: 인증·데이터베이스·스토리지(Supabase), 호스팅(Vercel), 광고(Google
            AdSense), 이메일 알림(Resend). 법령에 근거하거나 이용자 동의가 있는 경우를 제외하고
            개인정보를 제3자에게 판매하지 않습니다.
          </p>
        </Section>

        <Section title="6. 이용자의 권리">
          <p className="leading-relaxed">
            이용자는 언제든지 자신의 개인정보 열람·정정·삭제·처리정지를 요청할 수 있으며, 계정
            설정에서 데이터를 삭제하거나 탈퇴할 수 있습니다. 요청은 아래 연락처로 보내주세요.
          </p>
        </Section>

        <Section title="7. 문의처">
          <p className="leading-relaxed">
            개인정보 관련 문의는{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline underline-offset-2"
            >
              {CONTACT_EMAIL}
            </a>
            로 연락해 주세요.
          </p>
        </Section>

        <p className="mt-12 text-sm text-muted-foreground">
          본 방침은 관련 법령 또는 서비스 변경에 따라 개정될 수 있으며, 변경 시 본 페이지를 통해
          공지합니다.
        </p>

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
