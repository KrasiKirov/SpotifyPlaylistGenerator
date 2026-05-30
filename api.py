import logging
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from playlist_generator import get_playlist, add_songs_with_token
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import spotipy

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

MAX_BODY_BYTES = 64 * 1024


def _rate_limit_key(request: Request) -> str:
    if os.environ.get("TRUST_PROXY_HEADERS") == "1":
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_key)

app = FastAPI(title="Spotify Playlist Generator API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_BODY_BYTES:
            return JSONResponse(status_code=413, content={"detail": "Request body too large."})
        return await call_next(request)


app.add_middleware(BodySizeLimitMiddleware)

_allowed_origins = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()
]
if _allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins,
        allow_methods=["POST"],
        allow_headers=["Content-Type"],
    )


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)
    count: int = Field(default=8, ge=1, le=50)
    genre: str = Field(default="", max_length=100)
    decade: str = Field(default="", max_length=20)
    mood: str = Field(default="", max_length=50)


class Track(BaseModel):
    song: str = Field(min_length=1, max_length=300)
    artist: str = Field(min_length=1, max_length=300)


class GenerateResponse(BaseModel):
    tracks: list[Track]


class AddToSpotifyRequest(BaseModel):
    playlist_name: str = Field(min_length=1, max_length=100)
    tracks: list[Track] = Field(min_length=1, max_length=50)
    spotify_token: str = Field(min_length=1, max_length=4096)


class AddToSpotifyResponse(BaseModel):
    added_count: int
    skipped: list[str]
    playlist_url: str


@app.post("/generate", response_model=GenerateResponse)
@limiter.limit("10/hour")
def generate(request: Request, req: GenerateRequest):
    prompt_parts = [req.prompt]
    if req.genre:
        prompt_parts.append(f"genre: {req.genre}")
    if req.decade:
        prompt_parts.append(f"decade: {req.decade}")
    if req.mood:
        prompt_parts.append(f"mood: {req.mood}")
    full_prompt = ", ".join(prompt_parts)

    try:
        playlist = get_playlist(full_prompt, req.count)
    except ValueError:
        logger.exception("get_playlist returned malformed data")
        raise HTTPException(status_code=502, detail="Upstream model returned invalid data.")
    except Exception:
        logger.exception("get_playlist failed")
        raise HTTPException(status_code=500, detail="Playlist generation failed.")

    try:
        return GenerateResponse(tracks=[Track(**t) for t in playlist])
    except Exception:
        logger.exception("Model output failed Track schema")
        raise HTTPException(status_code=502, detail="Upstream model returned invalid data.")


@app.post("/add-to-spotify", response_model=AddToSpotifyResponse)
@limiter.limit("10/hour")
def add_to_spotify(request: Request, req: AddToSpotifyRequest):
    try:
        added, skipped, url = add_songs_with_token(
            req.playlist_name,
            [t.model_dump() for t in req.tracks],
            req.spotify_token,
        )
    except spotipy.SpotifyException as e:
        if e.http_status == 401:
            raise HTTPException(status_code=401, detail="Spotify token is invalid or expired.")
        logger.exception("Spotify API error")
        raise HTTPException(status_code=502, detail="Spotify request failed.")
    except RuntimeError:
        logger.exception("Playlist creation failed")
        raise HTTPException(status_code=500, detail="Playlist creation failed.")

    return AddToSpotifyResponse(added_count=added, skipped=skipped, playlist_url=url)
