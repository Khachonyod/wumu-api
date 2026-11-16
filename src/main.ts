import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // ตัดฟิลด์แปลกปลอมที่ไม่ได้ประกาศใน DTO ทิ้งอัตโนมัติ
      transform: true, // แปลงชนิดข้อมูล (เช่น query string "500" -> number 500)
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
