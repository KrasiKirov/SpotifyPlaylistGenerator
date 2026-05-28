import argparse
from playlist_generator import get_playlist, add_songs_to_spotify


def main():
    parser = argparse.ArgumentParser(description="Generate a Spotify playlist from a text prompt")
    parser.add_argument("-p", type=str, default="My Generated Playlist",
                        help="Describe the playlist (e.g. 'upbeat 90s workout songs')")
    parser.add_argument("-n", type=int, default=8,
                        help="Number of songs (1–50)")
    parser.add_argument("-g", type=str, default="",
                        help="Genre filter (e.g. 'jazz', 'hip-hop')")
    parser.add_argument("-d", type=str, default="",
                        help="Decade filter (e.g. '90s', '2000s')")
    parser.add_argument("-m", type=str, default="",
                        help="Mood filter (e.g. 'upbeat', 'melancholic')")
    parser.add_argument("--yes", action="store_true",
                        help="Skip confirmation and add songs immediately")
    args = parser.parse_args()

    if not 1 <= args.n <= 50:
        raise ValueError("n must be between 1 and 50")

    prompt_parts = [args.p]
    if args.g:
        prompt_parts.append(f"genre: {args.g}")
    if args.d:
        prompt_parts.append(f"decade: {args.d}")
    if args.m:
        prompt_parts.append(f"mood: {args.m}")
    full_prompt = ", ".join(prompt_parts)

    print(f"\nGenerating {args.n} songs for: \"{full_prompt}\"...\n")
    playlist = get_playlist(full_prompt, args.n)

    print("Songs to add:")
    for i, item in enumerate(playlist, 1):
        print(f"  {i:2}. {item['song']} — {item['artist']}")

    if not args.yes:
        confirm = input("\nAdd these to Spotify? [y/N] ").strip().lower()
        if confirm != "y":
            print("Cancelled.")
            return

    print("\nAdding to Spotify...")
    added, skipped = add_songs_to_spotify(args.p, playlist)

    if skipped:
        print(f"\nSkipped ({len(skipped)} not found on Spotify):")
        for s in skipped:
            print(f"  - {s}")

    print(f"\nCreated playlist \"{args.p}\" with {added} songs.")


if __name__ == "__main__":
    main()
