import openai
import spotipy
from dotenv import dotenv_values

import argparse
import datetime
import json
import os


config = dotenv_values(".env")
openai.api_key = config["OPENAI_API_KEY"]

parser = argparse.ArgumentParser(description="Simple command line song utility")
parser.add_argument("-p", type=str, default="My Generated Playlist", help="The prompt to describe the playlist")
parser.add_argument("-n", type=int, default=8, help="The prompt to set the number of songs to add to the playlist")

args = parser.parse_args()

if args.n not in range(1,50):
    raise ValueError("Error: n should be between 0 and 50")

playlist_prompt = args.p
count = args.n

def get_playlist(prompt, count=8):
    example_json = """
    [
    {"song": "The Sound of Silence", "artist": "Simon & Garfunkel"},
    {"song": "Yesterday", "artist": "The Beatles"},
    {"song": "Hurt", "artist": "Johnny Cash"},
    {"song": "Mad World", "artist": "Gary Jules"},
    {"song": "Creep", "artist": "Radiohead"},
    {"song": "Fix You", "artist": "Coldplay"},
    {"song": "Someone Like You", "artist": "Adele"},
    {"song": "Say Something", "artist": "A Great Big World"},
    {"song": "When You're Gone", "artist": "Avril Lavigne"},
    {"song": "Teardrop", "artist": "Massive Attack"},
    {"song": "Everybody Hurts", "artist": "R.E.M."},
    {"song": "I Will Always Love You", "artist": "Whitney Houston"},
    {"song": "Hello", "artist": "Adele"}
    ]
    """

    messages = [
        {
            "role": "system", 
            "content": """You are a helpful playlist generating assistant.
            You should generate a list of songs and their artists according to a text prompt.
            You should return a JSON array where each element follows this format: {"song": <song_title>, "artist": <artist_name>}"""
        },
        {
            "role": "user", 
            "content": "Generate a playlist of 13 songs based on this prompt: super super sad songs"
        },
        {
            "role": "assistant", 
            "content": example_json
        },
        {
            "role": "user", 
            "content": f"Generate a playlist of {count} songs based on this prompt: {prompt}"
        }
    ]
    
    response = openai.ChatCompletion.create(
        messages=messages,
        model="gpt-4",
        max_tokens=400
    )
    
    playlist = json.loads(response["choices"][0]["message"]["content"])
    return playlist

def add_songs_to_spotify(playlist_prompt, playlist):
    sp = spotipy.Spotify(
        auth_manager=spotipy.SpotifyOAuth(
            client_id=config["SPOTIFY_CLIENT_ID"],
            client_secret=config["SPOTIFY_CLIENT_SECRET"],
            redirect_uri="http://localhost:9999",
            scope="playlist-modify-private"
        )
    )

    current_user = sp.current_user()

    assert current_user is not None

    track_ids = []

    for item in playlist:
        artist, song = item["artist"], item["song"]
        query = f"{song} {artist}"
        search_results = sp.search(q=query, type="track", limit=10)
        track_ids.append(search_results["tracks"]["items"][0]["id"])


    created_playlist = sp.user_playlist_create(
        current_user["id"],
        public=False,
        name=f"{playlist_prompt}" 
    )

    sp.user_playlist_add_tracks(current_user["id"], created_playlist["id"], track_ids)

playlist = get_playlist(playlist_prompt, count)
add_songs_to_spotify(playlist_prompt, playlist)

print("\n")
print(f"Created playlist: {playlist_prompt}")
    