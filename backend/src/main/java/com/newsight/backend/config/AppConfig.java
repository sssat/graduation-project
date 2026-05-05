// backend/src/main/java/com/newsight/backend/config/AppConfig.java
package com.newsight.backend.config;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class AppConfig {

    @Bean
    public Clock clock(
            @Value("${app.clock.zone:Asia/Seoul}") String zone
    ) {
        return Clock.system(ZoneId.of(zone));
    }

    @Bean
    public PasswordEncoder passwordEncoder(
            @Value("${app.security.password.bcrypt-strength:12}") int strength
    ) {
        return new BCryptPasswordEncoder(Math.max(4, strength));
    }
}