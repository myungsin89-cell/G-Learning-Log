import ClassSelection, { ClassSelectionHeader } from '@/components/ClassSelection';
import MadeByStamp from '@/components/MadeByStamp';
import styles from '@/components/ClassSelection.module.css';

export const metadata = {
  title: 'G배움로그 학급 선택 시안',
  description: '로그인 후 학급 선택 화면의 디자인 시안',
};

export default function ClassSelectionPreview() {
  return (
    <div className={styles.page}>
      <ClassSelectionHeader preview />
      <main className={styles.main}>
        <ClassSelection classNames={['5학년 2반', '6학년 1반', '4학년 3반']} preview />
        <p style={{ marginTop: 42, color: '#91a096', fontSize: 11, textAlign: 'center' }}>
          디자인 시안 · 학급 이름은 예시입니다.
        </p>
        <MadeByStamp />
      </main>
    </div>
  );
}
