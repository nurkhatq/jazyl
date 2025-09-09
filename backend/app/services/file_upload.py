import os
import uuid
import aiofiles
from pathlib import Path
from typing import Optional
from fastapi import UploadFile, HTTPException
from PIL import Image
import io

class FileUploadService:
    def __init__(self):
        self.upload_dir = Path("uploads")
        self.masters_dir = self.upload_dir / "masters"
        self.max_file_size = 5 * 1024 * 1024  # 5MB
        self.allowed_extensions = {'.jpg', '.jpeg', '.png', '.webp'}
        
        # Создаем папки если их нет
        self.masters_dir.mkdir(parents=True, exist_ok=True)
    
    def _validate_image(self, file: UploadFile) -> None:
        """Валидация изображения"""
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        if file.size > self.max_file_size:
            raise HTTPException(status_code=400, detail="File size must be less than 5MB")
        
        # Проверяем расширение
        file_extension = Path(file.filename).suffix.lower() if file.filename else ''
        if file_extension not in self.allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Allowed extensions: {', '.join(self.allowed_extensions)}"
            )
    
    async def _optimize_image(self, file_data: bytes, max_size: tuple = (800, 800)) -> bytes:
        """Оптимизация изображения"""
        try:
            # Открываем изображение
            image = Image.open(io.BytesIO(file_data))
            
            # Конвертируем в RGB если нужно
            if image.mode in ('RGBA', 'LA', 'P'):
                image = image.convert('RGB')
            
            # Изменяем размер если больше максимального
            if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
                image.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # Сохраняем в байты
            output = io.BytesIO()
            image.save(output, format='JPEG', quality=85, optimize=True)
            return output.getvalue()
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")
    
    async def upload_master_photo(self, master_id: str, file: UploadFile) -> str:
        """Загрузка фото мастера"""
        self._validate_image(file)
        
        # Читаем файл
        file_data = await file.read()
        
        # Оптимизируем изображение
        optimized_data = await self._optimize_image(file_data)
        
        # Генерируем уникальное имя файла
        file_extension = '.jpg'  # Всегда сохраняем как JPEG
        filename = f"master_{master_id}_{uuid.uuid4().hex}{file_extension}"
        file_path = self.masters_dir / filename
        
        # Сохраняем файл
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(optimized_data)
        
        # Возвращаем URL
        return f"/uploads/masters/{filename}"
    
    async def delete_file(self, file_path: str) -> bool:
        """Удаление файла"""
        try:
            # Убираем ведущий слеш и создаем полный путь
            clean_path = file_path.lstrip('/')
            full_path = Path(clean_path)
            
            if full_path.exists():
                full_path.unlink()
                return True
            return False
        except Exception:
            return False
    
    def get_file_url(self, file_path: str) -> str:
        """Получение URL файла"""
        return f"{file_path}" if file_path.startswith('/') else f"/{file_path}"