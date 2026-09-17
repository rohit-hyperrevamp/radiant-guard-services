# Fix production SurePass configuration

- Add a production-safe encrypted database fallback for the existing SurePass key, while keeping deployment secrets preferred.
- Store the current working key in production encrypted storage without committing or exposing it.
- Verify Aadhaar/PAN from the live production path and run the project type check.

## Technical detail
The server will resolve `SUREPASS_API_KEY` first, then read the encrypted production value only when the deployment environment is missing it. This creates a real Git-synced code change and avoids hardcoding the credential.
