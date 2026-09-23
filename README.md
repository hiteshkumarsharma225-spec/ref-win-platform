# REAL LUDO PLAYER

Mobile-first Ludo battle application using virtual game credits.

## Stack

- React + TypeScript
- TanStack Start / Router
- Supabase Auth, Database and Storage
- Vite
- Tailwind CSS

## Development

1. Install Node.js or Bun.
2. Configure the required environment variables locally or in your deployment platform.
3. Install dependencies.
4. Start the development server.

Do not commit local environment files or credentials.

## Environment variables

The application expects the Supabase connection values to be supplied through deployment/local environment configuration:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Never commit service-role keys, database passwords, OAuth client secrets, or other private credentials.

## Notes

This repository is intended to contain source code only. Deployment configuration and secrets should be managed separately through the hosting platform.
