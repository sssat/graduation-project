// backend/src/main/java/com/newsight/backend/analytics/presentation/dto/CoocNetworkDto.java
package com.newsight.backend.analytics.presentation.dto;

import java.util.List;

/**
 * GET /api/analytics/keywords/{keyword_seq}/cooc-network/
 */
public final class CoocNetworkDto {

    private CoocNetworkDto() {}

    public record CoocNetworkRequestDto(
            /**
             * D7 | D14 (없으면 D7)
             */
            String period
    ) {}

    public record CoocNetworkResponseDto(
            List<NodeItemDto> nodes,
            List<EdgeItemDto> edges
    ) {}

    public record NodeItemDto(
            Long id,
            String label,
            Double size
    ) {}

    public record EdgeItemDto(
            Long source,
            Long target,
            Double weight
    ) {}
}