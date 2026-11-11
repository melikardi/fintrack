import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }
    const passwordHash = await argon2.hash(dto.password);
    return this.users.create({ name: dto.name, email, passwordHash });
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email.toLowerCase());
    const valid = user && (await argon2.verify(user.passwordHash, dto.password));
    if (!user || !valid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return { accessToken };
  }
}