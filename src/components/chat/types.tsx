// components/chat/types.ts
export interface UserPreview {
  id: string;
  nickname: string;
  photoUrl?: string;
  avatar?: string;
  role?: 'newbie' | 'advertiser' | 'creator'| 'admin';
}
