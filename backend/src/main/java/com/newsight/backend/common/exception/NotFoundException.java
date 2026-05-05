// backend/src/main/java/com/newsight/backend/common/exception/NotFoundException.java
package com.newsight.backend.common.exception;

public class NotFoundException extends RuntimeException {

    public NotFoundException() {
        super("리소스를 찾을 수 없습니다.");
    }

    public NotFoundException(String message) {
        super(message);
    }

    public NotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}