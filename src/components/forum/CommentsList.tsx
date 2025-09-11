'use client';

import * as React from "react";
import CommentItem from "./CommentItem";
import CommentForm from "./CommentForm";

interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  userLiked: boolean;
  likesCount: number;
}

interface CommentsProps {
  initialComments?: Comment[];
  currentUserId: string;
  onAddComment: (text: string) => Promise<void>;
  onToggleLike: (commentId: string) => void;
}

export default function CommentsList({
  initialComments = [],
  currentUserId,
  onAddComment,
  onToggleLike,
}: CommentsProps) {
  const handleAdd = async (text: string) => {
    await onAddComment(text);
  };

  const handleToggle = (commentId: string) => {
    onToggleLike(commentId);
  };

  return (
    <div className="mt-6">
      <h3 className="text-2xl font-orbitron font-semibold text-crypto-accent mb-4">
        Comments
      </h3>

      {initialComments.length === 0 && (
        <p className="text-gray-500 italic mb-4">No comments yet</p>
      )}

      <div>
        {initialComments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onToggleLike={() => handleToggle(comment.id)}
          />
        ))}
      </div>

      <CommentForm onSubmit={handleAdd} />
    </div>
  );
}
