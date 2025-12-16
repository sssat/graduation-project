// frontend/src/components/inquiries/InquiryCreateModal.tsx

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import styles from "./InquiryCreateModal.module.css";
import type { InquiryItem } from "../../mocks/inquiryMockData";

type Props = {
  onClose: () => void;
  onSubmit: (payload: {
    typeKey: InquiryItem["typeKey"];
    title: string;
    body: string;
    isPrivate: boolean;
  }) => void;
};

const TYPE_OPTIONS: Array<{ key: InquiryItem["typeKey"]; label: string }> = [
  { key: "bug", label: "오류 제보" },
  { key: "idea", label: "기능 제안" },
  { key: "data", label: "데이터 문의" },
  { key: "account", label: "계정/로그인" },
  { key: "etc", label: "기타" },
];

function parseInquiryTypeKey(value: string): InquiryItem["typeKey"] | "" {
  switch (value) {
    case "bug":
    case "idea":
    case "data":
    case "account":
    case "etc":
      return value;
    default:
      return "";
  }
}

export default function InquiryCreateModal({ onClose, onSubmit }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const [typeKey, setTypeKey] = useState<InquiryItem["typeKey"] | "">("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(typeKey) && title.trim().length > 0 && body.trim().length > 0;
  }, [typeKey, title, body]);

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dialogRef.current) return;
    if (!dialogRef.current.contains(e.target as Node)) onClose();
  };

  const onTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setTypeKey(parseInquiryTypeKey(e.target.value));
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      alert("문의 유형, 제목, 문의 내용을 입력해주세요.");
      return;
    }
    if (body.trim().length < 50) {
      const ok = window.confirm("문의 내용은 최소 50자 이상을 권장합니다. 그래도 등록할까요?");
      if (!ok) return;
    }

    onSubmit({
      typeKey: typeKey as InquiryItem["typeKey"],
      title: title.trim(),
      body: body.trim(),
      isPrivate,
    });
    onClose();
  };

  return (
    <div className={styles.modalBackdrop} onClick={onBackdropClick} aria-hidden={false}>
      <div ref={dialogRef} className={styles.modalDialog} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>새 문의 작성</div>
          <button type="button" className={styles.modalCloseBtn} onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <p className={styles.modalDesc}>
          제목과 문의 내용을 작성해 주세요. 문의 내용은 최소 50자 이상 입력하는 것을 권장합니다.
        </p>

        <form onSubmit={(e) => e.preventDefault()}>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>
                문의 유형<span className={styles.required}>*</span>
              </label>
              <select className={styles.textInput} value={typeKey} onChange={onTypeChange}>
                <option value="">문의 유형을 선택해주세요</option>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel}>
                제목<span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                className={styles.textInput}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="문의 제목을 간단히 입력해주세요"
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel}>
                문의 내용<span className={styles.required}>*</span>
              </label>
              <textarea
                className={styles.textareaInput}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="서비스 이용 중 궁금한 점, 오류 제보, 기능 제안 등을 자세히 작성해 주세요."
              />
            </div>
          </div>

          <div className={styles.formFooter}>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              <span>이 문의를 비공개로 설정합니다.</span>
            </label>

            <button type="button" className={styles.submitBtn} onClick={handleSubmit}>
              문의 등록하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
