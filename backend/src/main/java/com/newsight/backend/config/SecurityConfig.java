// backend/src/main/java/com/newsight/backend/config/SecurityConfig.java
package com.newsight.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newsight.backend.accounts.infrastructure.security.JwtKeyUtil;
import com.newsight.backend.common.web.GlobalExceptionHandler;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import javax.crypto.SecretKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins:}") String allowedOriginsRaw,
            @Value("${app.cors.allowed-origin-patterns:}") String allowedOriginPatternsRaw,
            @Value("${app.cors.allow-credentials:true}") boolean allowCredentials
    ) {
        List<String> allowedOrigins = normalizeListProperty(allowedOriginsRaw);
        List<String> allowedOriginPatterns = normalizeListProperty(allowedOriginPatternsRaw);

        // 개발 중 설정 실수(빈 값/파싱 꼬임) 방지용 안전망
        // 둘 다 비어 있으면 localhost 계열을 패턴으로 기본 허용
        if (allowedOrigins.isEmpty() && allowedOriginPatterns.isEmpty()) {
            allowedOriginPatterns = List.of("http://localhost:*", "http://127.0.0.1:*");
            log.warn("CORS 설정이 비어 있어 개발용 기본 패턴을 적용합니다: {}", allowedOriginPatterns);
        }

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedOriginPatterns(allowedOriginPatterns);
        config.setAllowCredentials(allowCredentials);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Set-Cookie"));
        config.setMaxAge(3600L);

        log.info("CORS allowedOrigins={}", allowedOrigins);
        log.info("CORS allowedOriginPatterns={}", allowedOriginPatterns);
        log.info("CORS allowCredentials={}", allowCredentials);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public JwtDecoder jwtDecoder(
            @Value("${app.jwt.secret:}") String secret,
            @Value("${app.jwt.issuer:newsight}") String issuer,
            @Value("${app.jwt.audience:newsight}") String audience
    ) {
        SecretKey key = JwtKeyUtil.hmacSha256Key(secret);

        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();

        OAuth2TokenValidator<Jwt> withIssuer =
                (issuer == null || issuer.isBlank())
                        ? JwtValidators.createDefault()
                        : JwtValidators.createDefaultWithIssuer(issuer);

        OAuth2TokenValidator<Jwt> withAudience = jwt -> {
            if (audience == null || audience.isBlank()) {
                return OAuth2TokenValidatorResult.success();
            }

            Object audClaim = jwt.getClaim("aud");
            if (audClaim == null) {
                return OAuth2TokenValidatorResult.success();
            }

            boolean ok;
            if (audClaim instanceof String s) {
                ok = audience.equals(s);
            } else if (audClaim instanceof Collection<?> c) {
                ok = c.stream().anyMatch(x -> x != null && audience.equals(String.valueOf(x)));
            } else {
                ok = audience.equals(String.valueOf(audClaim));
            }

            if (ok) return OAuth2TokenValidatorResult.success();

            OAuth2Error err = new OAuth2Error("invalid_token", "Invalid audience", null);
            return OAuth2TokenValidatorResult.failure(err);
        };

        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(withIssuer, withAudience));
        return decoder;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, ObjectMapper objectMapper) throws Exception {
        http.csrf(csrf -> csrf.disable());
        http.cors(Customizer.withDefaults());

        http.exceptionHandling(ex -> ex
                .authenticationEntryPoint((req, res, e) -> {
                    String message =
                            (e == null || e.getMessage() == null || e.getMessage().isBlank())
                                    ? "로그인이 필요합니다."
                                    : e.getMessage();
                    writeApiError(req, res, HttpStatus.UNAUTHORIZED, message, objectMapper);
                })
                .accessDeniedHandler((req, res, e) -> {
                    String message =
                            (e == null || e.getMessage() == null || e.getMessage().isBlank())
                                    ? "권한이 없습니다."
                                    : e.getMessage();
                    writeApiError(req, res, HttpStatus.FORBIDDEN, message, objectMapper);
                })
        );

        http.authorizeHttpRequests(auth -> auth
                // CORS preflight 허용
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // actuator health 전체 공개
                // /actuator/health 는 물론 /actuator/health/db, /actuator/health/mail 등 세부 확인도 허용
                .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()

                // accounts (public)
                .requestMatchers("/api/auth/register/**").permitAll()
                .requestMatchers("/api/auth/login").permitAll()
                .requestMatchers("/api/auth/refresh").permitAll()
                .requestMatchers("/api/auth/logout").permitAll()
                .requestMatchers("/api/auth/find-id").permitAll()
                .requestMatchers("/api/auth/find-password").permitAll()

                // public read endpoints
                .requestMatchers(HttpMethod.GET, "/api/public/**").permitAll()

                // analytics (public read)
                .requestMatchers(HttpMethod.GET, "/api/analytics/**").permitAll()

                // Admin APIs need an ADMIN(1) or SUPER_ADMIN(2) JWT grade claim.
                .requestMatchers("/api/admins/**").access((authentication, context) -> {
                    Object principal = authentication.get().getPrincipal();
                    int gradeCode = 0;
                    if (principal instanceof Jwt jwt) {
                        Object raw = jwt.getClaim("gradeCode");
                        if (raw instanceof Number n) {
                            gradeCode = n.intValue();
                        } else if (raw != null) {
                            try {
                                gradeCode = Integer.parseInt(String.valueOf(raw));
                            } catch (NumberFormatException ignore) {
                                gradeCode = 0;
                            }
                        }
                    }
                    return new AuthorizationDecision(gradeCode >= 1);
                })

                .anyRequest().authenticated()
        );

        http.oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
        return http.build();
    }

    private void writeApiError(
            HttpServletRequest req,
            HttpServletResponse res,
            HttpStatus status,
            String message,
            ObjectMapper objectMapper
    ) throws IOException {
        res.setStatus(status.value());
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());

        GlobalExceptionHandler.ApiErrorResponse body =
                GlobalExceptionHandler.ApiErrorResponse.of(status, message, null, req.getRequestURI());

        objectMapper.writeValue(res.getOutputStream(), body);
    }

    // YAML 리스트 / 쉼표 문자열 / [] / 따옴표 포함 케이스를 모두 정규화
    private List<String> normalizeListProperty(String raw) {
        if (raw == null) return List.of();

        String text = raw.trim();
        if (text.isEmpty() || "[]".equals(text)) return List.of();

        // [a, b] 형태면 바깥 대괄호 제거
        if (text.startsWith("[") && text.endsWith("]") && text.length() >= 2) {
            text = text.substring(1, text.length() - 1).trim();
        }

        if (text.isEmpty()) return List.of();

        String[] tokens = text.split(",");
        List<String> result = new ArrayList<>();

        for (String token : tokens) {
            String v = token.trim();

            // 양끝 따옴표 제거
            if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
                if (v.length() >= 2) {
                    v = v.substring(1, v.length() - 1).trim();
                }
            }

            if (!v.isEmpty() && !"[]".equals(v)) {
                result.add(v);
            }
        }

        return result;
    }
}
