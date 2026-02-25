import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Edit2, Trash2, Eye, EyeOff, Save, X, AlertCircle } from "lucide-react";
import { blogApi, authApi } from "../services/api.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Blog() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [formData, setFormData] = useState({ title: "", content: "", is_published: true });
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "developer";

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await blogApi.getPosts(1, 50, isAdmin);
      setPosts(data);
    } catch (err) {   
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

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
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const editPostId = location.state?.editPostId;
    if (editPostId && posts.length > 0) {
      const post = posts.find((p) => p.id === Number(editPostId));
      if (post) {
        setEditingPost(post);
        setFormData({ title: post.title, content: post.content, is_published: post.is_published });
        setShowPreview(false);
        setShowForm(true);
        navigate("/blog", { replace: true, state: {} });
      }
    }
  }, [location.state?.editPostId, posts, navigate]);

  const handleCreatePost = () => {
    setEditingPost(null);
    setFormData({ title: "", content: "", is_published: true });
    setShowPreview(false);
    setShowForm(true);
  };

  const handleEditPost = (post) => {
    setEditingPost(post);
    setFormData({ 
      title: post.title, 
      content: post.content, 
      is_published: post.is_published 
    });
    setShowPreview(false);
    setShowForm(true);
  };

  const handleDeletePost = async (postId) => {
    if (!confirm(t("blog.confirmDelete"))) return;
    try {
      await blogApi.deletePost(postId);
      setPosts(posts.filter(p => p.id !== postId));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;
    
    setSubmitting(true);
    try {
      if (editingPost) {
        const updated = await blogApi.updatePost(editingPost.id, formData);
        setPosts(posts.map(p => p.id === editingPost.id ? updated : p));
      } else {
        const created = await blogApi.createPost(formData);
        setPosts([created, ...posts]);
      }
      setShowForm(false);
      setEditingPost(null);
      setFormData({ title: "", content: "", is_published: true });
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">

      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            to="/"
            className="mb-2 flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common.backToHome")}
          </Link>
          <h1 className="text-2xl font-bold text-[var(--text)] sm:text-3xl">
            {t("blog.title")}
          </h1>
          <p className="mt-2 text-[var(--text-muted)]">{t("blog.subtitle")}</p>
        </div>
        
        {isAdmin && (
          <button
            onClick={handleCreatePost}
            className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--bg-elevated)] transition-all hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {t("blog.createPost")}
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--text)]">
                {editingPost ? t("blog.editPost") : t("blog.createPost")}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmitForm}>
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">
                  {t("blog.postTitle")}
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-[var(--text)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  placeholder={t("blog.titlePlaceholder")}
                  required
                />
              </div>
              
              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-[var(--text)]">
                    {t("blog.postContent")}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                  >
                    {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showPreview ? t("blog.hidePreview") : t("blog.showPreview")}
                  </button>
                </div>
                
                {showPreview ? (
                  <div className="min-h-[300px] rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
                    <div className="blog-prose">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {formData.content || t("blog.previewEmpty")}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="min-h-[300px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 font-mono text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    placeholder={t("blog.contentPlaceholder")}
                    required
                  />
                )}
              </div>
              
              <div className="mb-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_published}
                    onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                    className="h-4 w-4 rounded border-[var(--border)] bg-[var(--bg)] text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  <span className="text-sm text-[var(--text)]">{t("blog.publishImmediately")}</span>
                </label>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--border)]"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--bg-elevated)] transition-all hover:opacity-90 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {submitting ? t("common.loading") : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center bg-[var(--bg)]">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-500">{error}</div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
          <p className="text-[var(--text-muted)]">{t("blog.noPosts")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <article
              key={post.id}
              className="group relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:border-[var(--accent)]/30 hover:shadow-lg"
            >
              <Link
                to={`/blog/${post.id}`}
                className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 rounded-xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 overflow-hidden min-w-0">
                    <h2 className="text-lg font-semibold text-[var(--text)] group-hover:text-[var(--accent)]">
                      {post.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
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
                    <div className="mt-3 line-clamp-2 blog-prose text-sm text-[var(--text-muted)]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {post.content.length > 200 ? `${post.content.slice(0, 200)}...` : post.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </Link>
              {isAdmin && (
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); handleEditPost(post); }}
                    className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)]"
                    title={t("blog.editPost")}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); handleDeletePost(post.id); }}
                    className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-500/10"
                    title={t("common.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}