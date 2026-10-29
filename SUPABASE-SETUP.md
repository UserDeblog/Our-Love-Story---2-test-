# Supabase for private couple data

The app now points to the new Supabase project through `supabase-config.js`. The publishable key is safe for client use; never put a Supabase secret/service-role key in this repository or in the app.

## Set up the new project

1. In **Authentication → Users**, confirm that both accounts exist. The setup SQL references the two user IDs supplied for this project and will fail if either ID is missing or already linked.
2. Open **SQL Editor**, create a new query, paste all of `supabase-private-setup.sql`, and run it once. It creates private couple tables and row-level security policies for letters, capsules, and location sharing. Anonymous visitors receive no access to these records.
3. Run `supabase-little-note-setup.sql` once in another SQL Editor query. This adds the shared, private note.
4. Sign in from the app with either account. The current admin login now treats linked couple members as authorized users.

Do not run the older `supabase-setup.sql` on this new project. It was designed for the previous app setup and contains public policies for some tables.

## Current scope

The app synchronizes love letters and capsules through this project. When an authenticated device first connects to an empty project, existing local love letters are copied to the new database instead of being overwritten. Other areas such as timeline, checklist, and date ideas can continue using this device's local storage for now.

The **A little note** section can be edited by either linked account and syncs to both phones. The note text and the captions for the 18 rotating **Little moments** photos can be changed in `index.html`.

The location page is available under **World**. Each signed-in member must tap **Share my location** on their own device and grant the requested system permissions. The database rules let each member write only their own location and read the partner's latest location only while that partner has sharing enabled.

The app uses a native Capacitor background-location plugin. On Android, a persistent notification is shown while sharing. On iPhone, background location requires **Always** permission and iOS may stop updates after the app is force-closed. Map tiles are loaded from OpenStreetMap, which receives the map coordinates needed to display the requested area.

Storage/gallery uploads continue to use the separate Cloudflare R2 setup described in `CLOUDFLARE-R2-SETUP.md`.
