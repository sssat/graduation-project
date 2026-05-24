package com.newsight.backend.admin.presentation;

import com.newsight.backend.admin.application.service.AdminService;
import com.newsight.backend.admin.presentation.dto.AdminDemoteDto.AdminDemoteRequestDto;
import com.newsight.backend.admin.presentation.dto.AdminDemoteDto.AdminDemoteResponseDto;
import com.newsight.backend.admin.presentation.dto.AdminPromoteDto.AdminPromoteRequestDto;
import com.newsight.backend.admin.presentation.dto.AdminPromoteDto.AdminPromoteResponseDto;
import com.newsight.backend.admin.presentation.dto.UserListDto.UserListItemDto;
import com.newsight.backend.admin.presentation.dto.UserListDto.UserListRequestDto;
import com.newsight.backend.admin.presentation.dto.UserListDto.UserListResponseDto;
import com.newsight.backend.admin.presentation.dto.WithdrawDto.WithdrawRequestDto;
import com.newsight.backend.admin.presentation.dto.WithdrawDto.WithdrawResponseDto;
import com.newsight.backend.common.security.CurrentUserExtractor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admins")
@Tag(name = "Admin Users", description = "Administrator user management APIs")
@SecurityRequirement(name = "bearerAuth")
public class AdminUserController {

    private final AdminService adminService;

    @GetMapping("/users")
    @Operation(summary = "List users")
    public ResponseEntity<UserListResponseDto> listUsers(
            @Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false) Integer size,
            @RequestParam(value = "q", required = false) String q
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);

        UserListRequestDto req = new UserListRequestDto(page, size, q);

        AdminService.UserListResult r = adminService.listUsers(
                new AdminService.UserListQuery(actorUserSeq, req.pageOrDefault(), req.sizeOrDefault(), req.q())
        );

        List<UserListItemDto> items = r.items().stream()
                .map(x -> new UserListItemDto(
                        x.user_seq(),
                        x.user_id(),
                        x.user_name(),
                        x.grade_code(),
                        x.grade_name(),
                        x.email(),
                        x.birth_date(),
                        x.gender(),
                        x.last_login_at(),
                        x.joined_at(),
                        x.granted_at(),
                        x.password_changed_at()
                ))
                .toList();

        return ResponseEntity.ok(UserListResponseDto.success(
                items,
                r.page(),
                r.size(),
                r.total_count(),
                r.total_pages(),
                null
        ));
    }

    @PostMapping("/promote")
    @Operation(summary = "Promote user to admin")
    public ResponseEntity<AdminPromoteResponseDto> promote(
            @Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AdminPromoteRequestDto body
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);

        AdminService.PromoteResult r = adminService.promoteToAdmin(body.userSeq(), actorUserSeq);

        return ResponseEntity.ok(AdminPromoteResponseDto.success(
                r.user_seq(),
                r.acted_seq(),
                r.admin_level(),
                r.granted_at(),
                "관리자 권한이 부여되었습니다."
        ));
    }

    @PostMapping("/demote")
    @Operation(summary = "Demote admin to user")
    public ResponseEntity<AdminDemoteResponseDto> demote(
            @Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AdminDemoteRequestDto body
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);

        AdminService.DemoteResult r = adminService.demoteToUser(body.userSeq(), actorUserSeq);

        return ResponseEntity.ok(AdminDemoteResponseDto.success(
                r.user_seq(),
                r.acted_seq(),
                r.demoted_at(),
                "관리자 권한이 해제되었습니다."
        ));
    }

    @PostMapping("/users/withdraw")
    @Operation(summary = "Withdraw user")
    public ResponseEntity<WithdrawResponseDto> withdraw(
            @Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody WithdrawRequestDto body
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);

        AdminService.WithdrawResult r = adminService.withdrawUser(body.userSeq(), actorUserSeq);

        return ResponseEntity.ok(new WithdrawResponseDto(
                r.user_seq(),
                r.deleted_at(),
                r.acted_seq()
        ));
    }
}
