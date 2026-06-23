/**
 * 마케팅(공개) 영역 레이아웃.
 * 테마(라이트/다크)는 <html>의 theme-light/theme-dark 클래스로 전역 관리되며
 * ThemeToggle로 전환된다(기본=라이트). 여기선 별도 스코프하지 않는다.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
