-- Small (128px) avatar thumbnails for list views. Original photos are 1–4 MB each;
-- lists show thumbs only. A changed photo clears its thumb so a fresh one is made.
alter table public.candidates add column if not exists photo_thumb_url text;

create or replace function public.candidates_clear_stale_photo_thumb()
returns trigger language plpgsql as $$
begin
  if new.photo_url is distinct from old.photo_url
     and new.photo_thumb_url is not distinct from old.photo_thumb_url then
    new.photo_thumb_url := null;
  end if;
  return new;
end $$;

drop trigger if exists candidates_clear_stale_photo_thumb on public.candidates;
create trigger candidates_clear_stale_photo_thumb
  before update of photo_url on public.candidates
  for each row execute function public.candidates_clear_stale_photo_thumb();
