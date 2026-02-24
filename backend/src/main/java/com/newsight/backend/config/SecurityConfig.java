// backend/src/main/java/com/newsight/backend/config/SecurityConfig.java
package com.newsight.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newsight.backend.accounts.infrastructure.security.JwtKeyUtil;
import com.newsight.backend.common.web.GlobalExceptionHandler;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.List;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins:}") List<String> allowedOrigins,
            @Value("${app.cors.allowed-origin-patterns:}") List<String> allowedOriginPatterns,
            @Value("${app.cors.allow-credentials:true}") boolean allowCredentials
    ) {
        CorsConfiguration config = new CorsConfiguration();
        if (allowedOrigins != null && !allowedOrigins.isEmpty()) {
            config.setAllowedOrigins(allowedOrigins);
        }
        if (allowedOriginPatterns != null && !allowedOriginPatterns.isEmpty()) {
            config.setAllowedOriginPatterns(allowedOriginPatterns);
        }
        config.setAllowCredentials(allowCredentials);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setMaxAge(3600L);

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
                .requestMatchers("/actuator/health").permitAll()

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
}