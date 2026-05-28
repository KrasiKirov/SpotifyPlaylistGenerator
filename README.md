# Spotify Playlist Generator

Generate Spotify playlists from a text prompt using GPT-4o.

## Setup

1. Copy `.env.example` to `.env` and fill in your keys:

   ```env
   OPENAI_API_KEY=sk-...
   SPOTIFY_CLIENT_ID=...
   SPOTIFY_CLIENT_SECRET=...
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

## Usage

### Web UI (recommended)

```bash
streamlit run web_app.py
```

### CLI

```bash
# Basic
python app.py -p "rainy day indie folk"

# With filters
python app.py -p "workout" -g "hip-hop" -d "2010s" -m "energetic" -n 15

# Skip confirmation prompt
python app.py -p "chill beats" --yes
```

## CLI Flags

| Flag    | Description              | Default                 |
| ------- | ------------------------ | ----------------------- |
| `-p`    | Playlist description     | `My Generated Playlist` |
| `-n`    | Number of songs (1–50)   | `8`                     |
| `-g`    | Genre filter             | —                       |
| `-d`    | Decade filter            | —                       |
| `-m`    | Mood filter              | —                       |
| `--yes` | Skip confirmation        | false                   |
