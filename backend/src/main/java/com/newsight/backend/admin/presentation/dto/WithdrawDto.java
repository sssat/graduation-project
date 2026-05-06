// backend/src/main/java/com/newsight/backend/admin/presentation/dto/WithdrawDto.java
package com.newsight.backend.admin.presentation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

/**
 * /api/admins/users/withdraw
 */
public final class WithdrawDto {

    private WithdrawDto() {}

    public record WithdrawRequestDto(
            @JsonProperty("user_seq")
            @NotNull
            Long userSeq
    ) {}

    public record WithdrawResponseDto(
            @JsonProperty("user_seq")
            Long userSeq,

            @JsonProperty("deleted_at")
            LocalDateTime deletedAt,

            @JsonProperty("acted_seq")
            Long actedSeq
    ) {}
}
