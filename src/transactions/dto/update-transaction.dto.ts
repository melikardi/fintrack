import { PartialType } from '@nestjs/swagger';
import { CreateTransactionDto } from './create-transaction.dto';

// Todos os campos de criação, mas opcionais (PATCH parcial)
export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {}
