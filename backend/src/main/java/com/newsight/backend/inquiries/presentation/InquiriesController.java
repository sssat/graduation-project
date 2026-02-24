// backend/src/main/java/com/newsight/backend/inquiries/presentation/InquiriesController.java
package com.newsight.backend.inquiries.presentation;

import com.newsight.backend.inquiries.application.service.InquiriesService;
import com.newsight.backend.inquiries.presentation.dto.AdminInquiryAnswerDto;
import com.newsight.backend.inquiries.presentation.dto.AdminInquiryDeleteDto;
import com.newsight.backend.inquiries.presentation.dto.AdminInquiryDetailDto;
import com.newsight.backend.inquiries.presentation.dto.AdminInquiryListDto;
import com.newsight.backend.inquiries.presentation.dto.InquiryCreateDto;
import com.newsight.backend.inquiries.presentation.dto.InquiryDetailDto;
import com.newsight.backend.inquiries.presentation.dto.InquiryListDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/**
 * Inquiries API Controller
 * - 컨트롤러는 입출력 변환 + 서비스 위임만 담당
 */
@RestController
@RequiredArgsConstructor
public class InquiriesController {

    private final InquiriesService inquiriesService;

    // -----------------------
    // User APIs
    // -----------------------

    /**
     * 유저 문의 목록 조회
     * GET /api/inquiries/
     */
    @GetMapping({"/api/inquiries", "/api/inquiries/"})
    public ResponseEntity<InquiryListDto.InquiryListResponseDto> listInquiries(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(name = "inquiry_type", required = false) String inquiryType,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "mine", required = false) Boolean mine,
            @RequestParam(name = "page", required = false) Integer page,
            @RequestParam(name = "size", required = false) Integer size
    ) {
        Long actorUserSeq = extractUserSeq(jwt);

        InquiriesService.InquiryListQuery query = new InquiriesService.InquiryListQuery(
                inquiryType,
                status,
                mine,
                page,
                size
        );

        InquiriesService.InquiryListResult result = inquiriesService.listInquiries(actorUserSeq, query);
        return ResponseEntity.ok(InquiryListDto.InquiryListResponseDto.from(result));
    }

    /**
     * 유저 문의 상세 조회
     * GET /api/inquiries/{inquiry_seq}/
     */
    @GetMapping({"/api/inquiries/{inquiry_seq}", "/api/inquiries/{inquiry_seq}/"})
    public ResponseEntity<InquiryDetailDto.InquiryDetailResponseDto> getInquiryDetail(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable("inquiry_seq") Long inquirySeq
    ) {
        Long actorUserSeq = extractUserSeq(jwt);
        InquiriesService.InquiryDetailResult result = inquiriesService.getInquiryDetail(actorUserSeq, inquirySeq);
        return ResponseEntity.ok(InquiryDetailDto.InquiryDetailResponseDto.from(result));
    }

    /**
     * 유저 문의 등록
     * POST /api/inquiries/
     */
    @PostMapping({"/api/inquiries", "/api/inquiries/"})
    public ResponseEntity<InquiryCreateDto.InquiryCreateResponseDto> createInquiry(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody InquiryCreateDto.InquiryCreateRequestDto request
    ) {
        Long actorUserSeq = extractUserSeq(jwt);

        InquiriesService.CreateInquiryResult result =
                inquiriesService.createInquiry(actorUserSeq, request.toCommand());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(InquiryCreateDto.InquiryCreateResponseDto.from(result));
    }

    // -----------------------
    // Admin APIs
    // -----------------------

    /**
     * 관리자 문의 목록 조회
     * GET /api/admins/inquiries/
     */
    @GetMapping({"/api/admins/inquiries", "/api/admins/inquiries/"})
    public ResponseEntity<AdminInquiryListDto.AdminInquiryListResponseDto> listInquiriesForAdmin(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(name = "page", required = false) Integer page,
            @RequestParam(name = "size", required = false) Integer size
    ) {
        Long actorUserSeq = extractUserSeq(jwt);

        InquiriesService.AdminInquiryListResult result =
                inquiriesService.listInquiriesForAdmin(actorUserSeq, page, size);

        return ResponseEntity.ok(AdminInquiryListDto.AdminInquiryListResponseDto.from(result));
    }

    /**
     * 관리자 문의 상세 조회
     * GET /api/admins/inquiries/{inquiry_seq}/
     */
    @GetMapping({"/api/admins/inquiries/{inquiry_seq}", "/api/admins/inquiries/{inquiry_seq}/"})
    public ResponseEntity<AdminInquiryDetailDto.AdminInquiryDetailResponseDto> getInquiryDetailForAdmin(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable("inquiry_seq") Long inquirySeq
    ) {
        Long actorUserSeq = extractUserSeq(jwt);

        InquiriesService.AdminInquiryDetailResult result =
                inquiriesService.getInquiryDetailForAdmin(actorUserSeq, inquirySeq);

        return ResponseEntity.ok(AdminInquiryDetailDto.AdminInquiryDetailResponseDto.from(result));
    }

    /**
     * 관리자 답변 저장/수정 + 처리상태 변경
     * PUT /api/admins/inquiries/{inquiry_seq}/answer/
     */
    @PutMapping({"/api/admins/inquiries/{inquiry_seq}/answer", "/api/admins/inquiries/{inquiry_seq}/answer/"})
    public ResponseEntity<AdminInquiryAnswerDto.AdminInquiryAnswerResponseDto> saveOrUpdateAdminAnswer(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable("inquiry_seq") Long inquirySeq,
            @RequestBody AdminInquiryAnswerDto.AdminInquiryAnswerRequestDto request
    ) {
        Long actorUserSeq = extractUserSeq(jwt);

        InquiriesService.AdminAnswerResult result =
                inquiriesService.saveOrUpdateAdminAnswer(actorUserSeq, inquirySeq, request.toCommand());

        return ResponseEntity.ok(AdminInquiryAnswerDto.AdminInquiryAnswerResponseDto.from(result));
    }

    /**
     * 관리자 문의글 삭제
     * DELETE /api/admins/inquiries/{inquiry_seq}/
     */
    @DeleteMapping({"/api/admins/inquiries/{inquiry_seq}", "/api/admins/inquiries/{inquiry_seq}/"})
    public ResponseEntity<AdminInquiryDeleteDto.AdminInquiryDeleteResponseDto> deleteInquiryForAdmin(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable("inquiry_seq") Long inquirySeq
    ) {
        Long actorUserSeq = extractUserSeq(jwt);

        InquiriesService.AdminDeleteResult result =
                inquiriesService.deleteInquiryForAdmin(actorUserSeq, inquirySeq);

        return ResponseEntity.ok(AdminInquiryDeleteDto.AdminInquiryDeleteResponseDto.from(result));
    }

    // -----------------------
    // Helpers
    // -----------------------

    /**
     * JWT에서 user_seq 클레임을 Long으로 안전하게 추출한다.
     */
    private Long extractUserSeq(Jwt jwt) {
        if (jwt == null) {
            throw new AccessDeniedException("인증 정보가 없습니다.");
        }

        Object raw = jwt.getClaim("user_seq");
        if (raw == null) {
            throw new AccessDeniedException("JWT에 user_seq 클레임이 없습니다.");
        }

        if (raw instanceof Integer i) return i.longValue();
        if (raw instanceof Long l) return l;
        if (raw instanceof Number n) return n.longValue();

        try {
            return Long.parseLong(String.valueOf(raw));
        } catch (NumberFormatException e) {
            throw new AccessDeniedException("JWT user_seq 클레임 형식이 올바르지 않습니다.");
        }
    }
}