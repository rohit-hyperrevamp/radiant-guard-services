
- Training files live in the private `training` storage bucket (path `<role_key>/<file>`); `training_modules` holds metadata only and files open via short-lived signed links — keeps the database small and fast.
