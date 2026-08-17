import type { Metadata } from 'next';

/** セラピスト専用ログインは検索対象外 */
export const metadata: Metadata = {
  title: 'セラピスト専用ログイン',
  robots: { index: false, follow: false },
};

export default function TherapistAreaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
