# Fiction Library Supabase Configuration

## Project Structure
- Database schema migrations in `supabase/migrations/`
- Clean migrations without deprecated queue functionality in `supabase/migrations_clean/`
- Deployment scripts in `supabase/scripts/`

## Environment Variables
The following environment variables need to be set for the application to work:

- `NEXT_PUBLIC_SUPABASE_URL` - The Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - The Supabase anonymous key for client-side operations
- `SUPABASE_SERVICE_ROLE_KEY` - The Supabase service role key for server-side operations
- `SUPABASE_JWT_SECRET` - The JWT secret for Supabase authentication

## Deployment Process

1. **Initialize a new project** (if needed):
   ```bash
   ./supabase/scripts/init.sh
   ```

2. **Deploy to an existing project**:
   ```bash
   ./supabase/scripts/deploy.sh
   ```

## Database Migrations

The database schema is managed through SQL migrations. To apply migrations:

```bash
supabase db push
```

To reset the database (WARNING: This will delete all data):

```bash
supabase db reset
```

## Storage Configuration

The application uses Supabase Storage for book files and covers:

- `books` bucket for book files
- `covers` bucket for book covers

Buckets and policies are created through migrations.

## Authentication

The application uses Supabase Auth with the following configuration:

- Email/password authentication enabled
- User profiles stored in `user_profiles` table
- Role-based access control with 'reader' and 'admin' roles

## Functions

Supabase functions are used for:
- Reading history tracking
- Download queue management (deprecated)
- Utility operations

## Security

Row Level Security (RLS) is enabled on all tables with appropriate policies.
Only authenticated users can access data, with additional restrictions for admin operations.