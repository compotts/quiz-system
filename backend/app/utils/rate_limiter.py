from fastapi import Request, HTTPException
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict
import asyncio


class RateLimiter:
    def __init__(self):
        self.requests: Dict[str, list] = defaultdict(list)
        self.lock = asyncio.Lock()
    
    async def check_rate_limit(
        self,
        request: Request,
        max_requests: int = 5,
        period_seconds: int = 60
    ) -> bool:
        client_ip = request.client.host
        current_time = datetime.utcnow()
        
        async with self.lock:
            cutoff_time = current_time - timedelta(seconds=period_seconds)
            self.requests[client_ip] = [
                req_time for req_time in self.requests[client_ip]
                if req_time > cutoff_time
            ]
            
            if len(self.requests[client_ip]) >= max_requests:
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many requests. Please try again in {period_seconds} seconds."
                )
            
            self.requests[client_ip].append(current_time)
            return True
    
    async def cleanup_old_entries(self, max_age_hours: int = 24):
        cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)
        async with self.lock:
            for ip in list(self.requests.keys()):
                self.requests[ip] = [
                    req_time for req_time in self.requests[ip]
                    if req_time > cutoff_time
                ]
                if not self.requests[ip]:
                    del self.requests[ip]


rate_limiter = RateLimiter()


async def check_login_rate_limit(request: Request):
    from config import settings
    await rate_limiter.check_rate_limit(
        request, 
        max_requests=settings.rate_limit_login, 
        period_seconds=settings.rate_limit_period
    )


async def check_registration_rate_limit(request: Request):
    from config import settings
    await rate_limiter.check_rate_limit(
        request, 
        max_requests=settings.rate_limit_login, 
        period_seconds=settings.rate_limit_period * 5  
    )