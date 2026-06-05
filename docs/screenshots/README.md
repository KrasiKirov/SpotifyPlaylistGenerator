# Screenshots

Drop four PNGs here, named exactly so the main [README](../../README.md#screenshots) picks them up:

| File           | Screen        | What it shows                              |
| -------------- | ------------- | ------------------------------------------ |
| `connect.png`  | Connect       | The "Pair with Spotify" landing screen     |
| `home.png`     | Home          | The brief / refinements / length form      |
| `preview.png`  | Preview       | The generated tracklist, editable          |
| `result.png`   | Result        | "The side is set" success screen           |

## How to capture

Run the app on a simulator or device, then take a screenshot of each screen:

```bash
cd mobile
npx expo start
```

- **iOS Simulator:** `⌘ + S` saves a PNG to the Desktop. Or, headless:
  `xcrun simctl io booted screenshot connect.png`
- **Android emulator:** the toolbar camera button, or:
  `adb exec-out screencap -p > connect.png`
- **Physical device:** use the phone's native screenshot, AirDrop/transfer the PNGs over.

Then move the four files into this folder with the names in the table above and commit.

## Tips

- Portrait orientation; keep all four the same dimensions so the README table stays even.
- Use a real-looking prompt (e.g. _"late drive home through the rain"_) for a representative Preview/Result.
- Optionally downscale to ~1080px wide to keep the repo light.
