import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import styles from '../styles/Home.module.css';

interface PersonData {
  성명: string;
  교회: string;
  '나이/학년/직책': string;
  '학생 여부': string;
}

export default function Home() {
  const [bigNametagFiles, setBigNametagFiles] = useState<File[]>([]);
  const [smallNametagFiles, setSmallNametagFiles] = useState<File[]>([]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [useArrangedLayout, setUseArrangedLayout] = useState(false);
  const [studentWidthMm, setStudentWidthMm] = useState(85);
  const [nonStudentWidthMm, setNonStudentWidthMm] = useState(100);
  const [showInstructions, setShowInstructions] = useState(false);

  const onBigNametagDrop = useCallback((acceptedFiles: File[]) => {
    setBigNametagFiles((prev: File[]) => [...prev, ...acceptedFiles]);
    setErrorMessage(null); // Clear any previous errors
  }, []);

  const onSmallNametagDrop = useCallback((acceptedFiles: File[]) => {
    setSmallNametagFiles((prev: File[]) => [...prev, ...acceptedFiles]);
    setErrorMessage(null); // Clear any previous errors
  }, []);

  const onExcelDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setExcelFile(acceptedFiles[0]);
      setErrorMessage(null); // Clear any previous errors
    }
  }, []);

  const bigNametagDropzone = useDropzone({
    onDrop: onBigNametagDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp']
    }
  });

  const smallNametagDropzone = useDropzone({
    onDrop: onSmallNametagDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp']
    }
  });

  const excelDropzone = useDropzone({
    onDrop: onExcelDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    }
  });

  const removeBigNametagFile = (index: number) => {
    setBigNametagFiles((prev: File[]) => prev.filter((_: File, i: number) => i !== index));
  };

  const removeSmallNametagFile = (index: number) => {
    setSmallNametagFiles((prev: File[]) => prev.filter((_: File, i: number) => i !== index));
  };

  const validatePersonData = (data: PersonData[], rowIndex: number): string | null => {
    const person = data[rowIndex];
    const actualRowNumber = rowIndex + 2; // +2 because Excel rows start from 1 and we have header row
    
    // Check required fields (all except 교회)
    if (!person.성명 || person.성명.trim() === '') {
      return `${actualRowNumber}번째 줄: 성명이 비어있습니다.`;
    }
    
    if (!person['나이/학년/직책'] || person['나이/학년/직책'].trim() === '') {
      return `${actualRowNumber}번째 줄: 나이/학년/직책이 비어있습니다.`;
    }
    
    if (!person['학생 여부'] || person['학생 여부'].trim() === '') {
      return `${actualRowNumber}번째 줄: 학생 여부가 비어있습니다.`;
    }
    
    return null;
  };

  const parseExcelFile = async (file: File): Promise<PersonData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as PersonData[];
          
          // Validate data
          const validationErrors: string[] = [];
          jsonData.forEach((person, index) => {
            const error = validatePersonData(jsonData, index);
            if (error) {
              validationErrors.push(error);
            }
          });
          
          if (validationErrors.length > 0) {
            reject(new Error(`Excel 파일에 오류가 있습니다:\n${validationErrors.join('\n')}`));
            return;
          }
          
          // Clean up the data - handle empty church field
          const cleanedData = jsonData.map(person => ({
            ...person,
            교회: person.교회 || '', // Convert undefined/null to empty string
            성명: person.성명.trim(),
            '나이/학년/직책': person['나이/학년/직책'].trim(),
            '학생 여부': person['학생 여부'].trim()
          }));
          
          resolve(cleanedData);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsBinaryString(file);
    });
  };

  const generateNametags = async () => {
    if (!excelFile || (bigNametagFiles.length === 0 && smallNametagFiles.length === 0)) {
      setErrorMessage('엑셀 파일과 이름표 이미지를 모두 업로드해주세요.');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setProgressText('엑셀 파일 분석 중...');
    setErrorMessage(null);

    let progressInterval: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      const personData = await parseExcelFile(excelFile);
      setProgress(20);
      setProgressText('파일 업로드 준비 중...');

      // Convert files to base64
      const convertFileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };

      const bigNametagData = await Promise.all(
        bigNametagFiles.map(async (file: File) => ({
          name: file.name,
          data: await convertFileToBase64(file)
        }))
      );

      const smallNametagData = await Promise.all(
        smallNametagFiles.map(async (file: File) => ({
          name: file.name,
          data: await convertFileToBase64(file)
        }))
      );

      setProgress(40);
      setProgressText('서버로 데이터 전송 중...');

      setProgressText(`이름표 생성 중... (${personData.length}명)`);

      // Create a more realistic progress simulation
      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 85) {
            return prev + 3; // Faster progress up to 85%
          } else if (prev < 92) {
            return prev + 1; // Slower progress from 85% to 92%
          } else if (prev < 95) {
            return prev + 0.5; // Very slow progress from 92% to 95%
          }
          return prev; // Stop at 95%
        });
      }, 300);

      // Add timeout handling
      timeoutId = setTimeout(() => {
        if (progressInterval) clearInterval(progressInterval);
        setProgress(96);
        setProgressText('서버 처리 중... 잠시만 기다려주세요.');
      }, 10000); // 10 seconds timeout

      const response = await fetch('/api/generate-nametags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personData,
          bigNametagFiles: bigNametagData,
          smallNametagFiles: smallNametagData,
          useArrangedLayout,
          studentWidthMm,
          nonStudentWidthMm,
        }),
      });

      if (timeoutId) clearTimeout(timeoutId);
      if (progressInterval) clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error('Failed to generate nametags');
      }

      setProgress(97);
      setProgressText('ZIP 파일 생성 중...');

      const blob = await response.blob();
      
      setProgress(100);
      setProgressText('다운로드 준비 완료!');
      
      saveAs(blob, 'LFC_교육_선교_이름표.zip');
      
      // Reset progress after a short delay
      setTimeout(() => {
        setProgress(0);
        setProgressText('');
      }, 1500);
      
    } catch (error) {
      console.error('Error generating nametags:', error);
      // Clean up timers on error
      if (timeoutId) clearTimeout(timeoutId);
      if (progressInterval) clearInterval(progressInterval);
      
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('이름표 생성 중 오류가 발생했습니다.');
      }
      setProgress(0);
      setProgressText('');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>LFC 교육 선교 이름표 생성기</h1>
      
      <div className={styles.instructionSection}>
        <button 
          className={styles.instructionToggle}
          onClick={() => setShowInstructions(!showInstructions)}
        >
          {showInstructions ? '▼' : '▶'} 사용법 및 파일 형식 안내
        </button>
        
        {showInstructions && (
          <div className={styles.instructionContent}>
            <div className={styles.instructionBox}>
              <h3>📋 엑셀 파일 형식</h3>
              <p>엑셀 파일은 다음과 같은 4개의 열을 포함해야 합니다:</p>
              <div className={styles.excelFormat}>
                <div className={styles.excelHeader}>
                  <span>성명</span>
                  <span>교회</span>
                  <span>나이/학년/직책</span>
                  <span>학생 여부</span>
                </div>
                <div className={styles.excelRow}>
                  <span>김철수</span>
                  <span>사랑의 교회</span>
                  <span>중2</span>
                  <span>T</span>
                </div>
                <div className={styles.excelRow}>
                  <span>박영희</span>
                  <span>광림 교회</span>
                  <span>선생님</span>
                  <span>F</span>
                </div>
              </div>
              <ul className={styles.formatNotes}>
                <li><strong>성명</strong>: 이름표에 표시될 이름 (필수)</li>
                <li><strong>교회</strong>: 교회명 (비어있어도 됨)</li>
                <li><strong>나이/학년/직책</strong>: 추가 정보 (필수), 예시: 6세, 5학년, 중3, 선생님, 전도사님, 목사님 등</li>
                <li><strong>학생 여부</strong>: T = 학생 (작은 이름표), F = 일반 (큰 이름표)</li>
              </ul>
            </div>
            
            <div className={styles.instructionBox}>
              <h3>🖼️ 이미지 파일 업로드</h3>
              <ul>
                <li><strong>큰 이름표</strong>: 교사용 배경 이미지 (PNG, JPG 등)</li>
                <li><strong>작은 이름표</strong>: 학생용 배경 이미지 (PNG, JPG 등)</li>
                <li>여러 개의 이미지를 업로드하면 랜덤으로 선택됩니다</li>
                <li>각 이미지의 원본 비율이 유지됩니다</li>
              </ul>
            </div>
            
            <div className={styles.instructionBox}>
              <h3>📄 A4 배치 옵션</h3>
              <ul>
                <li>체크박스를 선택하면 개별 파일 대신 A4 용지에 배치된 이미지를 생성합니다</li>
                <li>학생용과 일반용 이름표 크기를 각각 설정할 수 있습니다</li>
                <li>자동으로 회전하여 최적의 배치로 종이 낭비를 최소화합니다</li>
                <li>학생용 이름표는 10개의 여분 빈 이름표가 자동으로 추가됩니다</li>
                <li>절삭선과 참조 격자가 포함되어 쉽게 잘라낼 수 있습니다</li>
              </ul>
            </div>
            
            <div className={styles.instructionBox}>
              <h3>🚀 사용 방법</h3>
              <ol>
                <li>엑셀 파일을 위 형식에 맞게 준비합니다</li>
                <li>큰 이름표와 작은 이름표 배경 이미지를 업로드합니다</li>
                <li>엑셀 파일을 업로드합니다</li>
                <li>필요시 A4 배치 옵션을 설정합니다</li>
                <li>"이름표 생성하기" 버튼을 클릭합니다</li>
                <li>생성된 ZIP 파일을 다운로드합니다</li>
              </ol>
            </div>
          </div>
        )}
      </div>
      
      <div className={styles.uploadSection}>
        <div className={styles.uploadBox}>
          <h2>큰 이름표</h2>
          <div 
            {...bigNametagDropzone.getRootProps()} 
            className={`${styles.dropzone} ${bigNametagDropzone.isDragActive ? styles.active : ''}`}
          >
            <input {...bigNametagDropzone.getInputProps()} />
            <p>
              {bigNametagDropzone.isDragActive
                ? "파일을 여기에 놓으세요..."
                : "큰 이름표 이미지를 드래그하거나 클릭하여 업로드하세요"}
            </p>
          </div>
          <div className={styles.fileList}>
            {bigNametagFiles.map((file, index) => (
              <div key={index} className={styles.fileItem}>
                <span>{file.name}</span>
                <button onClick={() => removeBigNametagFile(index)}>삭제</button>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.uploadBox}>
          <h2>작은 이름표</h2>
          <div 
            {...smallNametagDropzone.getRootProps()} 
            className={`${styles.dropzone} ${smallNametagDropzone.isDragActive ? styles.active : ''}`}
          >
            <input {...smallNametagDropzone.getInputProps()} />
            <p>
              {smallNametagDropzone.isDragActive
                ? "파일을 여기에 놓으세요..."
                : "작은 이름표 이미지를 드래그하거나 클릭하여 업로드하세요"}
            </p>
          </div>
          <div className={styles.fileList}>
            {smallNametagFiles.map((file, index) => (
              <div key={index} className={styles.fileItem}>
                <span>{file.name}</span>
                <button onClick={() => removeSmallNametagFile(index)}>삭제</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.excelSection}>
        <h2>엑셀 파일</h2>
        <div 
          {...excelDropzone.getRootProps()} 
          className={`${styles.dropzone} ${excelDropzone.isDragActive ? styles.active : ''}`}
        >
          <input {...excelDropzone.getInputProps()} />
          <p>
            {excelDropzone.isDragActive
              ? "파일을 여기에 놓으세요..."
              : "엑셀 파일을 드래그하거나 클릭하여 업로드하세요"}
          </p>
        </div>
        {excelFile && (
          <div className={styles.fileItem}>
            <span>{excelFile.name}</span>
            <button onClick={() => setExcelFile(null)}>삭제</button>
          </div>
        )}
      </div>

      <div className={styles.arrangeSection}>
        <h2>이름표 배치 옵션</h2>
        <div className={styles.arrangeControls}>
          <div className={styles.toggleContainer}>
            <label className={styles.toggleLabel}>
              <input 
                type="checkbox" 
                checked={useArrangedLayout}
                onChange={(e) => setUseArrangedLayout(e.target.checked)}
              />
              A4 용지에 배치하여 출력 (개별 파일 생성 안함)
            </label>
          </div>
          {useArrangedLayout && (
            <div className={styles.widthInputContainer}>
              <div className={styles.widthInputRow}>
                <label>
                  학생 이름표 너비 (mm):
                  <input 
                    type="number"
                    value={studentWidthMm}
                    onChange={(e) => setStudentWidthMm(Number(e.target.value))}
                    min="50"
                    max="150"
                    className={styles.widthInput}
                  />
                </label>
                <label>
                  일반 이름표 너비 (mm):
                  <input 
                    type="number"
                    value={nonStudentWidthMm}
                    onChange={(e) => setNonStudentWidthMm(Number(e.target.value))}
                    min="50"
                    max="150"
                    className={styles.widthInput}
                  />
                </label>
              </div>
              <div className={styles.hint}>
                권장: 학생용 85mm, 교사사용 100mm
              </div>
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className={styles.errorMessage}>
          <div className={styles.errorIcon}>⚠️</div>
          <div className={styles.errorText}>
            {errorMessage.split('\n').map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
          <button 
            className={styles.errorClose}
            onClick={() => setErrorMessage(null)}
          >
            ×
          </button>
        </div>
      )}

      {isGenerating && (
        <div className={styles.progressSection}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className={styles.progressText}>{progressText}</div>
          <div className={styles.progressPercentage}>{progress}%</div>
        </div>
      )}

      <button 
        className={styles.generateButton}
        onClick={generateNametags}
        disabled={isGenerating}
      >
        {isGenerating ? '생성 중...' : '이름표 생성하기'}
      </button>
    </div>
  );
} 