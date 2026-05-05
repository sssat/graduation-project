package com.newsight.backend.accounts.application.service;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.accounts.domain.model.User.Gender;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

final class AccountSupport {

    private static final String TEMP_PW_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private AccountSupport() {}

    static void ensureNotBlank(String s, String field) {
        if (s == null || s.trim().isEmpty()) throw new IllegalArgumentException("required field is missing: " + field);
    }

    static void validateBirthDatePolicy(LocalDate birth, Clock clock) {
        LocalDate today = LocalDate.now(clock);
        if (birth.isAfter(today)) {
            throw new IllegalArgumentException("birthDate cannot be in the future.");
        }

        int age = today.getYear() - birth.getYear()
                - ((today.getMonthValue() * 100 + today.getDayOfMonth())
                < (birth.getMonthValue() * 100 + birth.getDayOfMonth()) ? 1 : 0);

        if (age < 14 && age >= 0) {
            throw new IllegalArgumentException("Users must be at least 14 years old.");
        } else if (age < 0 || age >= 120) {
            throw new IllegalArgumentException("birthDate is invalid.");
        }
    }

    static Gender parseGender(String gender) {
        String g = safe(gender).toUpperCase();
        if ("M".equals(g)) return Gender.M;
        if ("F".equals(g)) return Gender.F;
        throw new IllegalArgumentException("gender must be M or F.");
    }

    static String mapRole(User user) {
        int code = levelCode(user);
        return switch (code) {
            case 2 -> "SUPER_ADMIN";
            case 1 -> "ADMIN";
            default -> "USER";
        };
    }

    static int levelCode(User user) {
        if (user == null || user.getUserLevel() == null || user.getUserLevel().getGradeCode() == null) return 0;
        return user.getUserLevel().getGradeCode().intValue();
    }

    static String defaultGradeName(int code) {
        return switch (code) {
            case 2 -> "SUPER_ADMIN";
            case 1 -> "ADMIN";
            default -> "USER";
        };
    }

    static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    static String safe(String s) {
        return (s == null) ? "" : s.trim();
    }

    static List<String> splitTerms(String q) {
        if (q == null || q.isBlank()) return List.of();
        String[] parts = q.trim().split("\\s+");
        List<String> out = new ArrayList<>(parts.length);
        for (String p : parts) {
            String t = p.trim();
            if (!t.isEmpty()) out.add(t);
        }
        return out;
    }

    static String generateTempPassword(int length) {
        int len = Math.max(8, length);
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) {
            sb.append(TEMP_PW_CHARS.charAt(SECURE_RANDOM.nextInt(TEMP_PW_CHARS.length())));
        }
        return sb.toString();
    }

    static String passwordPolicyError(String pw, String userId) {
        if (pw == null) return "Password is required.";

        String p = pw.trim();
        if (p.length() < 8 || p.length() > 20) {
            return "Password must be 8 to 20 characters.";
        }

        String uid = safe(userId).toLowerCase();
        if (!uid.isEmpty() && p.toLowerCase().contains(uid)) {
            return "Password cannot contain the user id.";
        }

        boolean hasUpper = p.chars().anyMatch(Character::isUpperCase);
        boolean hasLower = p.chars().anyMatch(Character::isLowerCase);
        boolean hasDigit = p.chars().anyMatch(Character::isDigit);
        boolean hasSpecial = p.chars().anyMatch(ch -> !Character.isLetterOrDigit(ch));

        int kinds = 0;
        if (hasUpper) kinds++;
        if (hasLower) kinds++;
        if (hasDigit) kinds++;
        if (hasSpecial) kinds++;

        if (kinds < 3) {
            return "Password must include at least three of uppercase, lowercase, digits, and special characters.";
        }

        return null;
    }
}
