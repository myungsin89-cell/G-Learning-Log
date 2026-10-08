'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  initGoogleSDKs, 
  signInTeacher, 
  signOutTeacher,
  fetchClassRosters,
  saveClassRoster,
  deleteClassRoster,
  getGoogleConfig,
  saveGoogleConfig
} from '@/lib/googleApi';
import MadeByStamp from '@/components/MadeByStamp';
import EntryScreen from '@/components/EntryScreen';
import ClassSelection, { ClassSelectionHeader } from '@/components/ClassSelection';
import classStyles from '@/components/ClassSelection.module.css';

export default function Home() {
  const router = useRouter();
  
  // SDK & Auth States
  const [sdkStatus, setSdkStatus] = useState('loading'); // 'loading', 'ready', 'config_missing', 'error'
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Manual Google API Config Modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [inputClientId, setInputClientId] = useState('');
  const [inputApiKey, setInputApiKey] = useState('');
  
  // Class Rosters List
  const [rosterList, setRosterList] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Class Delete Modal state
  const [classToDelete, setClassToDelete] = useState(null);
  const [isDeletingClass, setIsDeletingClass] = useState(false);

  // New Class Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [studentListInput, setStudentListInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadMethod, setUploadMethod] = useState('text'); // 'text' or 'csv'

  // Custom Alert Modal state
  const [alertConfig, setAlertConfig] = useState(null); // { isOpen, title, message, type }
  const showAlert = (message, title = '알림', type = 'info') => {
    setAlertConfig({ isOpen: true, title, message, type });
  };
  const closeAlert = () => setAlertConfig(null);

  // Load teacher's existing classroom rosters
  const loadClassrooms = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const rosters = await fetchClassRosters();
      setRosterList(rosters);
    } catch (err) {
      console.error('Failed to load class rosters:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const tryInitializeSDKs = useCallback(() => {
    initGoogleSDKs(
      (token) => {
        setSdkStatus('ready');
        if (token) {
          setIsAuthenticated(true);
          loadClassrooms();
        }
      },
      (err) => {
        if (err === 'config_missing') {
          setSdkStatus('config_missing');
        } else {
          setSdkStatus('error');
          console.error(err);
        }
      }
    );
  }, [loadClassrooms]);

  // Initialize SDKs on mount using .env variables
  useEffect(() => {
    tryInitializeSDKs();
  }, [tryInitializeSDKs]);

  // Handle Login
  const handleLogin = async () => {
    try {
      const token = await signInTeacher();
      if (token) {
        setIsAuthenticated(true);
        loadClassrooms();
      }
    } catch (err) {
      showAlert(`구글 로그인에 실패했습니다: ${err.message || err}`, '로그인 오류', 'error');
    }
  };

  // Handle Logout
  const handleLogout = () => {
    signOutTeacher();
    setIsAuthenticated(false);
    setRosterList([]);
  };

  // Helper to parse student lists (supports linebreaks, numbers, spacing, or number-only inputs for privacy)
  const parseStudents = (text) => {
    return text.split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, idx) => {
        // Case A: "1 홍길동" or "1. 홍길동" or "1번 홍길동"
        const matchWithText = line.match(/^(\d+)[\s.번]*\s+(.+)$/);
        if (matchWithText) {
          return { number: parseInt(matchWithText[1]), name: matchWithText[2].trim() };
        }
        // Case B: Number only like "1" or "1번"
        const matchNumOnly = line.match(/^(\d+)[\s.번]*$/);
        if (matchNumOnly) {
          const num = parseInt(matchNumOnly[1]);
          return { number: num, name: `${num}번 학생` };
        }
        // Case C: Name only without number
        return { number: idx + 1, name: line };
      });
  };

  // CSV File Uploader with EUC-KR Korean Encoding Guard
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      
      const parsed = [];
      lines.forEach((line, idx) => {
        const cols = line.split(',').map(c => c.replace(/^["']|["']$/g, '').trim());
        if (cols.length >= 2) {
          if (idx === 0 && isNaN(cols[0])) return;
          parsed.push(`${cols[0]} ${cols[1]}`);
        }
      });

      if (parsed.length > 0) {
        setStudentListInput(parsed.join('\n'));
        showAlert(`CSV 파일에서 ${parsed.length}명의 학생 명단을 가져왔습니다!`, '가져오기 완료', 'success');
        setUploadMethod('text');
      } else {
        showAlert('올바른 CSV 형식이 아닙니다. 번호,이름 형식의 쉼표 구분 파일인지 확인해 주세요.', '형식 확인', 'warning');
      }
    };
    reader.readAsText(file, 'EUC-KR');
  };

  // Generate and trigger download of a sample CSV file
  const downloadCSVTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF번호,이름\n1,홍길동\n2,김철수\n3,이영희";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "G배움로그_명단양식.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle saving new classroom roster to Google Spreadsheet DB
  const handleCreateClass = async (e) => {
    e.preventDefault();

    if (!newClassName.trim()) return showAlert('학급 이름을 입력해 주세요.', '입력 확인', 'warning');
    if (!studentListInput.trim()) return showAlert('학생 명단을 입력해 주세요.', '입력 확인', 'warning');

    setIsSaving(true);
    try {
      const parsedStudents = parseStudents(studentListInput);
      await saveClassRoster(newClassName.trim(), parsedStudents);
      
      showAlert(`'${newClassName}' 학급 명단이 구글 드라이브에 저장되었습니다!`, '생성 완료', 'success');
      setNewClassName('');
      setStudentListInput('');
      setShowCreateModal(false);
      await loadClassrooms();
    } catch (err) {
      console.error(err);
      showAlert(`학급 생성에 실패했습니다: ${getErrorMessage(err)}`, '생성 오류', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle deleting class roster from Google Spreadsheet DB
  const handleConfirmDeleteClass = async () => {
    if (!classToDelete) return;
    setIsDeletingClass(true);
    try {
      await deleteClassRoster(classToDelete);
      setClassToDelete(null);
      await loadClassrooms();
      showAlert('학급이 성공적으로 삭제되었습니다.', '삭제 완료', 'success');
    } catch (err) {
      console.error('Failed to delete class:', err);
      showAlert(`학급 삭제에 실패했습니다: ${getErrorMessage(err)}`, '삭제 오류', 'error');
    } finally {
      setIsDeletingClass(false);
    }
  };

  // Helper to extract detailed Google API error message
  const getErrorMessage = (err) => {
    if (!err) return '알 수 없는 오류가 발생했습니다.';
    if (typeof err === 'string') return err;
    if (err.result && err.result.error && err.result.error.message) {
      return err.result.error.message;
    }
    if (err.message) return err.message;
    try {
      return JSON.stringify(err);
    } catch (e) {
      return String(err);
    }
  };

  if (sdkStatus === 'loading') {
    return <EntryScreen loading />;
  }

  if (sdkStatus === 'ready' && !isAuthenticated) {
    return <EntryScreen onLogin={handleLogin} />;
  }
  return (
    <div className={classStyles.page}>
      <ClassSelectionHeader onLogout={handleLogout} />

      <main className={classStyles.main}>
        
        {sdkStatus === 'config_missing' && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', maxWidth: '520px', margin: '3rem auto', borderColor: '#fca5a5', backgroundColor: '#fff5f5' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#fee2e2', color: '#b91c1c', marginBottom: '1.25rem' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2 style={{ fontWeight: 800, fontSize: '1.4rem', color: '#b91c1c', margin: '0 0 0.5rem 0' }}>API 자격 증명이 필요합니다</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: '1.5', margin: '0 0 1.5rem 0' }}>
              Vercel 환경 변수가 로드되지 않았거나 설정되지 않았습니다.<br />
              아래 버튼을 눌러 구글 Client ID와 API Key를 직접 입력하시면 즉시 구동됩니다.
            </p>
            <button 
              type="button"
              className="btn-primary"
              style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem', fontWeight: 800 }}
              onClick={() => {
                const conf = getGoogleConfig();
                setInputClientId(conf.clientId || '');
                setInputApiKey(conf.apiKey || '');
                setShowConfigModal(true);
              }}
            >
              🔑 구글 API 자격 증명 직접 등록하기
            </button>
          </div>
        )}

        {sdkStatus === 'ready' && isAuthenticated && (
          <ClassSelection
            classNames={rosterList}
            loading={isLoadingList}
            onCreate={() => setShowCreateModal(true)}
            onSelect={(className) => router.push(`/class/${encodeURIComponent(className)}`)}
            onDelete={setClassToDelete}
          />
        )}

        <MadeByStamp />
      </main>

      {/* ➕ Create Class Modal */}
      {showCreateModal && (
        <div className="custom-modal-backdrop" onClick={() => !isSaving && setShowCreateModal(false)}>
          <div className="custom-modal-content" style={{ maxWidth: '550px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="16" cy="30" rx="6.5" ry="9.5" transform="rotate(-15 16 30)" fill="#4285F4"/>
                <circle cx="10" cy="16.5" r="2" fill="#4285F4"/>
                <circle cx="14" cy="14.5" r="2.2" fill="#34A853"/>
                <circle cx="18.5" cy="15" r="2" fill="#34A853"/>
                <circle cx="22.5" cy="17" r="1.8" fill="#34A853"/>
                <ellipse cx="32" cy="20" rx="6.5" ry="9.5" transform="rotate(15 32 20)" fill="#EA4335"/>
                <circle cx="26" cy="6.5" r="2" fill="#FBBC05"/>
                <circle cx="30.5" cy="4.5" r="2.2" fill="#FBBC05"/>
                <circle cx="35" cy="5" r="2" fill="#EA4335"/>
                <circle cx="39" cy="7" r="1.8" fill="#EA4335"/>
              </svg>
              새 학급 등록
            </div>
            
            <form onSubmit={handleCreateClass}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="horizontal-form-row">
                  <label className="horizontal-form-label">학급 이름</label>
                  <input 
                    type="text" 
                    className="horizontal-form-input" 
                    placeholder="예: 6학년 1반"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    required
                  />
                </div>

                {/* Upload method selector tabs */}
                <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-card)', paddingBottom: '0.25rem' }}>
                  <button 
                    type="button" 
                    className="text-card-btn"
                    style={{ 
                      fontSize: '0.85rem', 
                      padding: '0.35rem 0.75rem', 
                      backgroundColor: uploadMethod === 'text' ? 'var(--brand-green-dark)' : 'transparent',
                      color: uploadMethod === 'text' ? 'white' : 'var(--brand-green-dark)'
                    }}
                    onClick={() => setUploadMethod('text')}
                  >
                    직접 쓰기 (복사 붙여넣기)
                  </button>
                  <button 
                    type="button" 
                    className="text-card-btn"
                    style={{ 
                      fontSize: '0.85rem', 
                      padding: '0.35rem 0.75rem', 
                      backgroundColor: uploadMethod === 'csv' ? 'var(--brand-green-dark)' : 'transparent',
                      color: uploadMethod === 'csv' ? 'white' : 'var(--brand-green-dark)'
                    }}
                    onClick={() => setUploadMethod('csv')}
                  >
                    엑셀(CSV) 업로드
                  </button>
                </div>

                {uploadMethod === 'text' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontWeight: 700, fontSize: '0.85rem' }}>학생 명단</label>
                      <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 700 }}>
                        💡 개인정보 보호: 번호만 입력해도 OK
                      </span>
                    </div>
                    <textarea 
                      className="horizontal-form-input" 
                      rows={6}
                      placeholder="한 줄에 '번호 이름' 또는 '번호만' 적어주세요.&#10;&#10;[예시 1 - 이름 포함]&#10;1 홍길동&#10;2 김철수&#10;&#10;[예시 2 - 개인정보 보호: 번호만]&#10;1&#10;2&#10;3"
                      value={studentListInput}
                      onChange={(e) => setStudentListInput(e.target.value)}
                      style={{ resize: 'vertical' }}
                      required
                    />
                  </div>
                ) : (
                  <div style={{ padding: '1.25rem', border: '1px dashed var(--border-card)', borderRadius: '8px', textAlign: 'center', backgroundColor: '#fdfdfd' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      엑셀에서 번호(A열), 이름(B열)로 입력하신 후 <strong>&apos;CSV(쉼표로 분리)&apos;</strong> 형식으로 저장하여 업로드하세요.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <input 
                        type="file" 
                        id="csv-file-input" 
                        accept=".csv" 
                        style={{ display: 'none' }} 
                        onChange={handleCSVUpload}
                      />
                      <label 
                        htmlFor="csv-file-input" 
                        className="btn-primary" 
                        style={{ cursor: 'pointer', fontSize: '0.9rem', padding: '0.5rem 1.25rem' }}
                      >
                        CSV 파일 선택
                      </label>
                      <button 
                        type="button" 
                        className="text-card-btn" 
                        style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}
                        onClick={downloadCSVTemplate}
                      >
                        양식 다운로드
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                <button 
                  type="button" 
                  className="text-card-btn" 
                  style={{ background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }}
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSaving}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Distribution Progress Loader */}
      {isSaving && (
        <div className="custom-modal-backdrop">
          <div className="custom-modal-content" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', maxWidth: '400px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', color: 'var(--brand-green-dark)', animation: 'spin 1s linear infinite', marginBottom: '1.25rem' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
              </svg>
            </div>
            <h3 style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.5rem' }}>학급 데이터 등록 중...</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              선생님 구글 드라이브의 명단 시트 파일에 탭을 생성하고 학생 정보를 기입하고 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* Delete Class Confirmation Modal */}
      {classToDelete && (
        <div className="custom-modal-backdrop" onClick={() => !isDeletingClass && setClassToDelete(null)}>
          <div className="custom-modal-content" style={{ maxWidth: '440px', padding: '2rem 1.75rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#fee2e2', color: '#dc2626', marginBottom: '1rem' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#b91c1c', margin: '0 0 0.5rem 0' }}>
              학급을 삭제하시겠습니까?
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.5', margin: '0 0 1.5rem 0' }}>
              <strong>[{classToDelete}]</strong> 학급과 등록된 학생 명단 정보가 구글 드라이브에서 제거됩니다.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button 
                type="button" 
                className="text-card-btn" 
                style={{ flex: 1, justifyContent: 'center', background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }}
                onClick={() => setClassToDelete(null)}
                disabled={isDeletingClass}
              >
                취소
              </button>
              <button 
                type="button" 
                className="btn-primary"
                style={{ flex: 1, justifyContent: 'center', backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                onClick={handleConfirmDeleteClass}
                disabled={isDeletingClass}
              >
                {isDeletingClass ? '삭제 중...' : '학급 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Custom Alert Modal */}
      {alertConfig && alertConfig.isOpen && (
        <div className="custom-modal-backdrop" onClick={closeAlert}>
          <div 
            className="custom-modal-content" 
            style={{ maxWidth: '420px', padding: '2rem 1.75rem', textAlign: 'center' }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', marginBottom: '1rem', backgroundColor: alertConfig.type === 'error' ? '#fee2e2' : (alertConfig.type === 'warning' ? '#fef3c7' : '#ecfdf5') }}>
              {alertConfig.type === 'success' && (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              )}
              {alertConfig.type === 'warning' && (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
              {alertConfig.type === 'error' && (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
              {alertConfig.type === 'info' && (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              )}
            </div>
            
            <h3 style={{ 
              fontSize: '1.2rem', 
              fontWeight: 900, 
              color: alertConfig.type === 'error' ? '#dc2626' : (alertConfig.type === 'warning' ? '#d97706' : 'var(--brand-green-dark)'), 
              margin: '0 0 0.5rem 0' 
            }}>
              {alertConfig.title || '알림'}
            </h3>

            <p style={{ fontSize: '0.92rem', color: '#475569', lineHeight: '1.55', margin: '0 0 1.5rem 0', whiteSpace: 'pre-wrap' }}>
              {alertConfig.message}
            </p>

            <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'center' }}>
              <button 
                type="button" 
                className="btn-primary"
                style={{ 
                  minWidth: '120px',
                  justifyContent: 'center',
                  backgroundColor: alertConfig.type === 'error' ? '#dc2626' : 'var(--brand-green-dark)'
                }}
                onClick={closeAlert}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Google API Config Modal */}
      {showConfigModal && (
        <div className="custom-modal-backdrop" onClick={() => setShowConfigModal(false)}>
          <div className="custom-modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              구글 API 자격 증명 직접 등록
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const cId = inputClientId.trim();
              const aKey = inputApiKey.trim();
              if (!cId || !aKey) {
                showAlert('Client ID와 API Key를 모두 입력해 주세요.', '입력 확인', 'warning');
                return;
              }
              saveGoogleConfig(cId, aKey);
              setShowConfigModal(false);
              showAlert('구글 API 자격 증명이 브라우저에 저장되었습니다! 연결을 시작합니다.', '저장 완료', 'success');
              setSdkStatus('loading');
              tryInitializeSDKs();
            }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: '0.85rem', color: '#475569', margin: 0, lineHeight: '1.45' }}>
                  입력하신 키는 이 브라우저의 로컬 스토리지에 안전하게 보관되며, 즉시 구글 로그인 모듈이 활성화됩니다.
                </p>
                <div>
                  <label className="horizontal-form-label" style={{ marginBottom: '0.35rem', display: 'block', fontWeight: 800 }}>
                    Google Client ID
                  </label>
                  <input 
                    type="text" 
                    className="horizontal-form-input" 
                    placeholder="예: 10835...apps.googleusercontent.com"
                    value={inputClientId}
                    onChange={(e) => setInputClientId(e.target.value)}
                    required
                    style={{ width: '100%', fontSize: '0.82rem', fontFamily: 'monospace' }}
                  />
                </div>
                <div>
                  <label className="horizontal-form-label" style={{ marginBottom: '0.35rem', display: 'block', fontWeight: 800 }}>
                    Google API Key
                  </label>
                  <input 
                    type="text" 
                    className="horizontal-form-input" 
                    placeholder="예: AIzaSyDB..."
                    value={inputApiKey}
                    onChange={(e) => setInputApiKey(e.target.value)}
                    required
                    style={{ width: '100%', fontSize: '0.82rem', fontFamily: 'monospace' }}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button 
                  type="button" 
                  className="text-card-btn" 
                  onClick={() => setShowConfigModal(false)}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                >
                  저장 및 연결하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
