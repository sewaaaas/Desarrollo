import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AttachmentFileValidator,
  UploadedAttachmentFile,
} from '../validation/attachment-file.validator';

describe('AttachmentFileValidator', () => {
  let validator: AttachmentFileValidator;

  function createValidator(
    maxFileSizeBytes = 10_485_760,
  ): AttachmentFileValidator {
    return new AttachmentFileValidator(
      new ConfigService({
        storage: {
          driver: 'local',
          localPath: './uploads',
          maxFileSizeBytes,
          maxFilesPerTicket: 20,
          maxTotalSizePerTicketBytes: 104_857_600,
        },
      }),
    );
  }

  function file(
    originalname: string,
    mimetype: string,
    buffer: Buffer,
  ): UploadedAttachmentFile {
    return { originalname, mimetype, size: buffer.length, buffer };
  }

  beforeEach(() => {
    validator = createValidator();
  });

  it('exige exactamente un archivo representado por el parámetro file', () => {
    expect(() => validator.validate(undefined)).toThrow(BadRequestException);
  });

  it('rechaza archivos vacíos y tamaños inconsistentes', () => {
    expect(() =>
      validator.validate(file('vacío.txt', 'text/plain', Buffer.alloc(0))),
    ).toThrow(BadRequestException);

    expect(() =>
      validator.validate({
        ...file('texto.txt', 'text/plain', Buffer.from('hola')),
        size: 3,
      }),
    ).toThrow(BadRequestException);
  });

  it('rechaza archivos mayores al límite configurado', () => {
    validator = createValidator(3);
    expect(() =>
      validator.validate(file('texto.txt', 'text/plain', Buffer.from('hola'))),
    ).toThrow(PayloadTooLargeException);
  });

  it.each([
    ['documento.pdf', 'application/pdf', Buffer.from('%PDF-1.7\n')],
    [
      'imagen.png',
      'image/png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ],
    ['foto.jpg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
    ['foto.jpeg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe1])],
    ['captura.webp', 'image/webp', Buffer.from('RIFF0000WEBP', 'ascii')],
    ['detalle.txt', 'text/plain', Buffer.from('línea uno\nlínea dos', 'utf8')],
    ['app.log', 'text/plain', Buffer.from('INFO aplicación iniciada', 'utf8')],
    ['datos.csv', 'text/csv', Buffer.from('id,nombre\n1,Ana', 'utf8')],
  ])('acepta %s con MIME y contenido válidos', (name, mime, buffer) => {
    expect(validator.validate(file(name, mime, buffer))).toEqual(
      expect.objectContaining({
        normalizedName: name,
        mimetype: mime,
      }),
    );
  });

  it('rechaza extensión permitida con MIME incompatible', () => {
    expect(() =>
      validator.validate(
        file('imagen.png', 'application/pdf', Buffer.from('%PDF-1.7')),
      ),
    ).toThrow(BadRequestException);
  });

  it('rechaza MIME permitido con magic bytes incompatibles', () => {
    expect(() =>
      validator.validate(
        file('documento.pdf', 'application/pdf', Buffer.from('no es un PDF')),
      ),
    ).toThrow(BadRequestException);
  });

  it.each([
    ['programa.exe', 'application/octet-stream'],
    ['script.js', 'text/javascript'],
    ['pagina.html', 'text/html'],
    ['vector.svg', 'image/svg+xml'],
    ['archivo.zip', 'application/zip'],
    ['archivo.rar', 'application/vnd.rar'],
    ['archivo.7z', 'application/x-7z-compressed'],
    [
      'documento.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  ])('rechaza tipo no permitido: %s', (name, mime) => {
    expect(() =>
      validator.validate(file(name, mime, Buffer.from('contenido'))),
    ).toThrow(BadRequestException);
  });

  it('rechaza extensión peligrosa intermedia aunque el PDF sea real', () => {
    expect(() =>
      validator.validate(
        file('factura.exe.pdf', 'application/pdf', Buffer.from('%PDF-1.7')),
      ),
    ).toThrow(BadRequestException);
  });

  it.each(['../secreto.txt', '..\\secreto.txt', 'carpeta/archivo.txt'])(
    'rechaza path traversal o separadores en el nombre: %s',
    (name) => {
      expect(() =>
        validator.validate(file(name, 'text/plain', Buffer.from('texto'))),
      ).toThrow(BadRequestException);
    },
  );

  it('rechaza controles y nombres mayores a 255 caracteres', () => {
    expect(() =>
      validator.validate(
        file('mal\u0000.txt', 'text/plain', Buffer.from('texto')),
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      validator.validate(
        file(`${'a'.repeat(252)}.txt`, 'text/plain', Buffer.from('texto')),
      ),
    ).toThrow(BadRequestException);
  });

  it('rechaza texto con bytes NUL o UTF-8 inválido', () => {
    expect(() =>
      validator.validate(
        file('datos.txt', 'text/plain', Buffer.from([0x61, 0x00, 0x62])),
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      validator.validate(
        file('datos.txt', 'text/plain', Buffer.from([0xc3, 0x28])),
      ),
    ).toThrow(BadRequestException);
  });

  it('normaliza Unicode NFC y trim del nombre', () => {
    const result = validator.validate(
      file('  cafe\u0301.txt  ', 'text/plain', Buffer.from('texto')),
    );

    expect(result.normalizedName).toBe('café.txt');
  });
});
