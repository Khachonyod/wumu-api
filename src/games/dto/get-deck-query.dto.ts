import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetDeckQueryDto {
    @IsOptional()
    @IsString()
    genres?: string; // เช่น "แอ็คชัน,อินดี้"

    @IsOptional()
    @IsString()
    categories?: string;

    @IsOptional()
    @IsString()
    developer?: string;

    @IsOptional()
    @IsString()
    publisher?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    maxPrice?: number; // งบสูงสุด (หน่วยเป็นบาท เช่น 500)

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(100)
    minDiscount?: number; // % ลดขั้นต่ำ เช่น 50

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number;
}