'use client';
import classNames from 'classnames';
import { MESSAGE_REACTIONS } from './ReactionsConfig';
import { Message } from '../../store/chatStore';

interface ReactionPopoverProps {
  messageId: string;
  isMine: boolean;
  myUserId: string;
  messages: Message[]; // чтобы подсветить активные реакции
  addReaction: (msgId: string, reaction: string) => void;
  onClose: () => void;
}

export function ReactionPopover({
  messageId,
  isMine,
  myUserId,
  messages,
  addReaction,
  onClose,
}: ReactionPopoverProps) {
  return (
    <div
      className={`absolute -top-12 ${isMine ? 'right-0' : 'left-0'}
        bg-[#1c1933]/90 shadow-xl rounded-2xl px-2 py-1 flex gap-2
        animate-fade-in z-30 border border-[#214abb]`}
    >
      {MESSAGE_REACTIONS.map((r) => {
        const reactionUsers =
          messages.find((m) => m.id === messageId)?.reactions?.[r.emoji] ?? [];

        // Если реакция содержит только пустое значение ' ', считаем что реакции нет
        const isActive =
          reactionUsers.length === 1 && reactionUsers[0] === ' '
            ? false
            : reactionUsers.includes(myUserId);

        // Не отображать реакцию, если она пустая (с массивом [' '])
        if (reactionUsers.length === 1 && reactionUsers[0] === ' ') {
          return null;
        }

        return (
          <button
            key={r.emoji}
            className={classNames(
              'w-9 h-9 flex items-center justify-center rounded-full text-xl neon-hover',
              {
                'ring-2 ring-indigo-400': isActive,
              }
            )}
            style={{ fontSize: 22 }}
            onClick={(e) => {
              e.stopPropagation();
              addReaction(messageId, r.emoji);
              onClose();
            }}
            title={r.label}
            aria-pressed={isActive}
            type="button"
          >
            {r.emoji}
          </button>
        );
      })}
    </div>
  );
}
