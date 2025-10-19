#!/bin/bash

# Script to deploy the Fiction Library application to a new Supabase instance
# Usage: ./supabase/scripts/deploy.sh

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null
then
    echo "Supabase CLI could not be found. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if required environment variables are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]
then
    echo "Please set the required Supabase environment variables:"
    echo "- NEXT_PUBLIC_SUPABASE_URL"
    echo "- NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "- SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

echo "Deploying Fiction Library to Supabase..."

# Link to the Supabase project
echo "Initializing Supabase project..."
supabase link --project-ref $(echo $NEXT_PUBLIC_SUPABASE_URL | sed 's/.*\/\///' | sed 's/\.supabase\.co.*//')

# Reset the database (WARNING: This will delete all data)
echo "Resetting database..."
supabase db reset

# Apply migrations
echo "Applying database migrations..."
supabase db push

# Deploy functions
echo "Deploying functions..."
supabase functions deploy

# Deploy storage policies
echo "Deploying storage policies..."
supabase storage policies deploy

echo "Deployment completed successfully!"
echo "Next steps:"
echo "1. Set up authentication providers as needed"
echo "2. Configure storage buckets and policies"
echo "3. Create initial admin user"
echo "4. Set up any additional environment variables for your frontend application"