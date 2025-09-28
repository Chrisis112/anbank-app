'use client';

import { useEffect, useRef, useState } from 'react';
import { Message, OnlineUser } from '../../store/chatStore';
import { useAuth } from '../../hooks/useAuth';
import { io, Socket } from 'socket.io-client';
import classNames from 'classnames';
import { FaPaperPlane, FaPlus } from 'react-icons/fa';
import axios from 'axios';
import MessageItem from '../../components/chat/MessageItem';
import { UserPreview } from '../../components/chat/types';
import StarIndicator from './StarIndicator';

const CRYPTO_EMOJIS = ['🟠', '🔵', '💎', '🪙', '📈', '🤑', '🤖'];

const ROLE_STYLES: Record<string, string> = {
  newbie: 'text-blue-400 neon-shadow-blue',
  creator: 'text-red-400 neon-shadow-red',
  advertiser: 'text-orange-400 neon-shadow-orange',
};

interface ChatContainerProps {
  otherUserId?: string;
  onlineUsers: OnlineUser[];
  chatId: string; // 'global' или id приватного чата
   onUserClick?: (userId: string) => void;  // возможно, уже есть
  onSelectUser?: (userId: string) => void;
}

export default function ChatContainer({ chatId, onlineUsers , otherUserId, onUserClick }: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userCache, setUserCache] = useState<Record<string, UserPreview>>({});
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const { user } = useAuth();
  const myUserId = user?.id || user?._id;
  const isPrivateChat = chatId !== 'global' && chatId !== '';

  // Форматирование сообщений
const convertPrivateMessageToMessage = (privateMsg: any): Message => {
  let reactionsObj = {};
  if (privateMsg.reactions) {
    if (privateMsg.reactions instanceof Map) {
      reactionsObj = Object.fromEntries(privateMsg.reactions);
    } else if (typeof privateMsg.reactions === "object") {
      reactionsObj = privateMsg.reactions;
    }
  }

  return {
    id: privateMsg._id || privateMsg.id,
    senderId: privateMsg.senderId,
    chatId: privateMsg.chatId, // берем строго из модели
    content: privateMsg.content,
    type: privateMsg.type || "text",
    createdAt: privateMsg.timestamp || privateMsg.createdAt,
    reactions: reactionsObj,
  };
};

    const convertCountToArray = (counts: Record<string, number>): Record<string, string[]> => {
  const newReactions: Record<string, string[]> = {};
  for (const key in counts) {
    const count = counts[key];
    // Создадим "заглушку" — массив c пустыми элементами для совместимости типов
    // Можно оставить пустой массив, если реальное содержимое не критично
    newReactions[key] = new Array(count).fill('');
  }
  return newReactions;
};

const deleteMessage = async (messageId: string) => {
  if (!user) return;

  try {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No auth token');

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';

    await axios.delete(`${baseUrl}/chat/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Локально обновляем список сообщений
    setMessages(prev => prev.filter(msg => msg.id !== messageId));

    // Отправьте событие сокетам, если нужно оповестить других об удалении
    socketRef.current?.emit('deleteMessage', { messageId, chatId });

  } catch (error) {
    alert('Error deleting message');
  }
};

const chatIdRef = useRef(chatId);

useEffect(() => {
  chatIdRef.current = chatId;
}, [chatId]);

// Инициализация и подписка сокета (зависит только от user)
useEffect(() => {
  if (!user) return;

  const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || '', {
    query: {
      userId: user.id || user._id,
      room: chatIdRef.current,
    },
    transports: ['websocket'],
    withCredentials: true,
  });

  socketRef.current = socket;

  socket.on('connect', () => {
    socket.emit('joinChat', chatIdRef.current);
  });

  socket.on('newMessage', (msg: Message) => {
    if (msg.chatId !== chatIdRef.current) return;
    const messageWithId = {
      ...msg,
      id: msg.id ?? (msg as any)._id,
    };
    setMessages((prev) => [...prev, messageWithId]);
  });

  socket.on('broadcastMessage', (msg: Message) => {
    if (msg.chatId !== chatIdRef.current) return;
    setMessages((prev) => [...prev, msg]);
  });

  const handleReactionUpdate = ({ messageId, reactions }: { messageId: string; reactions: Record<string, number> }) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        return { ...m, reactions: convertCountToArray(reactions) };
      })
    );
  };

  socket.on('message-reaction-update', handleReactionUpdate);

  return () => {
    socket.off('message-reaction-update', handleReactionUpdate);
    socket.disconnect();
    socketRef.current = null;
  };
}, [user]);

// При изменении chatId сообщаем сокету перейти в другую комнату
useEffect(() => {
  if (socketRef.current && socketRef.current.connected) {
    socketRef.current.emit('joinChat', chatId);
    chatIdRef.current = chatId; // Обновляем ref тут для безопасности
  }
}, [chatId]);


const addReaction = (msgId: string | undefined, reaction: string) => {
  if (!user || !msgId) {
    alert("Error: Unable to determine message for reaction");
    return;
  }
  const currentUserId = user.id || user._id;

  // Отправляем событие на сервер через сокет
  socketRef.current?.emit("reactMessage", {
    messageId: msgId,
    reaction,
    userId: currentUserId,
    isPrivate: chatId !== 'global',
    otherUserId: chatId !== 'global' ? chatId : "",
  });

  // Опционально, здесь можно сделать оптимистичное обновление локального состояния,
  // либо полностью полагаться на обновление из сокета

  // Ниже — обновление локального состояния (опционально)
  setMessages((msgs) =>
    msgs.map((m) => {
      if (m.id !== msgId) return m;

      const newReactions = { ...(m.reactions ?? {}) };

      let oldReactionKey: string | null = null;
      for (const key in newReactions) {
        if (newReactions[key].includes(currentUserId)) {
          oldReactionKey = key;
          break;
        }
      }

      if (oldReactionKey === reaction) {
        const filtered = newReactions[reaction].filter((u) => u !== currentUserId);
        if (filtered.length === 0) {
          delete newReactions[reaction];
        } else {
          newReactions[reaction] = filtered;
        }
      } else {
        if (oldReactionKey) {
          const filtered = newReactions[oldReactionKey].filter((u) => u !== currentUserId);
          if (filtered.length === 0) {
            delete newReactions[oldReactionKey];
          } else {
            newReactions[oldReactionKey] = filtered;
          }
        }
        if (newReactions[reaction]) {
          newReactions[reaction] = [...newReactions[reaction], currentUserId];
        } else {
          newReactions[reaction] = [currentUserId];
        }
      }
      // Очистка пустых реакций
for (const key in newReactions) {
  const users = newReactions[key];
  const realUsers = users.filter(u => typeof u === 'string' && u.trim() !== '');
  if (realUsers.length === 0) {
    delete newReactions[key];
  } else {
    newReactions[key] = realUsers;
  }
}
      return { ...m, reactions: newReactions };
    })
  );
};



  const renderRole = (role?: string) =>
    role ? (
      <span
        className={classNames(
          'ml-2 px-2 py-0.5 rounded uppercase tracking-widest text-xs font-bold opacity-80 align-middle',
          ROLE_STYLES[role] || 'text-blue-300'
        )}
        style={{ fontSize: '0.58em' }}
      >
        {role}
      </span>
    ) : null;

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

useEffect(() => {
  if (!user) return;

  const fetchMessages = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const token = localStorage.getItem('token');
      if (!token) return;

      let data;
      if (isPrivateChat && chatId) {
  const response = await axios.get(`${baseUrl}/private/messages/chat/${chatId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  data = response.data.map(convertPrivateMessageToMessage);
} else {
        const response = await axios.get(`${baseUrl}/chat/messages/global`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        data = response.data.map((msg: any) => ({ ...msg, id: msg.id ?? msg._id }));
      }
      setMessages(data);

      const ids: string[] = data.map((m: { senderId: any }) => m.senderId).filter(Boolean);
      fetchUsersInfo(Array.from(new Set(ids)));
    } catch (error) {
      setMessages([]);
    }
  };

  fetchMessages();
}, [chatId, user]);


  async function fetchUsersInfo(ids: string[]) {
    const unknownIds = ids.filter(id => !userCache[id]);
    if (!unknownIds.length) return;
    try {
      const api = process.env.NEXT_PUBLIC_API_URL || '';
      const results = await Promise.all(
        unknownIds.map(id =>
          axios
            .get<UserPreview>(`${api}/users/${id}`)
            .then(r => ({ ...r.data, id }))
            .catch(() => null)
        )
      );
      const upd: Record<string, UserPreview> = {};
      results.forEach(u => {
        if (u && u.id)
          upd[u.id] = {
            id: u.id,
            nickname: u.nickname || `user-${u.id.slice(-4)}`,
            photoUrl: u.photoUrl || u.avatar,
            role: Array.isArray(u.role) ? u.role[0] : u.role,
          };
      });
      setUserCache(prev => ({ ...prev, ...upd }));
    } catch {}
  }


// Отдельный эффект, чтобы следить за изменением chatId и переключать комнаты
useEffect(() => {
  if(socketRef.current && socketRef.current.connected) {
    socketRef.current.emit('join', chatId);
  }
}, [chatId]);

const sendMessage = () => {
  if (!newMessage.trim() || !user || !socketRef.current?.connected) return;
  const senderId = user.id || user._id;

  if (!chatId) {
    alert('chatId is not defined');
    return;
  }

  const messageData = {
    chatId,
    senderId,
    content: newMessage.trim(),
    type: 'text',
  };

  socketRef.current.emit('sendMessage', messageData);

  setNewMessage('');
  setShowEmojiPanel(false);
};

const textareaRef = useRef<HTMLTextAreaElement>(null);
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === "Enter" && e.shiftKey) {
    // Shift+Enter — добавить перенос строки в позицию курсора
    e.preventDefault();
    const { selectionStart, selectionEnd } = e.currentTarget;
    const value = newMessage;
    setNewMessage(
      value.substring(0, selectionStart) + "\n" + value.substring(selectionEnd)
    );
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd =
          (selectionStart ?? 0) + 1;
        textareaRef.current.focus();
      }
    }, 0);
    return;
  }
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
};
const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  if (!user || !e.target.files || e.target.files.length === 0) return;
  const file = e.target.files[0];
  setUploading(true);

  try {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No auth token');
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const { data } = await axios.get(`${baseUrl}/upload-url`, {
      params: { filename: file.name, filetype: file.type },
      headers: { Authorization: `Bearer ${token}` },
    });

    const uploadUrl = data.url.split('&x-amz-acl=')[0];
    await axios.put(uploadUrl, file, {
      headers: { 'Content-Type': file.type },
    });

    let response;
    if (isPrivateChat) {
      if (!otherUserId) {
        alert('Invalid chatId');
        setUploading(false);
        return;
      }

      response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/private/messages`,
        {
          receiverId: otherUserId,
          content: data.fileUrl,
          type: 'image',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      socketRef.current?.emit('broadcastMessage', response.data);
    } else {
      response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/chat/messages`,
        {
          chatId: 'global',
          content: data.fileUrl,
          type: 'image',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      socketRef.current?.emit('broadcastMessage', response.data);
    }
  } catch (error) {
    alert('Error loading file. Try again.');
  } finally {
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
};



  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Authorization is required to use the chat.
      </div>
    );
  }

  return (
     <div className="flex flex-col w-full h-full bg-gray-900 text-white">
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
{messages.map(msg => {
  const isSenderOnline = Array.isArray(onlineUsers)
    ? onlineUsers.some(u => u.id === msg.senderId)
    : false;

  return (

        <MessageItem
          key={msg.id}
          msg={msg}
          user={user}
          sender={userCache[msg.senderId]}
          isMine={msg.senderId === myUserId}
          leftAddon={isSenderOnline ? <StarIndicator /> : null}
          myUserId={myUserId}
          chatId={msg.chatId}  
          onDelete={() => deleteMessage(msg.id)}                  // Передаем chatId в MessageItem
          onSelectChat={onUserClick}             // Ожидается, что onUserClick принимает chatId
          addReaction={addReaction}
          renderRole={renderRole}
          onDownloadFile={() => {
            if (msg.type === "image") {
              const filename = msg.content.split("/").pop() || "file";
              const link = document.createElement("a");
              link.href = msg.content;
              link.download = filename;
              link.target = "_blank";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          }}
        />
  );
})}
      <div ref={messageEndRef} />
    </div>

      <div className="flex items-center p-3 border-t border-gray-700 gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
          disabled={uploading}
          aria-label="Upload image"
        >
          <FaPlus />
        </button>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={onFileChange}
        />

        <div className="relative flex-grow">
<textarea
  ref={textareaRef}
  value={newMessage}
  onChange={e => setNewMessage(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder="Write a message..."
  className="p-2 rounded-lg bg-gray-800 border border-gray-700 outline-none w-full resize-none"
  rows={2}
/>

          <button
            className="absolute right-1 top-1 hover:scale-110"
            onClick={() => setShowEmojiPanel(e => !e)}
            type="button"
            aria-label="Toggle emoji panel"
          >
            😄
          </button>

          {showEmojiPanel && (
            <div
              className="absolute z-10 bottom-full left-0 mb-2 bg-gray-800 shadow-lg rounded-xl p-2 flex flex-wrap gap-1 animate-fade-in"
              role="list"
            >
              {CRYPTO_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  className="text-2xl hover:scale-125 transition"
                  onClick={() => setNewMessage(m => m + emoji)}
                  aria-label={`Add emoji ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={sendMessage}
          className="p-2 bg-indigo-600 rounded-lg hover:bg-indigo-500"
          disabled={!newMessage.trim()}
          aria-label="Send message"
        >
          <FaPaperPlane />
        </button>
      </div>

      {uploading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-4 rounded-lg">Image Uploading...</div>
        </div>
      )}

      <style jsx global>{`
        .neon-shadow-blue {
          text-shadow: 0 0 2px #3f90ff, 0 0 7px #3f90ff, 0 0 14px #2563eb;
        }
        .neon-shadow-red {
          text-shadow: 0 0 3px #ff3f57, 0 0 6px #ff3f57, 0 0 18px #b91c1c;
        }
        .neon-shadow-orange {
          text-shadow: 0 0 2px #fad02e, 0 0 9px #faad2e, 0 0 18px #f59e42;
        }
        .neon-hover:hover {
          filter: brightness(1.2) drop-shadow(0 0 8px #25ffe9);
        }
        .animate-fade-in {
          animation: fadeIn 0.18s cubic-bezier(0.76, 0.02, 0.8, 1) both;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.6);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
