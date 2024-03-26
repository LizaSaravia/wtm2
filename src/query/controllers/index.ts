import { Controller, Get, HttpCode, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QueryService } from '../services';
import { QueryResultDto } from '../dtos/queryResult.dto';
import { ApiInternalServerErrorMessageResponse } from 'src/common/decorators';
import { JwtAccessToken, JwtRequestContext } from 'src/auth/decorators';
import { JwtContext } from 'src/auth/interfaces';
import { PaginationResponse } from 'src/common/dtos';
import { ApiPaginationResponse } from 'src/common/decorators';
import { GetPaginationsParamsDto } from '../../common/dtos';

@ApiTags('Query')
@Controller('queries')
export class QueyController {
  constructor(private readonly queryService: QueryService) {}

  @ApiInternalServerErrorMessageResponse()
  @ApiPaginationResponse(QueryResultDto)
  @JwtAccessToken([])
  @HttpCode(200)
  @Get('/')
  getQueries(
    @JwtRequestContext() context: JwtContext,
    @Query() queryParams: GetPaginationsParamsDto,
  ): Promise<PaginationResponse<QueryResultDto>> {
    return this.queryService.getQueries(context, queryParams);
  }
}
