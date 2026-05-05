// backend/src/main/java/com/newsight/backend/common/web/GlobalExceptionHandler.java
package com.newsight.backend.common.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.newsight.backend.common.exception.ConflictException;
import com.newsight.backend.common.exception.NotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ApiErrorResponse(
            String message,
            String details,
            int status,
            String path,
            Instant timestamp
    ) {
        public static ApiErrorResponse of(HttpStatus status, String message, String details, String path) {
            return new ApiErrorResponse(
                    message,
                    details,
                    status.value(),
                    path,
                    Instant.now()
            );
        }
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNotFound(NotFoundException e, HttpServletRequest req) {
        HttpStatus status = HttpStatus.NOT_FOUND;
        return ResponseEntity.status(status)
                .body(ApiErrorResponse.of(status, e.getMessage(), null, req.getRequestURI()));
    }

    /**
     * 비즈니스 충돌(409)
     * - analytics: is_analyzable=false 인데 하위 분석 API 호출
     */
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ApiErrorResponse> handleConflict(ConflictException e, HttpServletRequest req) {
        HttpStatus status = HttpStatus.CONFLICT;
        return ResponseEntity.status(status)
                .body(ApiErrorResponse.of(status, e.getMessage(), null, req.getRequestURI()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleBadRequest(IllegalArgumentException e, HttpServletRequest req) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status)
                .body(ApiErrorResponse.of(status, e.getMessage(), null, req.getRequestURI()));
    }

    /**
     * FK/UNIQUE/NOT NULL 등 DB 제약 위반을 400으로 매핑
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleDataIntegrity(DataIntegrityViolationException e, HttpServletRequest req) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        String message = "요청이 DB 제약조건을 위반했습니다.";
        return ResponseEntity.status(status)
                .body(ApiErrorResponse.of(status, message, null, req.getRequestURI()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException e, HttpServletRequest req) {
        HttpStatus status = HttpStatus.BAD_REQUEST;

        String details = e.getBindingResult().getFieldErrors().stream()
                .map(this::formatFieldError)
                .collect(Collectors.joining(", "));

        String message = "요청 값이 올바르지 않습니다.";
        return ResponseEntity.status(status)
                .body(ApiErrorResponse.of(status, message, details.isBlank() ? null : details, req.getRequestURI()));
    }

    private String formatFieldError(FieldError fe) {
        String field = fe.getField();
        String msg = fe.getDefaultMessage();
        Object rejected = fe.getRejectedValue();
        if (rejected == null) return field + ": " + msg;
        return field + ": " + msg + " (rejected=" + rejected + ")";
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleNotReadable(HttpMessageNotReadableException e, HttpServletRequest req) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        String message = "요청 본문(JSON) 파싱에 실패했습니다.";
        return ResponseEntity.status(status)
                .body(ApiErrorResponse.of(status, message, null, req.getRequestURI()));
    }

    @ExceptionHandler({
            AuthenticationCredentialsNotFoundException.class,
            BadCredentialsException.class
    })
    public ResponseEntity<ApiErrorResponse> handleUnauthorized(Exception e, HttpServletRequest req) {
        HttpStatus status = HttpStatus.UNAUTHORIZED;
        String message = (e.getMessage() == null || e.getMessage().isBlank()) ? "로그인이 필요합니다." : e.getMessage();
        return ResponseEntity.status(status)
                .body(ApiErrorResponse.of(status, message, null, req.getRequestURI()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleForbidden(AccessDeniedException e, HttpServletRequest req) {
        HttpStatus status = HttpStatus.FORBIDDEN;
        String message = (e.getMessage() == null || e.getMessage().isBlank()) ? "권한이 없습니다." : e.getMessage();
        return ResponseEntity.status(status)
                .body(ApiErrorResponse.of(status, message, null, req.getRequestURI()));
    }

    /**
     * 서비스 레이어에서 throw new SecurityException(...) 형태로 던진 권한 오류를 403으로 매핑
     */
    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<ApiErrorResponse> handleSecurityException(SecurityException e, HttpServletRequest req) {
        HttpStatus status = HttpStatus.FORBIDDEN;
        String message = (e.getMessage() == null || e.getMessage().isBlank()) ? "권한이 없습니다." : e.getMessage();
        return ResponseEntity.status(status)
                .body(ApiErrorResponse.of(status, message, null, req.getRequestURI()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnknown(Exception e, HttpServletRequest req) {
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        log.error("Unhandled exception. path={}", req.getRequestURI(), e);
        String message = "서버 오류가 발생했습니다.";
        return ResponseEntity.status(status)
                .body(ApiErrorResponse.of(status, message, null, req.getRequestURI()));
    }
}