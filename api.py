import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from playlist_generator import get_playlist, add_songs_with_token
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
import spotipy

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Spotify Playlist Generator API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1)
    count: int = Field(default=8, ge=1, le=50)
    genre: str = ""
    decade: str = ""
    mood: str = ""


class Track(BaseModel):
    song: str
    artist: str


class GenerateResponse(BaseModel):
    tracks: list[Track]


class AddToSpotifyRequest(BaseModel):
    playlist_name: str = Field(min_length=1)
    tracks: list[Track]
    spotify_token: str = Field(min_length=1)


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
    except Exception as e:
        logger.exception("get_playlist failed")
        raise HTTPException(status_code=500, detail="Playlist generation failed.")

    return GenerateResponse(tracks=[Track(**t) for t in playlist])


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
        raise HTTPException(status_code=500, detail="Spotify request failed.")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return AddToSpotifyResponse(added_count=added, skipped=skipped, playlist_url=url)
