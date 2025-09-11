'use client';

import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "../../hooks/useAuth";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import CommentsList from "@/components/forum/CommentsList";
import CreatePostForm from "@/components/forum/СreatePostForm";
import { io, Socket } from "socket.io-client";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MyPosts from "@/components/forum/MyPosts";

interface Post {
  id: string;
  author: string;
  title: string;
  content: string;
  mainPhotoUrl?: string;
  extraPhotoUrls?: string[];
  createdAt?: string;
}

interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  userLiked: boolean;
  likesCount: number;
}

export default function ForumPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);

  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingPostDetails, setLoadingPostDetails] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Initialize socket and set up event handlers
  useEffect(() => {
  if (!user) return;

  const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "", {
    query: { userId: user.id },
    transports: ["websocket"],
    withCredentials: true,
  });

  socketRef.current = socket;


  // Handle post creation error - ПЕРВЫМ для отладки

  // Handle new post event
  const handleNewPost = (post: Post) => {
    setPosts((prev) => [post, ...prev]);
    if (post.author === user.nickname) {
      setMyPosts((prev) => [post, ...prev]);
    }
    setIsCreateModalOpen(false);
  };

  // Handle deletion notification
  const handlePostDeleted = ({ postId }: { postId: string }) => {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
    setMyPosts((prev) => prev.filter((post) => post.id !== postId));
    if (selectedPost?.id === postId) {
      setSelectedPost(null);
      setComments([]);
    }
  };

  // Handle new comments
  const handleNewComment = ({ postId, comment }: { postId: string; comment: Comment }) => {
    if (selectedPost?.id === postId) {
      setComments((prev) => {
        if (prev.find((c) => c.id === comment.id)) return prev; // avoid duplicate
        return [...prev, comment];
      });
    }
  };

  // Handle like updates
  const handleLikeUpdated = ({ commentId, likesCount, userLiked }: { commentId: string; likesCount: number; userLiked: boolean }) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, likesCount, userLiked } : c))
    );
  };

  // Subscribe to socket events В ПРАВИЛЬНОМ ПОРЯДКЕ
  socket.on("newPost", handleNewPost);
  socket.on("postDeleted", handlePostDeleted);
  socket.on("newComment", handleNewComment);
  socket.on("likeUpdated", handleLikeUpdated);

  // Fetch user's posts once on mount
  const fetchMyPosts = async () => {
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/forum/posts/my`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const postsData = res.data.map((p: any) => ({
        id: p._id,
        author: p.author.nickname,
        title: p.title,
        content: p.text,
        mainPhotoUrl: p.mainPhotoUrl,
        extraPhotoUrls: p.extraPhotoUrls || [],
        createdAt: p.createdAt,
      }));
      setMyPosts(postsData);
    } catch (error) {
    }
  };

  fetchMyPosts();

  return () => {
    socket.off("newPost", handleNewPost);
    socket.off("postDeleted", handlePostDeleted);
    socket.off("newComment", handleNewComment);
    socket.off("likeUpdated", handleLikeUpdated);
    socket.disconnect();
    socketRef.current = null;
  };
}, [user, selectedPost]);


  // Fetch all posts
  const fetchPosts = async () => {
    setLoadingPosts(true);
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/forum/posts`);
      const postsData = res.data.map((p: any) => ({
        id: p._id,
        author: p.author.nickname,
        title: p.title,
        content: p.text,
        mainPhotoUrl: p.mainPhotoUrl,
        extraPhotoUrls: p.extraPhotoUrls,
        createdAt: p.createdAt,
      }));
      setPosts(postsData);
    } catch (error) {
      toast.error("Failed to fetch posts");
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // Fetch a single post details and comments
  const fetchPostDetails = async (postId: string) => {
    setLoadingPostDetails(true);
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/forum/posts/${postId}`);
      setSelectedPost({
        id: res.data.post._id,
        author: res.data.post.author.nickname,
        title: res.data.post.title,
        content: res.data.post.text,
        mainPhotoUrl: res.data.post.mainPhotoUrl,
        extraPhotoUrls: res.data.post.extraPhotoUrls,
        createdAt: res.data.post.createdAt,
      });
      const mappedComments = res.data.comments.map((c: any) => ({
        id: c._id,
        author: c.author.nickname,
        text: c.text,
        createdAt: c.createdAt,
        userLiked: false,
        likesCount: c.likes ? c.likes.length : 0,
      }));
      setComments(mappedComments);
    } catch (error) {
      toast.error("Failed to load post details");
    } finally {
      setLoadingPostDetails(false);
    }
  };

  // Add comment via socket
  const addComment = async (text: string) => {
    if (!selectedPost || !user || !socketRef.current) return;
    socketRef.current.emit("addComment", {
      postId: selectedPost.id,
      commentData: {
        authorId: user.id,
        authorName: user.nickname,
        text,
      },
    });
  };

  // Toggle like via socket
  const toggleLike = (commentId: string) => {
    if (!socketRef.current || !user) return;
    socketRef.current.emit("toggleLike", {
      commentId,
      userId: user.id,
    });
  };

  return (
    <>
      <Header />
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center">
          <div className="bg-gray-900 p-6 rounded max-w-xl w-full relative">
            <button onClick={() => setIsCreateModalOpen(false)} className="absolute top-2 right-2 text-white text-2xl">
              &times;
            </button>
            <CreatePostForm 
              onClose={() => setIsCreateModalOpen(false)} 
              onSuccess={() => {}} 
              socket={socketRef.current!} 
              user={user!} 
            />
          </div>
        </div>
      )}
      <div className="min-h-screen w-full bg-gray-900 text-white p-4">
        {!selectedPost ? (
          <main className="max-w-4xl mx-auto p-8 rounded-lg mt-10">
            <button onClick={() => setIsCreateModalOpen(true)} className="mb-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded">
              Create Post
            </button>
            <section className="mb-8">
              <MyPosts userId={user?.id || ""} userNickname={user?.nickname || ""} socket={socketRef.current} />
            </section>
            <section className="h-screen w-full max-w-none p-4 bg-gray-900 rounded-lg flex flex-col">
              <h1 className="text-3xl mb-6">Forum publications</h1>
              {loadingPosts ? (
                <p>Loading...</p>
              ) : posts.length === 0 ? (
                <p>No Publications</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow overflow-auto">
                  {posts.map((post) => (
                    <div key={post.id} onClick={() => fetchPostDetails(post.id)} className="cursor-pointer bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col items-center p-4" style={{aspectRatio: "1 / 1"}}>
                      {post.mainPhotoUrl ? (
                        <img src={post.mainPhotoUrl} alt={post.title} className="w-full h-48 object-cover rounded mb-2" />
                      ) : (
                        <div className="w-full h-48 bg-gray-700 rounded mb-2 flex items-center justify-center text-gray-500">No Photo</div>
                      )}
                      <h3 className="font-bold text-lg mb-2 text-center truncate w-full">{post.title}</h3>
                      <p className="text-gray-400 text-sm mb-4 truncate">{post.content}</p>
                      <small className="text-gray-500">Author: {post.author}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>
        ) : (
          <main className="max-w-4xl mx-auto p-8 rounded-lg mt-10 overflow-auto">
            <button onClick={() => setSelectedPost(null)} className="mb-6 underline">
              &larr; Back
            </button>
            <article>
              <h1 className="text-4xl font-bold mb-4">{selectedPost.title}</h1>
              <p className="mb-4 whitespace-pre-wrap">{selectedPost.content}</p>
              {selectedPost.mainPhotoUrl && (
                <img src={selectedPost.mainPhotoUrl} alt="Main photo" className="rounded mb-4 max-h-96 w-full object-cover" />
              )}
              {selectedPost.extraPhotoUrls && selectedPost.extraPhotoUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {selectedPost.extraPhotoUrls.map((url, i) => (
                    <img key={i} src={url} alt={`Additional photo ${i + 1}`} className="w-full h-32 object-cover rounded" />
                  ))}
                </div>
              )}
            </article>
            <CommentsList
              initialComments={comments}
              currentUserId={user?.id || ""}
              onAddComment={addComment}
              onToggleLike={toggleLike}
            />
          </main>
        )}
      </div>
          <ToastContainer
      position="top-right"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop={true}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="dark"
      style={{ zIndex: 9999 }}
    />
    </>
  );
}
