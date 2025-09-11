'use client';

import { useState, useRef } from 'react';
import axios from 'axios';
import { Message } from '../store/chatStore';
import { useAuth } from '../hooks/useAuth';

export default function ImageUploader({ chatId, onNewMessage }: { chatId: string; onNewMessage: (msg: Message) => void }) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploading(true);

    try {
      // 1. Получить предподписанный URL для загрузки файла в S3
      const { data } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/upload-url`, {
        params: { filename: file.name, filetype: file.type },
      });

      // 2. Загрузить файл в S3 по полученному URL
      // Если в URL есть лишний параметр x-amz-acl, убрать его (иногда бывает)
      const uploadUrl = data.url.split('&x-amz-acl=')[0];

      await axios.put(uploadUrl, file, {
        headers: {
          'Content-Type': file.type,
          // Если при генерации URL ACL был указан, раскомментируйте:
          // 'x-amz-acl': 'public-read',
        },
      });

      // 3. Отправить запрос на сохранение сообщения с ссылкой на загруженный файл
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No auth token');

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/chat/messages`,
        {
          chatId,
          content: data.fileUrl, // публичная ссылка на файл в S3
          type: 'image',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // 4. Обновить локальный стейт чата новым сообщением
      onNewMessage(response.data);
    } catch (error) {
      alert('Error loading file. Try again.');
    } finally {
      setUploading(false);
      // Очистить выбор файла для возможности загрузить снова один и тот же
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        aria-label="Upload image"
        className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
      >
       Upload photo
      </button>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={onFileChange}
      />
      {uploading && <p>Loading...</p>}
    </div>
  );
}
