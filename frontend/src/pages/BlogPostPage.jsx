import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Edit2, Trash2 } from "lucide-react";
import { blogApi, authApi } from "../services/api.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function BlogPostPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await authApi.getMe();
        setUser(userData);
      } catch {
        setUser(null);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    const loadPost = async () => {
      if (!postId) return;
      try {
        setLoading(true);
        const data = await blogApi.getPost(Number(postId));
        setPost(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadPost();
  }, [postId]);

  const handleDeletePost = async () => {
    if (!post || !confirm(t("blog.confirmDelete"))) return;
    try {
      await blogApi.deletePost(post.id);
      navigate("/blog");
    } catch (err) {
      alert(err.message);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center text-[var(--text-muted)]">
        {t("common.loading")}
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/blog"
          className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("blog.backToList")}
        </Link>
        <div className="py-12 text-center text-red-500">
          {error || t("blog.noPosts")}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        to="/blog"
        className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("blog.backToList")}
      </Link>

      <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
        <header className="mb-6 border-b border-[var(--border)] pb-6">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-[var(--text)] sm:text-3xl">
              {post.title}
            </h1>
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={() => navigate("/blog", { state: { editPostId: post.id } })}
                  className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)]"
                  title={t("blog.editPost")}
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={handleDeletePost}
                  className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-500/10"
                  title={t("common.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
            <span>{post.author_name}</span>
            <span>•</span>
            <span>{formatDate(post.created_at)}</span>
            {!post.is_published && (
              <>
                <span>•</span>
                <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-600 dark:text-yellow-400">
                  {t("blog.draft")}
                </span>
              </>
            )}
          </div>
        </header>

        <div className="blog-prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {post.content}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
