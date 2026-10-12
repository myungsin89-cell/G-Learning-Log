import Link from 'next/link';
import BrandMark from './BrandMark';
import styles from './PublicInfoPage.module.css';

export function SupportContact() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || 'myungsin89@gmail.com';
  return <p>문의·개인정보 요청: <a href={`mailto:${email}`}>{email}</a></p>;
}

export default function PublicInfoPage({ title, children }) {
  return <div className={styles.page}><header><Link href="/" className={styles.brand}><BrandMark size={34} /><span>G배움로그</span></Link><Link href="/">홈으로</Link></header><main><h1>{title}</h1>{children}</main><footer><Link href="/privacy">개인정보처리방침</Link><Link href="/terms">이용 안내</Link><span>made by 초록덕후</span></footer></div>;
}
