import ClassSelection, { ClassSelectionHeader } from '@/components/ClassSelection';
import MadeByStamp from '@/components/MadeByStamp';
import styles from '@/components/ClassSelection.module.css';

export const metadata = {
  title: 'G배움로그 첫 학급 시안',
  description: '학급이 없을 때 보여주는 학급 선택 화면의 디자인 시안',
};

export default function EmptyClassSelectionPreview() {
  return (
    <div className={styles.page}>
      <ClassSelectionHeader preview />
      <main className={styles.main}>
        <ClassSelection preview />
        <p style={{ marginTop: 42, color: '#91a096', fontSize: 11, textAlign: 'center' }}>
          디자인 시안 · 학급이 없는 경우입니다.
        </p>
        <MadeByStamp />
      </main>
    </div>
  );
}
