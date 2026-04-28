package com.newsight.backend.accounts.presentation;

import com.newsight.backend.accounts.application.service.AccountsService;
import com.newsight.backend.accounts.presentation.dto.AdminDemoteDto.AdminDemoteRequestDto;
import com.newsight.backend.accounts.presentation.dto.AdminDemoteDto.AdminDemoteResponseDto;
import com.newsight.backend.accounts.presentation.dto.AdminPromoteDto.AdminPromoteRequestDto;
import com.newsight.backend.accounts.presentation.dto.AdminPromoteDto.AdminPromoteResponseDto;
import com.newsight.backend.accounts.presentation.dto.UserListDto.UserListItemDto;
import com.newsight.backend.accounts.presentation.dto.UserListDto.UserListRequestDto;
import com.newsight.backend.accounts.presentation.dto.UserListDto.UserListResponseDto;
import com.newsight.backend.accounts.presentation.dto.WithdrawDto.WithdrawRequestDto;
import com.newsight.backend.accounts.presentation.dto.WithdrawDto.WithdrawResponseDto;
import com.newsight.backend.common.security.CurrentUserExtractor;
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
public class AdminUserController {

    private final AccountsService accountsService;

    @GetMapping({"/users", "/users/"})
    public ResponseEntity<UserListResponseDto> listUsers(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false) Integer size,
            @RequestParam(value = "q", required = false) String q
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);

        UserListRequestDto req = new UserListRequestDto(page, size, q);

        AccountsService.UserListResult r = accountsService.listUsers(
                new AccountsService.UserListQuery(actorUserSeq, req.pageOrDefault(), req.sizeOrDefault(), req.q())
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

    @PostMapping({"/promote", "/promote/"})
    public ResponseEntity<AdminPromoteResponseDto> promote(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AdminPromoteRequestDto body
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);

        AccountsService.PromoteResult r = accountsService.promoteToAdmin(body.userSeq(), actorUserSeq);

        return ResponseEntity.ok(AdminPromoteResponseDto.success(
                r.user_seq(),
                r.acted_seq(),
                r.admin_level(),
                r.granted_at(),
                "愿由ъ옄 沅뚰븳??遺?щ릺?덉뒿?덈떎."
        ));
    }

    @PostMapping({"/demote", "/demote/"})
    public ResponseEntity<AdminDemoteResponseDto> demote(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AdminDemoteRequestDto body
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);

        AccountsService.DemoteResult r = accountsService.demoteToUser(body.userSeq(), actorUserSeq);

        return ResponseEntity.ok(AdminDemoteResponseDto.success(
                r.user_seq(),
                r.acted_seq(),
                r.demoted_at(),
                "愿由ъ옄 沅뚰븳???댁젣?섏뿀?듬땲??"
        ));
    }

    @PostMapping({"/users/withdraw", "/users/withdraw/"})
    public ResponseEntity<WithdrawResponseDto> withdraw(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody WithdrawRequestDto body
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);

        AccountsService.WithdrawResult r = accountsService.withdrawUser(body.userSeq(), actorUserSeq);

        return ResponseEntity.ok(new WithdrawResponseDto(
                r.user_seq(),
                r.deleted_at(),
                r.acted_seq()
        ));
    }
}
