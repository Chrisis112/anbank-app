'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import ChatContainer from '../../components/chat/ChatContainer';
import CryptoBackground from '../../components/layout/CryptoBackground';
import ProfilePhoto from './ProfilePhoto';
import Header from '../../components/layout/Header';
import { FaUserFriends, FaEnvelope, FaSignOutAlt, FaTimes, FaUser, FaCog, FaCoins } from 'react-icons/fa';
import axios from 'axios';
import { io, Socket } from "socket.io-client";
import TokenCreator from '@/components/token/tokenCreator';// Импорт компонента TokenCreator
import { useRef } from "react";
import PromoCodeManager from '@/components/auth/PromoCodeManager';
import StarIndicator from '@/components/chat/StarIndicator';
const API = process.env.NEXT_PUBLIC_API_URL || '';

interface PrivateChat {
  otherId: any;
  otherUserId: string;
  id: string;
  chatId: string;
  nickname?: string;
  avatar?: string | null;
  role?: 'newbie' | 'advertiser' | 'creator'| 'admin';
  lastMessage: string;
  timestamp: string;
}

interface OnlineUser {
  role: string;
  id: string;
  nickname: string;
}

interface UserProfile {
  id: string;
  nickname: string;
  email: string;
  avatar?: string;
  role: 'newbie' | 'advertiser' | 'creator' | 'admin';
  hideOnline?: boolean;
}

export default function ChatPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [panelOpen, setPanelOpen] = useState<boolean>(false);
  const [panelType, setPanelType] = useState<'pm' | 'online' | 'profile' | 'admin' | null>(null);
  const socket = useRef<Socket | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [selectedOtherUserId, setSelectedOtherUserId] = useState<string | null>(null);
  const [hideOnline, setHideOnline] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserProfile['role']>('newbie');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined);
  const [privateChats, setPrivateChats] = useState<PrivateChat[]>([]);
  // Проверка, является ли пользователь админом
const isAdmin = user?.role?.includes('admin') ?? false;


  // ... все остальные useEffect и функции остаются без изменений ...

  useEffect(() => {
    if (panelType === 'pm' && user) {
      fetchPrivateChats();
    }
  }, [panelType, user]);

  const deleteChat = async (otherUserId: string) => {
    if (!otherUserId) return;

    if (!confirm('Are you sure you want to delete this chat and all messages?')) return;

    let isLoading = true;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authorization required');
        return;
      }

      await axios.delete(`${API}/private/chats/${otherUserId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      await fetchPrivateChats();

      if (selectedOtherUserId && selectedOtherUserId === otherUserId) {
        setSelectedChatId(null);
        setSelectedOtherUserId(null);
      }

      alert('Chat and all messages have been successfully deleted');
    } catch (error: any) {
      if (error.response?.status === 404) {
        await fetchPrivateChats();
      } else {
        alert('Failed to delete chat');
      }
    } finally {
      isLoading = false;
    }
  };

  useEffect(() => {
    if (!user) return;

    socket.current = io(process.env.NEXT_PUBLIC_SOCKET_URL || '', {
      withCredentials: true,
      transports: ['websocket'],
      auth: {
        token: localStorage.getItem("token"),
      },
    });

    socket.current.on("connect", () => {
      if (socket.current && user) {
        socket.current.emit("authenticate", {
          userId: user.id,
          nickname: user.nickname,
          avatar: user.avatar,
          role: user.role,
        });
      }
    });

    socket.current.on("onlineUsersUpdated", (users: any[]) => {
      const normalizedUsers = users
        .filter(u => !u.hideOnline)
        .map(u => ({
          id: u.userId,
          nickname: u.nickname,
          role: Array.isArray(u.role) ? u.role[0] : u.role || 'newbie',
        }));
      setOnlineUsers(normalizedUsers);
    });

    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [user]);

  async function handleHideOnlineChange(checked: boolean) {
    setHideOnline(checked);

    if (!profile) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authorization required');
        setHideOnline(!checked);
        return;
      }

      await axios.patch(
        `${API}/users/${profile.id}`,
        {
          nickname,
          role: [role],
          hideOnline: checked
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      alert('Failed to save the setting');
      setHideOnline(!checked);
    }
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (panelType === 'profile' && user?.id) {
      loadProfile();
    }
  }, [panelType, user]);

  async function loadProfile() {
    if (!user) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setProfileError('No token (logout/login again)');
        setProfileLoading(false);
        return;
      }
      const res = await axios.get(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data;

      setProfile({
        id: data.id || data._id,
        nickname: data.nickname,
        email: data.email,
        avatar: data.avatar,
        role: Array.isArray(data.role) ? data.role[0] || 'newbie' : data.role || 'newbie',
        hideOnline: data.hideOnline || false,
      });

      setNickname(data.nickname);
      setEmail(data.email);
      setRole(Array.isArray(data.role) ? data.role[0] || 'newbie' : data.role || 'newbie');
      setHideOnline(data.hideOnline || false);
      setAvatarPreview(data.avatar);
    } catch (e) {
      setProfileError('Error loading profile');
    } finally {
      setProfileLoading(false);
    }
  }

  async function checkNicknameUnique(nick: string): Promise<boolean> {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`${API}/users/check-nickname?nickname=${encodeURIComponent(nick)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data.unique;
    } catch {
      return false;
    }
  }

  async function handleSaveProfile() {
    if (!profile) return;

    if (nickname !== profile.nickname) {
      const uniqueNick = await checkNicknameUnique(nickname);
      if (!uniqueNick) {
        alert('This nickname is already taken.');
        return;
      }
    }

    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API}/users/${profile.id}`,
        {
          nickname,
          role: [role],
          hideOnline,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      alert('Profile updated successfully');
      setPanelOpen(false);
    } catch (e) {
      alert('Failed to profile update');
    }
  }

  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setAvatarFile(e.target.files[0]);
      const url = URL.createObjectURL(e.target.files[0]);
      setAvatarPreview(url);
    }
  }

  const openChat = async (userId: string) => {
    if (!user || !userId) return;

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Authorization required');
      return;
    }

    let chat = privateChats.find(c => c.otherUserId === userId);

    try {
      if (!chat) {
        const res = await axios.post<PrivateChat>(
          `${API}/private/chats/create-or-get`,
          { otherUserId: userId },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        chat = res.data;
        if (!chat) throw new Error('Empty response from server');

        await fetchPrivateChats();
      }

      setSelectedOtherUserId(chat.otherUserId);
      setSelectedChatId(chat.chatId);

      setPanelOpen(false);
      setPanelType(null);

    } catch (e) {
      alert('Failed to open chat');
    }
  };

  async function fetchPrivateChats() {
    if (!user?.id) return;

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Authorization required');
      return;
    }

    try {
      const res = await axios.get<PrivateChat[]>(`${API}/chat/private-chats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let chats = res.data || [];
      chats = chats.filter(chat => chat.otherUserId && chat.chatId);

      if (!chats.some(chat => chat.otherUserId === user.id)) {
        const createdChat = await axios.post<PrivateChat>(
          `${API}/private/chats/create-or-get`,
          { otherUserId: user.id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (createdChat.data && createdChat.data.chatId) {
          chats.push(createdChat.data);
        }
      }

      chats = chats.map(chat => {
        if (chat.otherUserId === user.id) {
          return {
            ...chat,
            nickname: user.nickname,
            avatar: user.avatar || '/default-avatar.png',
            role: Array.isArray(user.role) ? user.role[0] : user.role,
            lastMessage: chat.lastMessage || 'Нет сообщений',
            timestamp: chat.timestamp || new Date().toISOString(),
          };
        }
        return chat;
      });

      setPrivateChats(chats);
    } catch (err) {
      setPrivateChats([]);
    }
  }

  const openChatWithUser = (userId: string) => {
    openChat(userId);
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        await axios.post(`${API}/chat/offline`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      if (socket.current) {
        socket.current.disconnect();
      }
    } catch (err) {
    } finally {
      logout();
      router.push("/");
    }
  };

  function openPanel(type: 'pm' | 'online' | 'profile' | 'admin') {
    setPanelType(type);
    setPanelOpen(true);
  }

  function closeChat() {
    setSelectedChatId(null);
  }

  function closePanel() {
    setPanelOpen(false);
    setPanelType(null);
    setSelectedChatId(null);
  }
  const [showTokenCreator, setShowTokenCreator] = useState(false);

 function UserProfilePanel({
    profile,
    loading,
    error,
    nickname,
    email,
    onLogout,
    role,
    hideOnline,
  }: {
    profile: UserProfile | null;
    loading: boolean;
    error: string | null;
    nickname: string;
    setNickname: (val: string) => void;
    email: string;
    role: UserProfile['role'];
    setRole: (val: UserProfile['role']) => void;
    onSave: () => void;
    onLogout: () => void;
    avatarPreview?: string;
    onAvatarChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    avatarFile?: File | null;
    setAvatarFile?: (file: File | null) => void;
    hideOnline: boolean;
    setHideOnline: (hide: boolean) => void;
  }) {
    const { user } = useAuth();

    if (loading) return <div className="p-4 text-white text-center">Loading...</div>;
    if (error) return <div className="p-4 text-red-500 text-center">{error}</div>;
    if (!profile) return <div className="p-4 text-white text-center">Profile not found</div>;

    const photoUrl = user?.photoUrl || profile.avatar;

    return (
      <div className="p-6 text-white flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-160px)]">
        {!showTokenCreator ? (
          <>
            <div className="flex flex-col items-center mb-4">
              <ProfilePhoto currentPhotoUrl={photoUrl} onUpload={() => window.location.reload()} />
            </div>

            <label className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={hideOnline}
                onChange={e => handleHideOnlineChange(e.target.checked)}
              />
              <span>Don't show me in online users</span>
            </label>

            <label className="flex flex-col font-semibold">
              Nickname
              <input
                type="text"
                value={nickname}
                readOnly
                disabled
                className="p-2 rounded text-black"
              />
            </label>

            <label className="flex flex-col font-semibold">
              Email
              <input
                type="email"
                value={email}
                readOnly
                disabled
                className="p-2 rounded text-black bg-gray-200"
              />
            </label>

            <label className="flex flex-col font-semibold">
              Role
              <input
                type="text"
                value={role}
                readOnly
                disabled
                className="p-2 rounded text-black bg-gray-200"
              />
            </label>

            <button
              onClick={onLogout}
              className="flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-2 md:px-3 py-2 md:py-3 rounded-lg bg-red-600 text-white font-orbitron text-base md:text-lg font-semibold transition hover:bg-red-700"
            >
              <FaSignOutAlt className="text-white" />
              <span className="hidden md:inline">Logout</span>
              <span className="inline md:hidden">Logout</span>
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-orbitron font-bold text-crypto-accent">Token creation</h3>
              <button
                onClick={() => setShowTokenCreator(false)}
                className="p-2 text-gray-400 hover:text-white transition"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <TokenCreator
              onTokenCreated={address => {
                alert(`The token has been successfully created!\nАдрес: ${address}`);
                setShowTokenCreator(false);
              }}
            />
          </>
        )}
      </div>
    );
  }

  // Стилизованный компонент AdminPanel для PromoCodeManager
  function AdminPanel() {
    return (
      <div className="h-full w-full bg-crypto-dark text-white">
        <div className="p-4 border-b border-crypto-accent">
          <h2 className="text-xl font-orbitron text-crypto-accent font-semibold">
           Admin Panel
          </h2>
        </div>
        <div className="h-[calc(100%-60px)] overflow-auto">
          <div className="p-4">
            <PromoCodeManager />
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen flex flex-col bg-crypto-dark relative">
      <CryptoBackground />
      <div className="absolute inset-0 bg-gradient-to-br from-crypto-accent/5 via-transparent to-blue-500/5 pointer-events-none"></div>

      <div className="relative z-10">
        <Header />
      </div>

      <div className="relative z-10 flex flex-1 flex-col md:flex-row overflow-hidden">
<nav
  className="
    w-full md:w-64 min-w-[220px] 
    bg-gradient-to-br from-crypto-input to-crypto-dark border-b md:border-b-0 md:border-r border-crypto-accent 
    px-2 md:px-4 py-2 md:py-8 flex flex-wrap md:flex-col gap-1 md:gap-3 items-center justify-center md:justify-start
  "
>
  <button
    onClick={closeChat}
    className="
      w-[48%] md:w-full flex items-center justify-center md:justify-start
      gap-1 md:gap-3 px-2 py-2 md:px-3 md:py-3 rounded-lg font-orbitron
      text-xs md:text-lg font-semibold transition bg-transparent text-gray-300
      hover:bg-blue-700 hover:text-white truncate
    "
  >
    General
  </button>

  <button
    onClick={() => {
      setPanelType('profile');
      setPanelOpen(true);
      setShowTokenCreator(true);
    }}
    className="
      w-[48%] md:w-full flex items-center justify-center md:justify-start
      gap-1 md:gap-3 px-2 py-2 md:px-3 md:py-3 rounded-lg font-orbitron
      text-xs md:text-lg font-semibold transition
      bg-gradient-to-r from-crypto-accent to-blue-500 text-crypto-dark md:text-gray-300
      hover:opacity-90 truncate
    "
  >
    <FaCoins className="text-crypto-dark md:text-crypto-accent" />
    <span className="truncate">Create</span>
    <span className="hidden md:inline"> a token</span>
  </button>

  <button
    onClick={() => openPanel('pm')}
    className={`
      w-[24%] md:w-full flex items-center justify-center md:justify-start
      gap-1 md:gap-3 px-2 py-2 md:px-3 md:py-3 rounded-lg font-orbitron 
      text-xs md:text-lg font-semibold transition 
      ${panelOpen && panelType === 'pm'
        ? 'bg-[linear-gradient(90deg,#21e0ff_0%,#192342_100%)] text-white'
        : 'bg-transparent text-gray-300 hover:bg-blue-900 hover:text-white'}
      truncate
    `}
  >
    <FaEnvelope className="text-crypto-accent" />
    <span className="truncate">PM</span>
    <span className="hidden md:inline"> Personal</span>
  </button>

  <button
    onClick={() => openPanel('online')}
    className={`
      w-[24%] md:w-full flex items-center justify-center md:justify-start
      gap-1 md:gap-3 px-2 py-2 md:px-3 md:py-3 rounded-lg font-orbitron 
      text-xs md:text-lg font-semibold transition
      ${panelOpen && panelType === 'online'
        ? 'bg-[linear-gradient(90deg,#21e0ff_0%,#192342_100%)] text-white'
        : 'bg-transparent text-gray-300 hover:bg-blue-900 hover:text-white'}
      truncate
    `}
  >
    <FaUserFriends className="text-crypto-accent" />
    <span className="truncate">Online</span>
    <span className="hidden md:inline"> Users</span>
  </button>

  <button
    onClick={() => openPanel('profile')}
    className={`
      w-[24%] md:w-full flex items-center justify-center md:justify-start
      gap-1 md:gap-3 px-2 py-2 md:px-3 md:py-3 rounded-lg font-orbitron 
      text-xs md:text-lg font-semibold transition
      ${panelOpen && panelType === 'profile'
        ? 'bg-[linear-gradient(90deg,#21e0ff_0%,#00c0ff_100%)] text-white'
        : 'bg-transparent text-gray-300 hover:bg-blue-500 hover:text-white'}
      truncate
    `}
  >
    <FaUser className="text-crypto-accent" />
    <span className="truncate">Profile</span>
  </button>

  {isAdmin && (
    <button
      onClick={() => openPanel('admin')}
      className={`
        w-[48%] md:w-full flex items-center justify-center md:justify-start
        gap-1 md:gap-3 px-2 py-2 md:px-3 md:py-3 rounded-lg font-orbitron 
        text-xs md:text-lg font-semibold transition
        ${panelOpen && panelType === 'admin'
          ? 'bg-[linear-gradient(90deg,#ff6b35_0%,#f7931e_100%)] text-white'
          : 'bg-transparent text-gray-300 hover:bg-orange-600 hover:text-white'}
        truncate
      `}
    >
      <FaCog className="text-orange-400" />
      <span className="truncate">Admin</span>
      <span className="hidden md:inline"> Panel</span>
    </button>
  )}
</nav>

        <div className="relative z-10 flex flex-1 flex-col md:flex-row overflow-hidden">
          {panelOpen && panelType && (
            <div className={`absolute top-2 right-2 z-20 ${panelType === 'admin' ? 'w-full h-full' : 'w-[320px] max-w-full'} bg-crypto-dark/95 border border-crypto-accent rounded-lg shadow-lg flex flex-col`}>
              <button
                onClick={closePanel}
                className="self-end m-2 p-1 text-crypto-accent hover:text-white transition"
                aria-label="Close Panel"
              >
                <FaTimes size={20} />
              </button>

             {panelType === 'pm' && (
  <>
    <div className="px-6 pb-2 text-white font-orbitron font-semibold text-xl border-b border-crypto-accent">
      Personal Messages
    </div>
    <div className="flex flex-col flex-grow p-4 overflow-auto max-h-[calc(100vh-140px)]">
      {privateChats.length === 0 ? (
        <div className="text-gray-400 text-center py-4">No Personal Messages</div>
      ) : (
        privateChats.map((chat) => (
          <div
            key={`${chat.chatId}_${chat.otherUserId}`}
            className="flex items-center justify-between w-full p-3 mb-2 rounded-lg border border-crypto-accent bg-crypto-input hover:bg-crypto-accent/20 cursor-pointer transition"
          >
            <button
              onClick={() => openChat(chat.otherUserId)}
              className="flex items-center gap-3 flex-1 text-left"
            >
              <img
                src={chat.avatar || '/default-avatar.png'}
                alt={chat.nickname || 'User'}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-white truncate">
                  {chat.nickname || `User ${chat.otherUserId.slice(-4)}`}
                </span>
                <span className="text-sm text-gray-300">
                  {chat.role || 'newbie'}
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  {chat.timestamp ? new Date(chat.timestamp).toLocaleString() : '—'}
                </span>
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteChat(chat.otherUserId);
              }}
              className="ml-2 p-1 text-red-500 hover:text-red-700"
              aria-label="Delete Chat"
              title="Delete Chat"
            >
              <FaTimes size={18} />
            </button>
          </div>
        ))
      )}
    </div>
  </>
)}

              {panelType === 'online' && (
                <>
                  <div className="px-6 pb-2 text-white font-orbitron font-semibold text-xl border-b border-crypto-accent">
                    Online Users
                  </div>
                  <div className="p-4 overflow-y-auto max-h-[calc(100vh-140px)]">
                    {onlineUsers.length === 0 && <div>No Online Users</div>}
                    {onlineUsers.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => openChat(u.id)}
                        className="flex items-center gap-2 p-3 rounded border cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') openChat(u.id);
                        }}
                      >
                        <StarIndicator />
                        <span>{u.nickname}</span>
                        <span className="text-sm text-blue-400 glow">{u.role}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {panelType === 'profile' && (
                <UserProfilePanel
                  profile={profile}
                  loading={profileLoading}
                  error={profileError}
                  nickname={nickname}
                  setNickname={setNickname}
                  email={email}
                  role={role}
                  setRole={setRole}
                  avatarPreview={avatarPreview}
                  onAvatarChange={onAvatarChange}
                  onSave={handleSaveProfile}
                  onLogout={handleLogout} 
                  avatarFile={avatarFile}
                  hideOnline={hideOnline}
                  setHideOnline={handleHideOnlineChange}
                  setAvatarFile={setAvatarFile}
                />
              )}

              {/* Админ панель - показывается только админам */}
              {panelType === 'admin' && isAdmin && (
                <AdminPanel />
              )}
            </div>
          )}

          <div className="flex-1 h-full flex flex-col bg-crypto-dark relative overflow-hidden">
            <ChatContainer 
            onlineUsers={onlineUsers}
              otherUserId={selectedOtherUserId || undefined} 
              chatId={selectedChatId || 'global'} 
              onUserClick={openChat} 
              onSelectUser={openChatWithUser}
            />
          </div>
        </div>
      </div>

      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(33, 224, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(33, 224, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>
    </main>
  );
}
