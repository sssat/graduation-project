// frontend/src/components/inquiries/InquiryCreateModal.tsx

import { useRef, useState, type ChangeEvent } from "react";
import styles from "./InquiryCreateModal.module.css";

export type InquiryTypeKey = "bug" | "idea" | "data" | "account" | "etc";

export type InquiryCreateFormPayload = {
  typeKey: InquiryTypeKey;
  title: string;
  body: string;
  isPrivate: boolean;
};

type Props = {
  onClose: () => void;
  onSubmit: (payload: InquiryCreateFormPayload) => void | Promise<void>;
};

const TYPE_OPTIONS: Array<{ key: InquiryTypeKey; label: string }> = [
  { key: "bug", label: "오류 제보" },
  { key: "idea", label: "기능 제안" },
  { key: "data", label: "데이터 문의" },
  { key: "account", label: "계정/로그인" },
  { key: "etc", label: "기타" },
];

function parseInquiryTypeKey(value: string): InquiryTypeKey | "" {
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

type FieldErrors = {
  typeKey?: string;
  title?: string;
  body?: string;
  submit?: string;
};

function getErrorMessage(error: unknown, fallback = "문의 등록 중 오류가 발생했습니다.") {
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === "object" && error !== null) {
    const anyErr = error as {
      response?: { data?: { message?: string; details?: string } };
      message?: string;
    };
    const serverMessage = anyErr.response?.data?.message ?? anyErr.response?.data?.details;
    if (typeof serverMessage === "string" && serverMessage.trim()) return serverMessage.trim();
    if (typeof anyErr.message === "string" && anyErr.message.trim()) return anyErr.message.trim();
  }

  return fallback;
}

export default function InquiryCreateModal({ onClose, onSubmit }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const [typeKey, setTypeKey] = useState<InquiryTypeKey | "">("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isSubmitting) return;
    if (!dialogRef.current) return;
    if (!dialogRef.current.contains(e.target as Node)) onClose();
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    const titleTrim = title.trim();
    const bodyTrim = body.trim();

    if (!typeKey) next.typeKey = "문의 유형을 선택해주세요.";
    if (!titleTrim) next.title = "제목을 입력해주세요.";

    if (!bodyTrim) next.body = "문의 내용을 입력해주세요.";
    else if (bodyTrim.length < 50) next.body = "문의 내용은 최소 50자 이상 입력해주세요.";

    return next;
  };

  const onTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const next = parseInquiryTypeKey(e.target.value);
    setTypeKey(next);

    if (errors.typeKey || errors.submit) {
      setErrors((prev) => {
        const copied = { ...prev };
        if (next) delete copied.typeKey;
        delete copied.submit;
        return copied;
      });
    }
  };

  const onTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setTitle(v);

    if (errors.title || errors.submit) {
      const ok = v.trim().length > 0;
      setErrors((prev) => {
        const copied = { ...prev };
        if (ok) delete copied.title;
        delete copied.submit;
        return copied;
      });
    }
  };

  const onBodyChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setBody(v);

    if (errors.body || errors.submit) {
      const trim = v.trim();
      const ok = trim.length >= 50;
      setErrors((prev) => {
        const copied = { ...prev };
        if (ok) delete copied.body;
        delete copied.submit;
        return copied;
      });
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      await onSubmit({
        typeKey: typeKey as InquiryTypeKey,
        title: title.trim(),
        body: body.trim(),
        isPrivate,
      });
      onClose();
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        submit: getErrorMessage(error),
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onBackdropClick} aria-hidden={false}>
      <div ref={dialogRef} className={styles.modalDialog} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>새 문의 작성</div>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="닫기"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <p className={styles.modalDesc}>
          제목과 문의 내용을 작성해 주세요. 문의 내용은 최소 50자 이상 입력해 주세요.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>
                문의 유형<span className={styles.required}>*</span>
              </label>
              <select
                className={`${styles.textInput} ${errors.typeKey ? styles.inputError : ""}`}
                value={typeKey}
                onChange={onTypeChange}
                aria-invalid={Boolean(errors.typeKey)}
                aria-describedby={errors.typeKey ? "inquiry-type-error" : undefined}
                disabled={isSubmitting}
              >
                <option value="">문의 유형을 선택해주세요</option>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
              {errors.typeKey && (
                <div id="inquiry-type-error" className={styles.errorText} role="alert">
                  {errors.typeKey}
                </div>
              )}
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel}>
                제목<span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                className={`${styles.textInput} ${errors.title ? styles.inputError : ""}`}
                value={title}
                onChange={onTitleChange}
                placeholder="문의 제목을 간단히 입력해주세요"
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? "inquiry-title-error" : undefined}
                disabled={isSubmitting}
              />
              {errors.title && (
                <div id="inquiry-title-error" className={styles.errorText} role="alert">
                  {errors.title}
                </div>
              )}
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel}>
                문의 내용<span className={styles.required}>*</span>
              </label>
              <textarea
                className={`${styles.textareaInput} ${errors.body ? styles.inputError : ""}`}
                value={body}
                onChange={onBodyChange}
                placeholder="서비스 이용 중 궁금한 점, 오류 제보, 기능 제안 등을 자세히 작성해 주세요."
                aria-invalid={Boolean(errors.body)}
                aria-describedby={errors.body ? "inquiry-body-error" : undefined}
                disabled={isSubmitting}
              />
              {errors.body && (
                <div id="inquiry-body-error" className={styles.errorText} role="alert">
                  {errors.body}
                </div>
              )}
            </div>
          </div>

          <div className={styles.formFooter}>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                disabled={isSubmitting}
              />
              <span>이 문의를 비공개로 설정합니다.</span>
            </label>

            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? "등록 중..." : "문의 등록하기"}
            </button>
          </div>

          {errors.submit ? (
            <div className={styles.errorText} role="alert" style={{ marginTop: 12 }}>
              {errors.submit}
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
