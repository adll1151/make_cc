import { EditorLayout } from '@/features/editor';

export const metadata = {
  title: '편집기 — make_cc',
  description: '영상을 보면서 한국어 자막을 편집하세요.',
};

export default async function EditorPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <EditorLayout jobId={jobId} />;
}
