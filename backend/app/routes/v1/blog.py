from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Optional
from schemas import BlogPostCreate, BlogPostUpdate, BlogPostResponse
from app.database.models.blog_post import BlogPost
from app.database.models.user import User
from app.utils.auth import get_current_admin, get_current_user_optional
from app.utils.audit import log_audit
from app.database.database import utc_now


router = APIRouter(prefix="/blog", tags=["Blog"])


def format_blog_post(post: BlogPost, author: User = None) -> dict:
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
    query = BlogPost.objects.select_related("author")
    
    is_admin = current_user and current_user.role == "admin"
    if not is_admin or not include_unpublished:
        query = query.filter(is_published=True)
    
    offset = (page - 1) * per_page
    posts = await query.order_by("-created_at").offset(offset).limit(per_page).all()
    
    return [format_blog_post(post) for post in posts]


@router.get("/posts/{post_id}", response_model=BlogPostResponse)
async def get_blog_post(
    post_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    post = await BlogPost.objects.select_related("author").get_or_none(id=post_id)
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog post not found"
        )
    
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
    request: Request,
    current_admin: User = Depends(get_current_admin)
):
    post = await BlogPost.objects.create(
        title=data.title,
        content=data.content,
        author=current_admin,
        is_published=data.is_published
    )
    await log_audit(
        "blog_post_created",
        user_id=current_admin.id,
        username=current_admin.username,
        resource_type="blog",
        resource_id=str(post.id),
        details={"title": post.title, "is_published": post.is_published},
        request=request,
    )
    return format_blog_post(post, current_admin)


@router.patch("/posts/{post_id}", response_model=BlogPostResponse)
async def update_blog_post(
    post_id: int,
    data: BlogPostUpdate,
    request: Request,
    current_admin: User = Depends(get_current_admin)
):
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
        update_fields["updated_at"] = utc_now()
        await post.update(**update_fields)
        post = await BlogPost.objects.select_related("author").get_or_none(id=post_id)
        await log_audit(
            "blog_post_updated",
            user_id=current_admin.id,
            username=current_admin.username,
            resource_type="blog",
            resource_id=str(post_id),
            details={"title": post.title, "fields": list(update_fields.keys())},
            request=request,
        )
    
    return format_blog_post(post)


@router.delete("/posts/{post_id}")
async def delete_blog_post(
    post_id: int,
    request: Request,
    current_admin: User = Depends(get_current_admin)
):
    post = await BlogPost.objects.get_or_none(id=post_id)
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog post not found"
        )
    
    title = post.title
    await post.delete()
    await log_audit(
        "blog_post_deleted",
        user_id=current_admin.id,
        username=current_admin.username,
        resource_type="blog",
        resource_id=str(post_id),
        details={"title": title},
        request=request,
    )
    return {"message": "Blog post deleted successfully"}
