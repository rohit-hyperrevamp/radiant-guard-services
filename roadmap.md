# Roadmap

- [x] Liven dashboard/interior colors: richer tiles, solid icon chips, brand blue accents; keep sidebar black
- [x] Login screen: bigger logo in top-left white card, less rounded corners (6px)

## Android release

- [x] Android manifest: notification/vibrate permissions
- [x] Platform-aware device token registration (ios vs android/FCM)
- [x] Android high-importance notification channel
- [ ] Firebase project + `android/app/google-services.json` (waiting on user)
- [ ] Build debug APK on user's Mac (`npm run android:apk`)
- [ ] Server-side FCM sending for Android tokens (currently APNs only)
- [ ] Role/hierarchy-contextual notification routing verification
- [ ] Signed release AAB + Play Store (later)
