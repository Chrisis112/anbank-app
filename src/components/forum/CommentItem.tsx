import * as React from "react";
import { FaRegThumbsUp, FaThumbsUp } from "react-icons/fa";

interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  userLiked: boolean;
  likesCount: number;
}

interface CommentItemProps {
  comment: Comment;
  onToggleLike: (commentId: string) => void;
}

export default function CommentItem({ comment, onToggleLike }: CommentItemProps) {
  const handleLikeClick = () => {
    onToggleLike(comment.id);
  };

  return (
    <div className="p-4 bg-crypto-input rounded-lg border border-crypto-accent mb-3">
      <div className="flex justify-between mb-1">
        <strong className="text-white">{comment.author}</strong>
        <span className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</span>
      </div>
      <p className="text-gray-300 mb-3">{comment.text}</p>
      <button
        onClick={handleLikeClick}
        className="flex items-center gap-1 text-crypto-accent hover:text-crypto-accent-dark"
        aria-label={comment.userLiked ? "Unlike" : "Like"}
      >
        {comment.userLiked ? <FaThumbsUp /> : <FaRegThumbsUp />}
        <span>{comment.likesCount}</span>
      </button>
    </div>
  );
}
