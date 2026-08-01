import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CommentVisibility } from '@prisma/client';
import { CreateCommentDto } from '../dto/create-comment.dto';

describe('CreateCommentDto', () => {
  it('rechaza contenido vacío tras trim', async () => {
    const dto = plainToInstance(CreateCommentDto, {
      content: '   \n   ',
      visibility: CommentVisibility.PUBLIC,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'content')).toBe(true);
  });

  it('rechaza contenido de más de 5000 caracteres', async () => {
    const dto = plainToInstance(CreateCommentDto, {
      content: 'a'.repeat(5001),
      visibility: CommentVisibility.PUBLIC,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'content')).toBe(true);
  });

  it('normaliza \\r\\n a \\n sin rechazar el contenido', async () => {
    const dto = plainToInstance(CreateCommentDto, {
      content: 'línea 1\r\nlínea 2\r\nlínea 3',
      visibility: CommentVisibility.PUBLIC,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.content).toBe('línea 1\nlínea 2\nlínea 3');
  });

  it('preserva código/XML/logs pegados por el usuario sin alterarlos (más allá de trim y \\r\\n)', async () => {
    const raw = '<xml><node attr="1">valor</node></xml>\r\nStack: at foo() line 42';
    const dto = plainToInstance(CreateCommentDto, {
      content: raw,
      visibility: CommentVisibility.PUBLIC,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.content).toBe(raw.replace(/\r\n/g, '\n'));
  });

  it('rechaza visibility fuera del enum', async () => {
    const dto = plainToInstance(CreateCommentDto, {
      content: 'hola',
      visibility: 'SECRET',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'visibility')).toBe(true);
  });

  it('exige visibility explícito (sin default)', async () => {
    const dto = plainToInstance(CreateCommentDto, { content: 'hola' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'visibility')).toBe(true);
  });
});
