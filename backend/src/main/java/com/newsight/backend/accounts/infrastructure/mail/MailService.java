// src/main/java/com/newsight/backend/accounts/infrastructure/mail/MailService.java
package com.newsight.backend.accounts.infrastructure.mail;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * MailService
 * - 텍스트 이메일 발송용 단순 래퍼
 * - AccountsService.findPassword() 등에서 호출
 *
 * 전제:
 * - spring-boot-starter-mail 의존성이 추가되어 있어야 함
 * - application.yml에 spring.mail.* 설정이 되어 있어야 함
 */
@Service
@RequiredArgsConstructor
public class MailService {

    private final JavaMailSender mailSender;

    /**
     * 발신자 주소 (보통 SMTP 계정)
     * - 미설정이면 JavaMailSender 설정에 따라 default가 적용될 수 있음
     */
    @Value("${spring.mail.username:}")
    private String from;

    /**
     * 단순 텍스트 메일 발송
     */
    public void sendText(String to, String subject, String body) {
        if (to == null || to.trim().isEmpty()) throw new IllegalArgumentException("to is required");
        if (subject == null) subject = "";
        if (body == null) body = "";

        try {
            MimeMessage message = mailSender.createMimeMessage();
            // multipart=false, encoding=UTF-8
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");

            if (from != null && !from.isBlank()) {
                helper.setFrom(from);
            }

            helper.setTo(to.trim());
            helper.setSubject(subject);
            helper.setText(body, false);

            mailSender.send(message);
        } catch (Exception e) {
            throw new IllegalStateException("메일 발송에 실패했습니다.", e);
        }
    }
}
