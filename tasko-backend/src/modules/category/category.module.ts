import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryController } from './controllers/category.controller';
import { TeamCategoryController } from './controllers/team-category.controller';
import { CategoryEntity } from './entities/category.entity';
import { CategoryRepository } from './interfaces/category-repository';
import { TypeOrmCategoryRepository } from './repositories/typeorm-category.repository';
import { CategoryService } from './services/category.service';

@Module({
  imports: [TypeOrmModule.forFeature([CategoryEntity])],
  controllers: [CategoryController, TeamCategoryController],
  providers: [
    CategoryService,
    { provide: CategoryRepository, useClass: TypeOrmCategoryRepository },
  ],
  exports: [CategoryRepository],
})
export class CategoryModule {}
