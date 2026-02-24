// frontend/src/components/Auth/ChangePassword/ChangePWCard/ChangePasswordCard.tsx
import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import styles from "./ChangePasswordCard.module.css";
import { validatePassword } from "../../../../utils/signupValidators";

type Props = {
  cardWidth?: number | string;
  onSubmit?: (payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<void> | void;
};

type FieldErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  general?: string;
};

type Vars = CSSProperties & { ["--card-width"]?: string };

export default function ChangePasswordCard({ cardWidth = 420, onSubmit }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const vars: Vars = useMemo(
    () => ({
      ["--card-width"]: typeof cardWidth === "number" ? `${cardWidth}px` : String(cardWidth),
    }),
    [cardWidth]
  );

  const validate = () => {
    const e: FieldErrors = {};
    const cur = currentPassword.trim();
    const nw = newPassword.trim();
    const cf = confirmPassword.trim();

    if (!cur) e.currentPassword = "현재 비밀번호를 입력해주세요.";
    if (!nw) e.newPassword = "새 비밀번호를 입력해주세요.";
    if (!cf) e.confirmPassword = "새 비밀번호를 한 번 더 입력해주세요.";

    if (nw && cf) {
      const msg = validatePassword(nw, cf);
      if (msg) {
        if (msg.includes("확인") || msg.includes("일치")) e.confirmPassword = msg;
        else e.newPassword = msg;
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    setErrors({});

    if (!validate()) return;

    const payload = {
      currentPassword: currentPassword.trim(),
      newPassword: newPassword.trim(),
      confirmPassword: confirmPassword.trim(),
    };

    try {
      setLoading(true);

      if (onSubmit) {
        await onSubmit(payload);
        return;
      }

      // 목업 동작(백엔드 없음)
      await new Promise((r) => setTimeout(r, 600));

      // 목업 실패 규칙: 현재 비밀번호에 wrong 포함 시 실패 처리(화면 문구로는 노출하지 않음)
      if (payload.currentPassword.toLowerCase().includes("wrong")) {
        setErrors({ currentPassword: "현재 비밀번호가 올바르지 않습니다." });
        return;
      }

      alert("비밀번호가 변경되었습니다. 다시 로그인 해주세요.");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "비밀번호 변경에 실패했습니다.";
      setErrors({ general: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.section} aria-label="비밀번호 변경">
      <div className={styles.wrap} style={vars}>
        <div className={styles.card}>
          <h1 className={styles.title}>비밀번호 변경</h1>

          <form className={styles.form} onSubmit={submit} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="currentPassword">
                현재 비밀번호
              </label>
              <div className={styles.inputCol}>
                <input
                  id="currentPassword"
                  className={styles.input}
                  type="password"
                  placeholder="현재 비밀번호를 입력하세요"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, currentPassword: undefined, general: undefined }));
                  }}
                  autoComplete="current-password"
                  disabled={loading}
                />
                {errors.currentPassword ? <p className={styles.error}>{errors.currentPassword}</p> : null}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="newPassword">
                새 비밀번호
              </label>
              <div className={styles.inputCol}>
                <input
                  id="newPassword"
                  className={styles.input}
                  type="password"
                  placeholder="새 비밀번호를 입력하세요"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, newPassword: undefined, general: undefined }));
                  }}
                  autoComplete="new-password"
                  disabled={loading}
                />
                {errors.newPassword ? <p className={styles.error}>{errors.newPassword}</p> : null}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="confirmPassword">
                새 비밀번호 확인
              </label>
              <div className={styles.inputCol}>
                <input
                  id="confirmPassword"
                  className={styles.input}
                  type="password"
                  placeholder="새 비밀번호를 한 번 더 입력하세요"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, confirmPassword: undefined, general: undefined }));
                  }}
                  autoComplete="new-password"
                  disabled={loading}
                />
                {errors.confirmPassword ? <p className={styles.error}>{errors.confirmPassword}</p> : null}
              </div>
            </div>

            {errors.general ? (
              <div className={styles.generalError} role="alert">
                {errors.general}
              </div>
            ) : null}

            <button className={styles.submit} type="submit" disabled={loading}>
              {loading ? "처리 중…" : "확인"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
