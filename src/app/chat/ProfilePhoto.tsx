'use client';

import { useState, useRef } from "react";
import axios from "axios";
import { useTranslation } from 'react-i18next';

interface ProfilePhotoProps {
  currentPhotoUrl?: string;
  onUpload?: (url: string) => void;
}

export default function ProfilePhoto({ currentPhotoUrl, onUpload }: ProfilePhotoProps) {
  const { t } = useTranslation();

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getShortFileName = (file?: File | null) => {
    if (!file) return "";
    const name = file.name;
    return name.length > 24
      ? name.slice(0, 16) + "..." + name.slice(-8)
      : name;
  };

  const handlePhotoClick = () => {
    if (window.confirm(t('confirm_change_photo', 'Do you wana change prfile photo?'))) {
      if (inputRef.current) {
        inputRef.current.value = ""; // сброс, чтобы можно было выбрать тот же файл
      }
      inputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
  };

  const handleUpload = async () => {
    if (!file) return;

    const token = localStorage.getItem("token");
    if (!token) {
      alert(t('error_not_authorized', 'You are not authorized.'));
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    setLoading(true);
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/users/me/photo`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const photoUrl = res.data.photoUrl;
      onUpload?.(photoUrl);
      setFile(null); // сброс
    } catch (error) {
      alert(t('error_upload_failed', 'File upploading error.'));
      if (error instanceof Error) {
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6">

      {currentPhotoUrl && (
        <div
          className="relative w-24 h-24 mb-3 group mx-auto cursor-pointer select-none"
          onClick={handlePhotoClick}
          role="button"
          tabIndex={0}
          aria-label={t('profile_photo_edit_label', 'Change Profile Photo')}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handlePhotoClick();
            }
          }}
        >
          <img
            src={currentPhotoUrl}
            alt={t('profile_photo_alt', 'Profile Photo')}
            className="w-24 h-24 object-cover rounded-full border transition"
            draggable={false}
          />
          <div
            className="absolute inset-0 bg-black bg-opacity-40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
            aria-hidden="true"
          >
            <span
              className="text-white text-4xl font-bold pointer-events-none select-none transition-transform duration-150 scale-100 group-hover:scale-125"
            >+</span>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {file && (
        <div className="flex flex-col items-center mb-4">
          <div
            className="
              max-w-[220px] text-center truncate 
              px-2 py-1 mb-2 border border-gray-300 rounded
              bg-gray-50 text-gray-800 text-sm font-medium
            "
            title={file.name}
          >
            {getShortFileName(file)}
          </div>
          <button
            onClick={handleUpload}
            disabled={loading}
            className={`bg-indigo-600 text-white px-4 py-2 rounded transition hover:bg-indigo-700
              ${loading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {loading ? t('loading', 'Loading...') : t('save', 'Save')}
          </button>
        </div>
      )}

      {!currentPhotoUrl && !file && (
        <button
          onClick={() => inputRef.current?.click()}
          className="bg-indigo-600 text-white px-4 py-2 rounded transition hover:bg-indigo-700 cursor-pointer"
          aria-label={t('upload_profile_photo', 'Upload Profile Photo')}
        >
          {t('upload_profile_photo', 'Upload Profile Photo')}
        </button>
      )}
    </div>
  );
}
