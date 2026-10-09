import Link from 'next/link';
import BrandMark from './BrandMark';
import styles from './PublicInfoPage.module.css';

export function SupportContact() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return <p>{email ? <>문의: <a href={`mailto:${email}`}>{email}</a></> : '문의는 Google 로그인 화면의 앱 정보에 표시되는 지원 이메일로 보내 주세요.'}</p>;
}

export default function PublicInfoPage({ title, children }) {
  return <div className={styles.page}><header><Link href="/" className={styles.brand}><BrandMark size={34} /><span>G배움로그</span></Link><Link href="/">홈으로</Link></header><main><h1>{title}</h1>{children}</main><footer><Link href="/privacy">개인정보처리방침</Link><Link href="/terms">이용 안내</Link><span>made by 초록덕후</span></footer></div>;
}
