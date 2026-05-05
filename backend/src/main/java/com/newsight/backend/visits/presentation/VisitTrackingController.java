package com.newsight.backend.visits.presentation;

import com.newsight.backend.visits.application.service.VisitTrackingService;
import com.newsight.backend.visits.presentation.dto.VisitTrackDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/visits")
@RequiredArgsConstructor
@Tag(name = "Visits", description = "Public visit tracking APIs")
public class VisitTrackingController {

    private final VisitTrackingService visitTrackingService;

    @PostMapping
    @Operation(summary = "Track an anonymous daily visit")
    public ResponseEntity<VisitTrackDto.VisitTrackResponseDto> trackVisit(
            @RequestBody(required = false) VisitTrackDto.VisitTrackRequestDto request,
            HttpServletRequest servletRequest
    ) {
        String clientVisitorId = request == null ? null : request.clientVisitorId();
        String path = request == null ? null : request.path();
        VisitTrackingService.VisitTrackResult result = visitTrackingService.trackVisit(
                clientVisitorId,
                path,
                request == null ? null : request.referrer(),
                firstNonBlank(request == null ? null : request.language(), servletRequest.getHeader("Accept-Language")),
                request == null ? null : request.clientTimeZone(),
                request == null ? null : request.screenWidth(),
                request == null ? null : request.screenHeight(),
                resolveClientIp(servletRequest),
                servletRequest.getHeader("User-Agent")
        );

        return ResponseEntity.ok(new VisitTrackDto.VisitTrackResponseDto(
                result.visitDate(),
                result.tracked()
        ));
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }

        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }

        return request.getRemoteAddr();
    }

    private String firstNonBlank(String first, String fallback) {
        return first != null && !first.isBlank() ? first : fallback;
    }
}
