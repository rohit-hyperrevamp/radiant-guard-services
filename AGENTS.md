
- Training files live in the private `training` storage bucket (path `<role_key>/<file>`); `training_modules` holds metadata only and files open via short-lived signed links — keeps the database small and fast.
- Attendance selfies remain private object-storage files and are compressed client-side to 420px JPEG thumbnails before upload — keeps punch capture fast and storage small.
