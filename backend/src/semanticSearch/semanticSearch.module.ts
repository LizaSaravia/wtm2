import { Module } from '@nestjs/common';
import { SemanticProcessor } from './services';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  providers: [SemanticProcessor],
  exports: [SemanticProcessor],
})
export class SemanticSearchModule {}