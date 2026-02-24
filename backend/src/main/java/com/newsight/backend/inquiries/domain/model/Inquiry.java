// backend/src/main/java/com/newsight/backend/inquiries/domain/model/Inquiry.java
package com.newsight.backend.inquiries.domain.model;

import com.newsight.backend.accounts.domain.model.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 문의글
 * - DB: T_INQUIRY
 *
 * 상태 규칙(명세서 기준):
 * - isProcessed=false -> PROCESSING
 * - isProcessed=true  -> DONE
 */
@Entity
@Table(
        name = "T_INQUIRY",
        indexes = {
                @Index(name = "IX_T_INQUIRY__SUBMITTED_AT", columnList = "SUBMITTED_AT"),
                @Index(name = "IX_T_INQUIRY__TYPE_CODE", columnList = "TYPE_CODE"),
                @Index(name = "IX_T_INQUIRY__IS_PROCESSED", columnList = "IS_PROCESSED"),
                @Index(name = "IX_T_INQUIRY__INQUIRER", columnList = "INQUIRER_SEQ"),
                @Index(name = "IX_T_INQUIRY__PROCESSED", columnList = "PROCESSED_SEQ")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "inquirySeq")
public class Inquiry {

    public enum Status {
        PROCESSING,
        DONE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "INQUIRY_SEQ", nullable = false)
    private Long inquirySeq;

    /**
     * 문의자 (필수)
     * - FK: FK_T_INQUIRY__INQUIRER (INQUIRER_SEQ -> T_USER.USER_SEQ)
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "INQUIRER_SEQ",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_T_INQUIRY__INQUIRER")
    )
    private User inquirer;

    /**
     * 처리자(관리자) (선택)
     * - FK: FK_T_INQUIRY__PROCESSED_BY (PROCESSED_SEQ -> T_USER.USER_SEQ)
     * - on delete set null
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "PROCESSED_SEQ",
            foreignKey = @ForeignKey(name = "FK_T_INQUIRY__PROCESSED_BY")
    )
    private User processedBy;

    /**
     * 문의 유형 (필수)
     * - FK: FK_T_INQUIRY__TYPE (TYPE_CODE -> T_INQUIRY_TYPE.TYPE_CODE)
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "TYPE_CODE",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_T_INQUIRY__TYPE")
    )
    private InquiryType type;

    @Column(name = "TITLE", length = 200, nullable = false)
    private String title;

    @Lob
    @Column(name = "MESSAGE", nullable = false)
    private String message;

    /**
     * 제출 시각
     * - DDL default CURRENT_TIMESTAMP 이지만, JPA insert 시 null 방지를 위해 @PrePersist 보정
     */
    @Column(name = "SUBMITTED_AT", nullable = false)
    private LocalDateTime submittedAt;

    /**
     * 처리 여부
     * - false: PROCESSING
     * - true : DONE
     */
    @Column(name = "IS_PROCESSED", nullable = false)
    private boolean isProcessed;

    /**
     * 비공개 여부
     * - 0: 공개, 1: 비공개(작성자+ADMIN만 열람)
     */
    @Column(name = "IS_PRIVATE", nullable = false)
    private boolean isPrivate;

    /**
     * 최초 답변 완료(또는 처리 완료) 시각
     */
    @Column(name = "PROCESSED_AT")
    private LocalDateTime processedAt;

    /**
     * 관리자 답변(원문)
     */
    @Lob
    @Column(name = "ADMIN_MESSAGE")
    private String adminMessage;

    /**
     * 관리자 답변 수정 시각(최초 답변 시에는 null 가능)
     */
    @Column(name = "ANSWER_UPDATED_AT")
    private LocalDateTime answerUpdatedAt;

    @PrePersist
    private void prePersist() {
        if (this.submittedAt == null) {
            this.submittedAt = LocalDateTime.now();
        }
        // boolean 필드는 기본값 false로 들어가므로 별도 처리 불필요
    }

    @Transient
    public Status getStatus() {
        return isProcessed ? Status.DONE : Status.PROCESSING;
    }

    /**
     * 관리자 답변 저장/수정 + 처리상태 변경을 엔티티 레벨에서 최소 규칙만 보장하고 싶을 때 사용.
     * (시간(now)은 서비스 계층에서 주입해서 호출)
     *
     * 명세서 규칙:
     * - PROCESSING -> DONE 전환 가능
     * - DONE 상태에서도 adminMessage 수정 가능, 수정 시 answerUpdatedAt 갱신
     * - 최초 DONE 전환 시 processedAt 기록(없으면 now)
     */
    public void writeOrUpdateAdminAnswer(String newAdminMessage, boolean markDone, User actorAdmin, LocalDateTime now) {
        this.adminMessage = newAdminMessage;
        this.processedBy = actorAdmin;

        if (markDone) {
            if (!this.isProcessed) {
                this.isProcessed = true;
                if (this.processedAt == null) {
                    this.processedAt = now;
                }
                // 최초 완료 전환이면 answerUpdatedAt은 null 유지 가능(명세 예시와 동일)
            } else {
                // DONE 상태에서 수정이라면 수정 시각 갱신
                this.answerUpdatedAt = now;
            }
        } else {
            // markDone=false로 답변만 저장하는 정책이 필요하면 여기서 처리(현재 DDL/명세에선 주로 DONE 전환 흐름)
            // 필요한 경우 서비스에서 제한하면 됨.
        }
    }

    @Override
    public String toString() {
        return "[" + inquirySeq + "] " + title + " (" + getStatus() + ")";
    }
}