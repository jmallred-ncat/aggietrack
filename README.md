# AggieTrack
Information Technology Degree Tracking Platform

A comprehensive student advising and degree planning system for the Information Technology program at North Carolina A&T State University.

## Overview

AggieTrack helps students plan their courses, track degree progress, and coordinate with advisors. The platform includes:

- **Student Portal**: Course planning, degree progress tracking, and transcript management
- **Advisor Tools**: Plan review, approval workflow, and student management
- **Test Manager**: Quality assurance and test data management

## Tech Stack

- **Framework**: Next.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Better Auth
- **Monorepo**: pnpm + Turborepo
- **Deployment**: Vercel + Neon

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/aggietrack/.env.example apps/aggietrack/.env.local

# Run database migrations
pnpm --filter aggietrack db:migrate

# Seed the catalog
pnpm --filter aggietrack db:seed

# Start development servers
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) for the main app and [http://localhost:3001](http://localhost:3001) for the test manager.

## Project Structure

```
apps/
  aggietrack/        # Main student portal application
  test-manager/      # QA and test account management
packages/
  ui/                # Shared UI components
```

## Documentation

- Architecture and technical decisions in `/docs`
- Test plan and requirements in test-manager
- Prisma schema documentation in `apps/aggietrack/prisma/`
