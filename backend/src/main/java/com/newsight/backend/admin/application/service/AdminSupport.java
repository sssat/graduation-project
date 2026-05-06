package com.newsight.backend.admin.application.service;

import com.newsight.backend.accounts.domain.model.User;
import java.util.ArrayList;
import java.util.List;

final class AdminSupport {

    private AdminSupport() {}

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

    static String safe(String s) {
        return s == null ? "" : s.trim();
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
}
