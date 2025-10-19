#!/bin/bash

# Script to initialize a new Supabase project for Fiction Library
# Usage: ./supabase/scripts/init.sh

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null
then
    echo "Supabase CLI could not be found. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

echo "Initializing new Supabase project for Fiction Library..."

# Check if SUPABASE_ACCESS_TOKEN is set
if [ -z "$SUPABASE_ACCESS_TOKEN" ]
then
    echo "Please set the SUPABASE_ACCESS_TOKEN environment variable"
    exit 1
fi

# Create a new Supabase project
echo "Creating new Supabase project..."
PROJECT_NAME="fiction-library"
PROJECT_REGION="us-east-1"  # Change this to your preferred region

# Create the project
supabase projects create --name $PROJECT_NAME --region $PROJECT_REGION

# Get the project ID
PROJECT_ID=$(supabase projects list | grep $PROJECT_NAME | awk '{print $1}')

if [ -z "$PROJECT_ID" ]
then
    echo "Failed to create project or get project ID"
    exit 1
fi

echo "Project created with ID: $PROJECT_ID"

# Link to the new project
echo "Linking to the new project..."
supabase link --project-ref $PROJECT_ID

# Set environment variables
echo "Setting up environment variables..."
echo "NEXT_PUBLIC_SUPABASE_URL=$(supabase status | grep 'API URL' | awk '{print $3}')" > .env.local
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(supabase status | grep 'anon key' | awk '{print $3}')" >> .env.local
echo "SUPABASE_SERVICE_ROLE_KEY=$(supabase status | grep 'service_role key' | awk '{print $3}')" >> .env.local

echo "Project initialization completed!"
echo "Environment variables have been saved to .env.local"
echo "Next steps:"
echo "1. Review and customize the .env.local file"
echo "2. Run the deployment script: ./supabase/scripts/deploy.sh"
echo "3. Set up authentication providers as needed"