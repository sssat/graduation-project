package com.newsight.backend.inquiries.presentation;

import com.newsight.backend.common.security.CurrentUserExtractor;
import com.newsight.backend.inquiries.application.service.InquiriesService;
import com.newsight.backend.inquiries.presentation.dto.InquiryCreateDto;
import com.newsight.backend.inquiries.presentation.dto.InquiryDetailDto;
import com.newsight.backend.inquiries.presentation.dto.InquiryListDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/inquiries")
@Tag(name = "User Inquiries", description = "Authenticated user inquiry APIs")
@SecurityRequirement(name = "bearerAuth")
public class InquiryController {

    private final InquiriesService inquiriesService;

    @GetMapping("")
    @Operation(summary = "List inquiries")
    public ResponseEntity<InquiryListDto.InquiryListResponseDto> listInquiries(
            @Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt,
            @RequestParam(name = "inquiry_type", required = false) String inquiryType,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "mine", required = false) Boolean mine,
            @RequestParam(name = "page", required = false) Integer page,
            @RequestParam(name = "size", required = false) Integer size
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);

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

    @GetMapping("/{inquiry_seq}")
    @Operation(summary = "Get inquiry detail")
    public ResponseEntity<InquiryDetailDto.InquiryDetailResponseDto> getInquiryDetail(
            @Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt,
            @PathVariable("inquiry_seq") Long inquirySeq
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);
        InquiriesService.InquiryDetailResult result = inquiriesService.getInquiryDetail(actorUserSeq, inquirySeq);
        return ResponseEntity.ok(InquiryDetailDto.InquiryDetailResponseDto.from(result));
    }

    @PostMapping("")
    @Operation(summary = "Create inquiry")
    public ResponseEntity<InquiryCreateDto.InquiryCreateResponseDto> createInquiry(
            @Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody InquiryCreateDto.InquiryCreateRequestDto request
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);

        InquiriesService.CreateInquiryResult result =
                inquiriesService.createInquiry(actorUserSeq, request.toCommand());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(InquiryCreateDto.InquiryCreateResponseDto.from(result));
    }
}
