-- Drop existing table if you need to recreate it
drop table if exists public.reviews cascade;

create table if not exists public.reviews (
  id bigserial not null,
  text text not null,
  user_id uuid null,
  display boolean not null default false,
  display_order integer null,
  created_at timestamp with time zone not null default now(),
  constraint reviews_pkey primary key (id),
  constraint reviews_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null
) tablespace pg_default;

-- Index for ordering reviews by display_order (most important for frontend queries)
create index if not exists idx_reviews_display_order on public.reviews using btree (display_order asc nulls last) tablespace pg_default;

-- Index for filtering displayed reviews
create index if not exists idx_reviews_display on public.reviews using btree (display) tablespace pg_default;

-- Composite index for efficient querying of displayed reviews in order
create index if not exists idx_reviews_display_order_composite on public.reviews using btree (display, display_order asc nulls last) tablespace pg_default;

-- Index for created_at (useful for admin panel to see recent submissions)
create index if not exists idx_reviews_created_at on public.reviews using btree (created_at desc) tablespace pg_default;

-- -- Enable Row Level Security
-- alter table public.reviews enable row level security;

-- -- Policy: Anyone can insert reviews (submit)
-- create policy "Anyone can submit reviews"
--   on public.reviews
--   for insert
--   to authenticated
--   with check (true);

-- -- Policy: Everyone can view displayed reviews
-- create policy "Everyone can view displayed reviews"
--   on public.reviews
--   for select
--   to public
--   using (display = true);

-- -- Policy: Owners/admins can view all reviews (for admin panel)
-- -- Replace 'owner@example.com' with your actual owner email
-- create policy "Owners can view all reviews"
--   on public.reviews
--   for select
--   to authenticated
--   using (
--     auth.jwt() ->> 'email' = 'owner@example.com'
--   );

-- -- Policy: Owners/admins can update reviews (change display status and order)
-- create policy "Owners can update reviews"
--   on public.reviews
--   for update
--   to authenticated
--   using (
--     auth.jwt() ->> 'email' = 'owner@example.com'
--   )
--   with check (
--     auth.jwt() ->> 'email' = 'owner@example.com'
--   );

-- -- Policy: Owners/admins can delete reviews
-- create policy "Owners can delete reviews"
--   on public.reviews
--   for delete
--   to authenticated
--   using (
--     auth.jwt() ->> 'email' = 'owner@example.com'
--   );

-- -- Optional: Add a comment to explain the display field
-- comment on column public.reviews.display is 'When true, review is visible on frontend. Defaults to false for moderation.';
-- comment on column public.reviews.display_order is 'Order in which reviews appear on frontend (lower numbers first). NULL reviews appear last.';