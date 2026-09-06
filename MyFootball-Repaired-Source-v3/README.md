# MyFootball India

A working, authenticated football tournament platform based on the supplied MyFootball requirements. Organizers can run competitions end to end, while fans can discover and follow tournaments by state, city and locality. All operational data is stored in a persistent relational database.

## Implemented workflows

- A unified account with a selectable Discover-first or Organize-first home screen; neither choice limits capabilities.
- Area-based tournament discovery with tournament, venue, locality, city, state and PIN-code search.
- Fan tournament follows and submitted team registrations saved to the signed-in account.
- Required exact tournament locations: venue, street address, locality, city, state, PIN code and map coordinates.
- Google Maps links on discovery and registration pages.
- Persistent light and dark modes that respect the device preference initially.
- Public team registration, organizer approval and payment status tracking.
- Fixture generation, matchday scoring/events, standings and announcements.
- Every signed-in user can open the complete organizer workspace and create a tournament.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by the development server.

## Production build

```bash
npm run build
```

## Project notes

- `app/dashboard.tsx` contains the authenticated organizer application.
- `app/api/app/route.ts` implements protected organizer operations.
- `app/discover` and `app/api/discover` implement fan-facing area discovery and follows.
- `app/register/[id]` and the public tournament API implement team registration links.
- `app/globals.css` contains the responsive visual system.
- `db/schema.ts` and `drizzle/` contain the deployed relational schema and migration.
- `db/myfootball-schema.sql` is the expanded PostgreSQL design for a later standalone backend.
- `docs/PRODUCT_AND_DATABASE.md` explains the data-model changes, architecture and release plan.

The application is fully persistent for the Release 1 workflows. Automatic online fee collection and player-document uploads require merchant/storage credentials and remain intentionally disabled; organizers can record paid, unpaid or waived fee status manually.
