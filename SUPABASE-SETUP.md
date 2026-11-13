# Supabase for private couple data

The app now points to the new Supabase project through `supabase-config.js`. The publishable key is safe for client use; never put a Supabase secret/service-role key in this repository or in the app.

## Set up the new project

1. In **Authentication → Users**, confirm that both accounts exist. The setup SQL references the two user IDs supplied for this project and will fail if either ID is missing or already linked.
2. Open **SQL Editor**, create a new query, paste all of `supabase-private-setup.sql`, and run it once. It creates private couple tables and row-level security policies. Anonymous visitors receive no access to these records.
3. Run `supabase-little-note-setup.sql` once in another SQL Editor query. This adds the shared, private note.
4. Run `supabase-media-setup.sql` once in another SQL Editor query. This creates the private gallery table and Storage bucket for photos and videos.
5. Run `supabase-calendar-setup.sql` once in another SQL Editor query. This enables shared calendar events, including create and delete across the couple’s signed-in devices.
6. Run `supabase-pet-setup.sql` once in another SQL Editor query to sync the virtual pet's name and care meters between both signed-in devices.
7. Run `supabase-games-setup.sql` once in another SQL Editor query to save custom questions and game options for both signed-in devices.
8. Sign in from the app with either account. The app login recognizes the two linked couple accounts.

Do not run the older `supabase-setup.sql` on this new project. It was designed for the previous app setup and contains public policies for some tables.

## Current scope

The app synchronizes love letters, capsules, photos, and videos through this project. Gallery files are private and visible to the two linked accounts. Uploads are limited to 50 MB per file.

The **A little note** section can be edited by either linked account and syncs to both phones. The note text and the captions for the 18 rotating **Little moments** photos can be changed in `index.html`.

Questions can be added, edited, or removed in **Jogos → Montar nossas perguntas**. They save on the current device right away. To sync a shared question set between both phones, run `supabase-games-setup.sql` and sign in on both devices.

The **Our little world** live-location section has been removed from the app. The gallery now uses the Supabase Storage bucket created by `supabase-media-setup.sql`; the old Cloudflare media Worker is no longer part of the app upload flow. Files already stored in Cloudflare are not copied automatically and need to be downloaded and uploaded again if you want them in the Supabase gallery.
