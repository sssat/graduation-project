package com.newsight.backend.admin.presentation;

import com.newsight.backend.admin.application.service.AdminService;
import com.newsight.backend.admin.presentation.dto.AdminDashboardVisitsDto.AdminDashboardVisitsRequestDto;
import com.newsight.backend.admin.presentation.dto.AdminDashboardVisitsDto.AdminDashboardVisitsResponseDto;
import com.newsight.backend.admin.presentation.dto.AdminDashboardVisitsDto.VisitItemDto;
import com.newsight.backend.common.security.CurrentUserExtractor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admins/dashboard")
@Tag(name = "Admin Dashboard", description = "Administrator dashboard APIs")
@SecurityRequirement(name = "bearerAuth")
public class AdminVisitController {

    private final AdminService adminService;

    @GetMapping("/visits")
    @Operation(summary = "List daily visitor records")
    public ResponseEntity<AdminDashboardVisitsResponseDto> listAdminDashboardVisits(
            @Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false) Integer size
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);
        AdminDashboardVisitsRequestDto req = new AdminDashboardVisitsRequestDto(page, size);

        var r = adminService.listAdminDashboardVisits(
                actorUserSeq,
                req.pageOrDefault(),
                req.sizeOrDefault()
        );

        List<VisitItemDto> items = r.items().stream()
                .map(x -> new VisitItemDto(
                        x.visitorDailySeq(),
                        x.firstVisitedAt(),
                        x.lastVisitedAt(),
                        x.pageViewCount(),
                        x.ipAddress(),
                        x.userAgent(),
                        x.referrer(),
                        x.acceptLanguage(),
                        x.clientTimeZone(),
                        x.screenWidth(),
                        x.screenHeight(),
                        x.firstPath(),
                        x.lastPath()
                ))
                .toList();

        return ResponseEntity.ok(new AdminDashboardVisitsResponseDto(
                items,
                r.page(),
                r.size(),
                r.totalCount(),
                r.totalPages()
        ));
    }
}
