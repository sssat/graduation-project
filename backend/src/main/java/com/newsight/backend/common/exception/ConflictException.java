// backend/src/main/java/com/newsight/backend/common/exception/ConflictException.java
package com.newsight.backend.common.exception;

/**
 * 비즈니스 규칙 충돌(HTTP 409) 표현용 예외
 * - 예: 분석 불가 상태(is_analyzable=false)에서 하위 분석 API 호출
 */
public class ConflictException extends RuntimeException {

    public ConflictException() {
        super("요청이 현재 상태와 충돌합니다.");
    }

    public ConflictException(String message) {
        super(message);
    }

    public ConflictException(String message, Throwable cause) {
        super(message, cause);
    }
}