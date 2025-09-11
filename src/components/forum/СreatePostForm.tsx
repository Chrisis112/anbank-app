'use client';

import React, { useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Socket } from "socket.io-client";

interface Post {
  id: string;
  author: string;
  title: string;
  content: string;
  mainPhotoUrl?: string;
  extraPhotoUrls?: string[];
  createdAt?: string;
}

interface CreatePostFormProps {
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Partial<Post>;
  socket?: Socket | null;
  user?: any;
}

const MAX_EXTRA = 6;

export default function CreatePostForm({
  onClose,
  onSuccess,
  initialData,
  socket,
  user,
}: CreatePostFormProps) {
  const API = process.env.NEXT_PUBLIC_API_URL || "";

  const [title, setTitle] = React.useState(initialData?.title || "");
  const [content, setContent] = React.useState(initialData?.content || "");
  const [mainPhoto, setMainPhoto] = React.useState<File | null>(null);
  const [mainPhotoUrl, setMainPhotoUrl] = React.useState(initialData?.mainPhotoUrl || "");
  const [extraPhotos, setExtraPhotos] = React.useState<File[]>([]);
  const [extraPhotoUrls, setExtraPhotoUrls] = React.useState<string[]>(initialData?.extraPhotoUrls || []);
  const [creating, setCreating] = React.useState(false);

  // Обработка ошибок создания поста через socket
  useEffect(() => {
    if (!socket) return;

    const handlePostCreationError = ({ error }: { error: string }) => {
      toast.error(error);
      setCreating(false); // Разблокируем форму
    };

    const handleNewPost = (post: any) => {
      if (post.author === user?.nickname) {
        toast.success("Пост успешно создан!");
        onClose(); // Закрываем форму только при успешном создании
      }
    };

    socket.on('postCreationError', handlePostCreationError);
    socket.on('newPost', handleNewPost);

    return () => {
      socket.off('postCreationError', handlePostCreationError);
      socket.off('newPost', handleNewPost);
    };
  }, [socket, user?.nickname, onClose]);

  async function uploadFile(file: File): Promise<string> {
    const token = localStorage.getItem("token");
    const { data } = await axios.post(
      `${API}/forum/upload`,
      {},
      {
        params: { filename: file.name, filetype: file.type.split(";")[0].trim() },
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    await axios.put(data.url, file, { headers: { "Content-Type": file.type } });
    return data.fileUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  if (!user) return;

  if (!title || !content) {
    toast.error("Пожалуйста, заполните все обязательные поля");
    return;
  }

  if (!mainPhoto && !mainPhotoUrl && !initialData?.id) {
    toast.error("Главное фото обязательно");
    return;
  }
  setCreating(true);

  try {
    let uploadedMainPhotoUrl = mainPhotoUrl;
    if (mainPhoto) {
      uploadedMainPhotoUrl = await uploadFile(mainPhoto);
    }

    const uploadedUrls = [...extraPhotoUrls];
    for (const photo of extraPhotos) {
      const url = await uploadFile(photo);
      uploadedUrls.push(url);
    }
    const trimmedUrls = uploadedUrls.slice(0, MAX_EXTRA);

    const payload = {
      title,
      text: content,
      mainPhotoUrl: uploadedMainPhotoUrl,
      extraPhotoUrls: trimmedUrls,
    };

    if (initialData?.id) {
      // Обновление поста
      await axios.patch(`${API}/forum/posts/${initialData.id}`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      toast.success("Пост обновлен");
      onSuccess();
      onClose(); // закрываем при обновлении сразу
      setCreating(false); // ✅ ИСПРАВЛЕНИЕ: Разблокируем кнопку
    } else if (socket && user) {
      // Создание поста через socket
      socket.emit("createPost", {
        authorId: user.id,
        authorName: user.nickname,
        ...payload,
      });
      // НЕ вызываем onClose() и НЕ вызываем setCreating(false)!
      // Ждём события 'newPost' или 'postCreationError'
    } else {
      // fallback через REST API
      await axios.post(`${API}/forum/posts`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      toast.success("Пост создан");
      onSuccess();
      onClose(); // закрываем при успешном https запросе
      setCreating(false);
    }
  } catch (err: any) {
    // Обработка ошибки HTTP запроса
    const errorMessage = err.response?.data?.error || "Ошибка при сохранении";
    toast.error(errorMessage);
    setCreating(false); // ✅ Разблокируем кнопку при ошибке
  }
}


  function handleMainPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setMainPhoto(e.target.files[0]);
      setMainPhotoUrl("");
    }
  }

  function handleExtraPhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setExtraPhotos((prev) => [...prev, ...newFiles].slice(0, MAX_EXTRA));
      e.target.value = "";
    }
  }

  function removeExtraPhotoUrl(idx: number) {
    setExtraPhotoUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeExtraPhotoFile(idx: number) {
    setExtraPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-8 bg-gradient-to-br rounded-lg shadow-lg max-h-[90vh] overflow-auto">
      <h2 className="text-2xl mb-4 text-white">{initialData ? "Редактировать пост" : "Создать пост"}</h2>

      <input
        type="text"
        placeholder="Headline"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className="w-full mb-6 p-4 rounded-lg text-lg placeholder-purple-300 bg-purple-800 bg-opacity-70 text-white shadow-md focus:outline-none focus:ring-2 focus:ring-purple-600 transition"
      />

      <textarea
        placeholder="Text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        rows={5}
        className="w-full mb-6 p-4 rounded-lg text-lg placeholder-purple-300 bg-purple-800 bg-opacity-70 text-white shadow-md resize-none focus:outline-none focus:ring-2 focus:ring-purple-600 transition"
      />

      <div className="mb-4">
        <label className="block mb-2 text-white">Main Photo {initialData ? "(необязательно)" : "(обязательно)"}</label>
        <input type="file" accept="image/*" onChange={handleMainPhotoChange} required={!initialData?.id} />
        {mainPhoto ? (
          <img src={URL.createObjectURL(mainPhoto)} alt="preview" className="mt-2 max-h-32 rounded" />
        ) : mainPhotoUrl ? (
          <img src={mainPhotoUrl} alt="existing" className="mt-2 max-h-32 rounded" />
        ) : null}
      </div>

      <div className="mb-4">
        <label className="block mb-2 text-white">Additional photos (MAX {MAX_EXTRA})</label>
        <input type="file" accept="image/*" multiple onChange={handleExtraPhotosChange} />
        <div className="flex flex-wrap gap-2 mt-2">
          {extraPhotoUrls.map((url, idx) => (
            <div key={"url-" + idx} className="relative w-24 h-24 rounded border border-gray-600 overflow-hidden">
              <img src={url} alt={`extra ${idx + 1}`} className="object-cover w-full h-full" />
              <button
                type="button"
                onClick={() => removeExtraPhotoUrl(idx)}
                className="absolute top-0 right-0 bg-red-600 text-white p-1 rounded-bl hover:bg-red-700"
              >
                ×
              </button>
            </div>
          ))}
          {extraPhotos.map((file, idx) => (
            <div key={"file-" + idx} className="relative w-24 h-24 rounded-lg border-2 border-purple-600 shadow-lg overflow-hidden group">
              <img src={URL.createObjectURL(file)} alt={`new extra ${idx + 1}`} className="object-cover w-full h-full" />
              <button
                type="button"
                onClick={() => removeExtraPhotoFile(idx)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition bg-red-600 rounded-full p-1 text-white text-xl select-none hover:bg-red-700"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-6">
        <button
          onClick={onClose}
          type="button"
          className="px-6 py-2 font-semibold rounded-lg border-2 border-purple-700 text-purple-300 hover:text-indigo-400 hover:border-indigo-400 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={creating}
          className="px-8 py-2 font-bold rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:opacity-90 transition disabled:opacity-50"
        >
          {creating ? "Saving..." : initialData ? "Save" : "Create"}
        </button>
      </div>
    </form>
  );
}
