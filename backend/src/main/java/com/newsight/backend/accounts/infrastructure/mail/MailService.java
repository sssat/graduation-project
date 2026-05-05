// src/main/java/com/newsight/backend/accounts/infrastructure/mail/MailService.java
package com.newsight.backend.accounts.infrastructure.mail;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
public class MailService {

    private final JavaMailSender mailSender;

    /**
     * 발신자 주소
     * - app.mail.from 이 있으면 우선 사용
     * - 없으면 spring.mail.username 사용
     */
    @Value("${app.mail.from:${spring.mail.username:}}")
    private String from;

    /**
     * 단순 텍스트 메일 발송
     */
    public void sendText(String to, String subject, String body) {
        if (to == null || to.trim().isEmpty()) {
            throw new IllegalArgumentException("to is required");
        }
        if (subject == null) subject = "";
        if (body == null) body = "";

        String trimmedFrom = (from == null) ? "" : from.trim();
        if (trimmedFrom.isEmpty()) {
            throw new IllegalStateException("메일 발신 계정이 설정되지 않았습니다. spring.mail.username 또는 app.mail.from 을 확인해주세요.");
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");

            helper.setFrom(trimmedFrom);
            helper.setTo(to.trim());
            helper.setSubject(subject);
            helper.setText(body, false);

            mailSender.send(message);
        } catch (Exception e) {
            log.error("메일 발송 실패. to={}, from={}", to, trimmedFrom, e);
            throw new IllegalStateException("메일 발송에 실패했습니다. 메일 계정, 앱 비밀번호, SMTP 설정을 확인해주세요.", e);
        }
    }
}
