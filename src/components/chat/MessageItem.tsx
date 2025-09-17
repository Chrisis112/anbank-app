'use client';

import classNames from 'classnames';
import { JSX, useState } from 'react';
import { Message } from '../../store/chatStore';
import { UserPreview } from './types';
import { ReactionPopover } from './ReactionPopover';
import { FaDownload } from 'react-icons/fa';

interface MessageItemProps {
  msg: Message;
  user: any; // текущий пользователь
  chatId: string;
  leftAddon?: React.ReactNode;
  sender?: UserPreview; // отправитель (из кэша)
  isMine: boolean;
  myUserId: string;
  onSelectChat?: (chatId: string) => void;
  addReaction: (msgId: string, reaction: string) => void;
  renderRole: (role?: string) => JSX.Element | null;
  onDownloadFile?: () => void;
  onDelete?: () => void; // Добавлено
}

export default function MessageItem({
  msg,
  user,
  sender,
  isMine,
  myUserId,
  onSelectChat = () => {}, // noop по умолчанию
  addReaction,
  renderRole,
  leftAddon,
  onDownloadFile,
  onDelete // Добавлено
}: MessageItemProps) {
  const [showReactions, setShowReactions] = useState(false);
  const mainRole = sender?.role || 'newbie';

  // Функция скачивания файла (для изображения)
  const downloadFile = () => {
    if (msg.type === 'image') {
      const filename = msg.content.split('/').pop() || 'file';
      const link = document.createElement('a');
      link.href = msg.content;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleAvatarClick = () => {
    if (!isMine && sender?.id && onSelectChat) {
      onSelectChat(sender.id);
    }
  };
  const handleMyAvatarClick = () => {
    if (isMine && user?.id && onSelectChat) {
      onSelectChat(user.id);
    }
  };
  const filteredReactions = Object.entries(msg.reactions ?? {}).filter(
    ([emoji, userIds]) =>
      Array.isArray(userIds) &&
      userIds.some(u => typeof u === 'string' && u.trim() !== ' ')
  );

  return (
    <div
      className={classNames('flex gap-2 w-full group relative', {
        'justify-end': isMine,
        'justify-start': !isMine,
      })}
    >
      {/* Аватар слева (чужое сообщение) с кликом открытия ЛС */}
      {!isMine && (
        <div
          className="flex-shrink-0 cursor-pointer hover:scale-110 transition"
          onClick={handleAvatarClick}
          title={`Открыть личный чат с ${sender?.nickname ?? 'пользователем'}`}
        >
          <div className="relative w-10 h-10 inline-block">
            <img
              src={sender?.photoUrl || '/default-avatar.png'}
              alt={sender?.nickname || ''}
              className="w-10 h-10 rounded-full object-cover border border-gray-500"
            />
            {/* Звезда: маленькая, строго поверх в нужном месте */}
            {leftAddon && (
              <span
                className="absolute bottom-0 right-0 z-10"
                style={{
                  transform: 'translate(40%, 40%)',
                  pointerEvents: 'none',
                  width: '14px',
                  height: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {leftAddon}
              </span>
            )}
          </div>
        </div>
      )}

      <div
        className={classNames('flex flex-col max-w-[70%]', {
          'items-end': isMine,
          'items-start': !isMine,
        })}
      >
        {/* Никнейм и роль */}
        <span className="text-xs mb-0 font-bold flex items-center gap-1">
          {isMine ? user.nickname || 'You' : sender?.nickname || 'Guest'}
          {renderRole(mainRole)}
          {/* Добавлена кнопка удаления для своих сообщений */}
          {isMine && onDelete && (
            <button
              className="ml-2 text-red-500 hover:text-red-700 focus:outline-none"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Удалить сообщение?')) {
                  onDelete();
                }
              }}
              aria-label="Delete message"
              title="Удалить сообщение"
            >
              🗑️
            </button>
          )}
        </span>

        {/* Бабл с текстом или изображением */}
        <div
          className={classNames(
            'p-2 rounded-lg max-w-xs break-words transition cursor-pointer group-hover:shadow-lg select-text',
            {
              'bg-indigo-600 text-white': isMine,
              'bg-gray-800 text-white': !isMine,
              'ring-[3px] ring-blue-400': showReactions,
            }
          )}
          style={{ wordBreak: 'break-word', position: 'relative' }}
          onClick={() => setShowReactions((prev) => !prev)}
        >
          {msg.type === 'text' && msg.content}

          {msg.type === 'image' && (
            <div className="relative">
              <img src={msg.content} alt="file" className="max-w-[200px] rounded" />
              {/* Кнопка скачивания */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadFile();
                }}
                title="Download file"
                aria-label="Download file"
                className="absolute top-1 right-1 p-1 bg-gray-600 rounded hover:bg-gray-500"
              >
                <FaDownload size={16} />
              </button>
            </div>
          )}

          {showReactions && (
            <ReactionPopover
              messageId={msg.id}
              isMine={isMine}
              messages={[msg]}
              myUserId={myUserId}
              addReaction={addReaction}
              onClose={() => setShowReactions(false)}
            />
          )}
        </div>

        {/* Реакции под сообщением */}
        <div className="flex gap-1 items-center mt-1 flex-wrap">
          {filteredReactions.map(([emoji, userIds]) => (
            <button
              key={emoji}
              type="button"
              className={classNames(
                'inline-flex items-center text-lg px-1 text-white/80 rounded-full bg-gray-700 shadow-sm border border-gray-600',
                { 'ring-2 ring-indigo-400': userIds.includes(myUserId) }
              )}
              onClick={() => addReaction(msg.id, emoji)}
              aria-label={`Reaction ${emoji}, total: ${userIds.length}`}
            >
              {emoji}
              <span className="text-xs text-white ml-1">{userIds.length}</span>
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-500 mt-1">{new Date(msg.createdAt).toLocaleTimeString()}</span>
      </div>

      {/* Аватар справа (свое сообщение) с кликом по своему аватару (опционально) */}
      {isMine && (
        <div
          className="flex-shrink-0 cursor-pointer hover:scale-110 transition"
          onClick={handleMyAvatarClick}
          title="Open Personal chat"
        >
          <img
            src={user.photoUrl || '/default-avatar.png'}
            alt={user.nickname}
            className="w-10 h-10 rounded-full object-cover border border-indigo-400"
          />
        </div>
      )}
    </div>
  );
}
