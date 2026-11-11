import { CreateCategoryDto } from './create-category.dto';

// Categoria só tem um campo editável (name), então o update exige o mesmo formato.
// Se surgirem campos novos, trocar por PartialType de @nestjs/mapped-types.
export class UpdateCategoryDto extends CreateCategoryDto {}
