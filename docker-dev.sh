#!/bin/bash

# Docker Development Helper Script
# Manages frontend and backend services with hot reloading

set -e

COMPOSE_FILE="docker-compose.dev.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function print_help() {
    echo -e "${GREEN}Docker Development Commands:${NC}"
    echo ""
    echo "  ./docker-dev.sh up         - Start services in foreground"
    echo "  ./docker-dev.sh up-d       - Start services in background"
    echo "  ./docker-dev.sh down       - Stop all services"
    echo "  ./docker-dev.sh logs       - View logs (optional: add service name)"
    echo "  ./docker-dev.sh build      - Build containers"
    echo "  ./docker-dev.sh rebuild    - Rebuild and restart containers"
    echo "  ./docker-dev.sh restart    - Restart services"
    echo "  ./docker-dev.sh ps         - Show running containers"
    echo "  ./docker-dev.sh help       - Show this help message"
    echo ""
    echo -e "${YELLOW}Services:${NC}"
    echo "  - Frontend (frontend-new): http://localhost:3000"
    echo "  - Backend: http://localhost:8000"
}

function check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}Error: Docker Compose is not installed${NC}"
        exit 1
    fi
}

function docker_compose_cmd() {
    if docker compose version &> /dev/null; then
        docker compose -f "$COMPOSE_FILE" "$@"
    else
        docker-compose -f "$COMPOSE_FILE" "$@"
    fi
}

case "$1" in
    up)
        check_docker
        echo -e "${GREEN}Starting services in foreground...${NC}"
        docker_compose_cmd up
        ;;
    up-d)
        check_docker
        echo -e "${GREEN}Starting services in background...${NC}"
        docker_compose_cmd up -d
        echo -e "${GREEN}Services started!${NC}"
        echo "Frontend: http://localhost:3000"
        echo "Backend: http://localhost:8000"
        echo ""
        echo "Run './docker-dev.sh logs' to view logs"
        ;;
    down)
        check_docker
        echo -e "${YELLOW}Stopping services...${NC}"
        docker_compose_cmd down
        echo -e "${GREEN}Services stopped${NC}"
        ;;
    logs)
        check_docker
        if [ -z "$2" ]; then
            docker_compose_cmd logs -f
        else
            docker_compose_cmd logs -f "$2"
        fi
        ;;
    build)
        check_docker
        echo -e "${GREEN}Building containers...${NC}"
        docker_compose_cmd build
        echo -e "${GREEN}Build complete${NC}"
        ;;
    rebuild)
        check_docker
        echo -e "${YELLOW}Rebuilding containers...${NC}"
        docker_compose_cmd down
        docker_compose_cmd build --no-cache
        docker_compose_cmd up -d
        echo -e "${GREEN}Rebuild complete!${NC}"
        echo "Frontend: http://localhost:3000"
        echo "Backend: http://localhost:8000"
        ;;
    restart)
        check_docker
        echo -e "${YELLOW}Restarting services...${NC}"
        docker_compose_cmd restart
        echo -e "${GREEN}Services restarted${NC}"
        ;;
    ps)
        check_docker
        docker_compose_cmd ps
        ;;
    help|--help|-h)
        print_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        print_help
        exit 1
        ;;
esac
