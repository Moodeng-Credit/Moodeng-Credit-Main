# Docker Development Setup

This document describes how to use Docker for local development with hot reloading for both frontend and backend services.

## Overview

The project is now separated into two main parts:
- **Frontend**: React + Vite application (port 3000)
- **Backend**: Node.js server (port 8000)

Both services run in separate Docker containers with hot reloading enabled, allowing you to make changes to the code and see them reflected immediately without rebuilding containers.

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- Git

## Quick Start

### Starting Services

```bash
# Start both services in background
./docker-dev.sh up-d

# Start both services in foreground (to see logs)
./docker-dev.sh up
```

### Accessing Services

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api
- **Backend Health Check**: http://localhost:8000/health

### Viewing Logs

```bash
# View logs from all services
./docker-dev.sh logs

# View logs from a specific service
./docker-dev.sh logs frontend
./docker-dev.sh logs backend
```

### Stopping Services

```bash
# Stop all services
./docker-dev.sh down
```

## Available Commands

The `docker-dev.sh` script provides these commands:

| Command | Description |
|---------|-------------|
| `./docker-dev.sh up` | Start services in foreground |
| `./docker-dev.sh up-d` | Start services in background (detached) |
| `./docker-dev.sh down` | Stop all services |
| `./docker-dev.sh logs [service]` | View logs (optionally for specific service) |
| `./docker-dev.sh build` | Build containers |
| `./docker-dev.sh rebuild` | Rebuild containers from scratch and start |
| `./docker-dev.sh restart` | Restart all services |
| `./docker-dev.sh ps` | Show running containers |
| `./docker-dev.sh help` | Show help message |

## Hot Reloading

Both frontend and backend support hot reloading:

### Frontend Hot Reload
- Changes to any file in `frontend/src/` will automatically trigger a rebuild
- The browser will refresh automatically
- No need to restart the container

### Backend Hot Reload
- Currently uses a basic Node.js server (development placeholder)
- For production, Supabase Edge Functions handle the backend logic
- To enable hot reload for backend, you can use nodemon (see Backend Development section)

## Managing Dependencies

### Adding Frontend Dependencies

When you add a new npm package to the frontend:

1. Add it to `frontend/package.json`
2. Restart the frontend container:
   ```bash
   docker-compose -f docker-compose.dev.yml restart frontend
   ```

The container will run `pnpm install` on startup and install the new dependencies.

### If Module Not Found After Adding Dependencies

If you still see "Module not found" errors:

```bash
# Stop all services and remove volumes
docker-compose -f docker-compose.dev.yml down -v

# Rebuild frontend without cache
docker-compose -f docker-compose.dev.yml build frontend --no-cache

# Start services again
./docker-dev.sh up-d
```

## Troubleshooting

### Port Already in Use

If you see errors about ports 3000 or 8000 being in use:

```bash
# Find the process using the port (macOS/Linux)
lsof -i :3000
lsof -i :8000

# Kill the process (replace PID with actual process ID)
kill -9 <PID>
```

### Container Won't Start

```bash
# Check container logs
./docker-dev.sh logs

# Rebuild containers
./docker-dev.sh rebuild
```

### Permission Denied Errors (Linux)

If you encounter permission issues with Docker on Linux:

```bash
# Add your user to the docker group
sudo usermod -aG docker $USER

# Log out and log back in for the changes to take effect
```

### File Sharing Issues (macOS)

On macOS, ensure Docker Desktop has file sharing enabled:
1. Open Docker Desktop preferences
2. Go to "Resources" → "File Sharing"
3. Ensure `/Users` is in the list

## Development Workflow

1. **Start Docker services**:
   ```bash
   ./docker-dev.sh up-d
   ```

2. **Make changes** to your code in `frontend/` or `backend/`

3. **Changes auto-reload** - refresh your browser to see frontend changes

4. **View logs** if needed:
   ```bash
   ./docker-dev.sh logs
   ```

5. **Stop services** when done:
   ```bash
   ./docker-dev.sh down
   ```

## Backend Development

The current Docker setup includes a simple Node.js server for development purposes. The actual backend logic for production is in Supabase Edge Functions (located in `backend/supabase/functions/`).

### Developing with Supabase Edge Functions

For working with Supabase Edge Functions locally:

```bash
# Install Supabase CLI
npm install -g supabase

# Start Supabase locally (from project root)
cd backend
supabase start

# Serve edge functions
supabase functions serve
```

## Environment Variables

Environment files for the frontend are located in the `frontend/` directory:
- `.env.local` - Local development
- `.env.staging` - Staging environment
- `.env.production` - Production environment

The project uses **dotenvx** for environment management. Ensure you have the `.env.keys` file to decrypt secrets.

## Architecture

```
├── docker-compose.dev.yml    # Docker Compose configuration
├── docker-dev.sh              # Docker management script
├── frontend/
│   ├── Dockerfile.dev         # Frontend Docker configuration
│   ├── src/                   # React application source
│   └── ...
└── backend/
    ├── Dockerfile.dev         # Backend Docker configuration
    ├── server.js              # Development Node.js server
    └── supabase/              # Supabase functions (production)
        └── functions/
```

## CI/CD Considerations

This Docker setup is for **local development only**. For production deployments:
- Frontend is deployed to Vercel
- Backend uses Supabase Edge Functions
- Refer to the main README.md for production deployment instructions

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Vite Documentation](https://vitejs.dev/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
