import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import CreatePostForm from "./СreatePostForm";
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

interface Props {
  userId: string;
  userNickname: string;
  socket?: Socket | null;  // Добавляем socket
}

export default function MyPosts({ userId, userNickname, socket }: Props) {
  const API = process.env.NEXT_PUBLIC_API_URL || "";

  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingModalOpen, setEditingModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  async function fetchMyPosts() {
    if (!userId) {
      setMyPosts([]);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(`${API}/forum/posts/my`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      // Здесь используем отдельный эндпоинт /posts/my с фильтрацией на сервере
      const posts: Post[] = res.data.map((p: any) => ({
        id: p._id,
        author: p.author?.nickname || "Unknown",
        title: p.title,
        content: p.text ?? "",
        mainPhotoUrl: p.mainPhotoUrl,
        extraPhotoUrls: p.extraPhotoUrls ?? p.extraPhotos ?? [],
        createdAt: p.createdAt,
      }));

      setMyPosts(posts);
    } catch (e) {
      toast.error("Error loading publications");
    } finally {
      setLoading(false);
    }
  }

  function deletePost(postId: string) {
    if (!confirm("Are you sure you want to delete this post?")) return;

    if (!socket || !userId) {
      toast.error("No connection to the server");
      return;
    }

    socket.emit("deletePost", { postId, userId });
  }

  useEffect(() => {
    fetchMyPosts();
  }, [userId]);

  useEffect(() => {
    if (!socket) return;

    const onNewPost = (post: Post) => {
      if (post.author === userNickname) {
        setMyPosts((prev) => [post, ...prev]);
        console.log("New post added to myPosts:", post);
      }
    };

    const onPostDeleted = (data: { postId: string }) => {
      setMyPosts((prev) => prev.filter((post) => post.id !== data.postId));
      toast.info("The publication has been removed.");
    };

    socket.on("newPost", onNewPost);
    socket.on("postDeleted", onPostDeleted);

    return () => {
      socket.off("newPost", onNewPost);
      socket.off("postDeleted", onPostDeleted);
    };
  }, [socket, userNickname]);

  return (
    <section className="mt-8 p-4 bg-gray-800 rounded max-w-4xl mx-auto text-white">
      <h2 className="mb-4 text-2xl font-semibold">My publications</h2>

      {loading ? (
        <p>Loading...</p>
      ) : myPosts.length === 0 ? (
        <p>You have no publications yet.</p>
      ) : (
        myPosts.map((post) => (
          <div key={post.id} className="bg-gray-700 p-3 rounded mb-3 flex justify-between items-center">
            <div>
              <h3 className="font-semibold">{post.title}</h3>
              <small className="text-gray-300">{post.createdAt ? new Date(post.createdAt).toLocaleDateString() : ""}</small>
            </div>
            <div>
              <button className="mr-2 btn-edit" onClick={() => { setEditingPost(post); setEditingModalOpen(true); }}>
                Edit
              </button>
              <button className="btn-delete" onClick={() => deletePost(post.id)}>
                Delete
              </button>
            </div>
          </div>
        ))
      )}

      {editingModalOpen && editingPost && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center">
          <div className="bg-gray-900 p-6 rounded relative max-w-xl w-full">
            <button className="absolute top-2 right-2 text-white text-2xl" onClick={() => setEditingModalOpen(false)}>
              &times;
            </button>

            {/* Передаём socket и user в CreatePostForm */}
            <CreatePostForm
              initialData={editingPost}
              onSuccess={() => {
                setEditingModalOpen(false);
                fetchMyPosts();
              }}
              onClose={() => setEditingModalOpen(false)}
              socket={socket}
              user={{ id: userId, nickname: userNickname }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
