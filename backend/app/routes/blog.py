from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from schemas import BlogPostCreate, BlogPostUpdate, BlogPostResponse
from app.database.models.blog_post import BlogPost
from app.database.models.user import User
from app.utils.auth import get_current_admin, get_current_user_optional

router = APIRouter(prefix="/blog", tags=["Blog"])


def format_blog_post(post: BlogPost, author: User = None) -> dict:
    """Format blog post for response"""
    author_obj = author or post.author
    author_name = None
    if author_obj:
        if author_obj.first_name or author_obj.last_name:
            author_name = f"{author_obj.first_name or ''} {author_obj.last_name or ''}".strip()
        else:
            author_name = author_obj.username
    
    return {
        "id": post.id,
        "title": post.title,
        "content": post.content,
        "author_id": post.author.id if post.author else None,
        "author_name": author_name,
        "is_published": post.is_published,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
    }


@router.get("/posts", response_model=List[BlogPostResponse])
async def get_blog_posts(
    page: int = 1,
    per_page: int = 10,
    include_unpublished: bool = False,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get all blog posts. Unpublished posts are only visible to admins."""
    query = BlogPost.objects.select_related("author")
    
    # Only show unpublished posts to admins
    is_admin = current_user and current_user.role == "admin"
    if not is_admin or not include_unpublished:
        query = query.filter(is_published=True)
    
    total = await query.count()
    offset = (page - 1) * per_page
    posts = await query.order_by("-created_at").offset(offset).limit(per_page).all()
    
    return [format_blog_post(post) for post in posts]


@router.get("/posts/{post_id}", response_model=BlogPostResponse)
async def get_blog_post(
    post_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get a single blog post by ID"""
    post = await BlogPost.objects.select_related("author").get_or_none(id=post_id)
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog post not found"
        )
    
    # Check if user can view unpublished posts
    is_admin = current_user and current_user.role == "admin"
    if not post.is_published and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog post not found"
        )
    
    return format_blog_post(post)


@router.post("/posts", response_model=BlogPostResponse)
async def create_blog_post(
    data: BlogPostCreate,
    current_admin: User = Depends(get_current_admin)
):
    """Create a new blog post (admin only)"""
    post = await BlogPost.objects.create(
        title=data.title,
        content=data.content,
        author=current_admin,
        is_published=data.is_published
    )
    
    return format_blog_post(post, current_admin)


@router.patch("/posts/{post_id}", response_model=BlogPostResponse)
async def update_blog_post(
    post_id: int,
    data: BlogPostUpdate,
    current_admin: User = Depends(get_current_admin)
):
    """Update a blog post (admin only)"""
    post = await BlogPost.objects.select_related("author").get_or_none(id=post_id)
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog post not found"
        )
    
    update_fields = {}
    if data.title is not None:
        update_fields["title"] = data.title
    if data.content is not None:
        update_fields["content"] = data.content
    if data.is_published is not None:
        update_fields["is_published"] = data.is_published
    
    if update_fields:
        update_fields["updated_at"] = datetime.utcnow()
        await post.update(**update_fields)
        post = await BlogPost.objects.select_related("author").get_or_none(id=post_id)
    
    return format_blog_post(post)


@router.delete("/posts/{post_id}")
async def delete_blog_post(
    post_id: int,
    current_admin: User = Depends(get_current_admin)
):
    """Delete a blog post (admin only)"""
    post = await BlogPost.objects.get_or_none(id=post_id)
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog post not found"
        )
    
    await post.delete()
    
    return {"message": "Blog post deleted successfully"}
