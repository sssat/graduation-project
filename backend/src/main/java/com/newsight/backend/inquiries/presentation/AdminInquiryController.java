package com.newsight.backend.inquiries.presentation;

import com.newsight.backend.common.security.CurrentUserExtractor;
import com.newsight.backend.inquiries.application.service.InquiriesService;
import com.newsight.backend.inquiries.presentation.dto.AdminInquiryAnswerDto;
import com.newsight.backend.inquiries.presentation.dto.AdminInquiryDeleteDto;
import com.newsight.backend.inquiries.presentation.dto.AdminInquiryDetailDto;
import com.newsight.backend.inquiries.presentation.dto.AdminInquiryListDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admins/inquiries")
public class AdminInquiryController {

    private final InquiriesService inquiriesService;

    @GetMapping({"", "/"})
    public ResponseEntity<AdminInquiryListDto.AdminInquiryListResponseDto> listInquiriesForAdmin(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(name = "page", required = false) Integer page,
            @RequestParam(name = "size", required = false) Integer size
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);

        InquiriesService.AdminInquiryListResult result =
                inquiriesService.listInquiriesForAdmin(actorUserSeq, page, size);

        return ResponseEntity.ok(AdminInquiryListDto.AdminInquiryListResponseDto.from(result));
    }

    @GetMapping({"/{inquiry_seq}", "/{inquiry_seq}/"})
    public ResponseEntity<AdminInquiryDetailDto.AdminInquiryDetailResponseDto> getInquiryDetailForAdmin(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable("inquiry_seq") Long inquirySeq
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);

        InquiriesService.AdminInquiryDetailResult result =
                inquiriesService.getInquiryDetailForAdmin(actorUserSeq, inquirySeq);

        return ResponseEntity.ok(AdminInquiryDetailDto.AdminInquiryDetailResponseDto.from(result));
    }

    @PutMapping({"/{inquiry_seq}/answer", "/{inquiry_seq}/answer/"})
    public ResponseEntity<AdminInquiryAnswerDto.AdminInquiryAnswerResponseDto> saveOrUpdateAdminAnswer(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable("inquiry_seq") Long inquirySeq,
            @Valid @RequestBody AdminInquiryAnswerDto.AdminInquiryAnswerRequestDto request
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);

        InquiriesService.AdminAnswerResult result =
                inquiriesService.saveOrUpdateAdminAnswer(actorUserSeq, inquirySeq, request.toCommand());

        return ResponseEntity.ok(AdminInquiryAnswerDto.AdminInquiryAnswerResponseDto.from(result));
    }

    @DeleteMapping({"/{inquiry_seq}", "/{inquiry_seq}/"})
    public ResponseEntity<AdminInquiryDeleteDto.AdminInquiryDeleteResponseDto> deleteInquiryForAdmin(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable("inquiry_seq") Long inquirySeq
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);

        InquiriesService.AdminDeleteResult result =
                inquiriesService.deleteInquiryForAdmin(actorUserSeq, inquirySeq);

        return ResponseEntity.ok(AdminInquiryDeleteDto.AdminInquiryDeleteResponseDto.from(result));
    }
}
