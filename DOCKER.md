# Docker Deployment

This repo has two deployable containers:

- `web-admin`: Next.js dashboard and API routes on port `3000`
- `mobile-web`: Expo web build of the customer app on port `80`

Supabase remains the backend. Do not put real secrets in GitHub.

## Local Run

Create a Docker env file:

```bash
copy .env.docker.example .env.docker
```

Fill `.env.docker`, then run:

```bash
docker compose --env-file .env.docker up --build
```

Open:

```txt
http://localhost:3000  web-admin
http://localhost:8080  mobile-user web app
```

## Build Individually

```bash
docker build -f Dockerfile.web-admin -t washware-web-admin ^
  --build-arg NEXT_PUBLIC_SUPABASE_URL=... ^
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... ^
  --build-arg NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=... .

docker run -p 3000:3000 ^
  -e NEXT_PUBLIC_SUPABASE_URL=... ^
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... ^
  -e NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=... ^
  -e SUPABASE_SERVICE_ROLE_KEY=... ^
  washware-web-admin
```

```bash
docker build -f Dockerfile.mobile-web -t washware-mobile-web ^
  --build-arg EXPO_PUBLIC_SUPABASE_URL=... ^
  --build-arg EXPO_PUBLIC_SUPABASE_ANON_KEY=... .

docker run -p 8080:80 washware-mobile-web
```

## Hostinger Notes

Docker needs a Hostinger VPS or another container-capable service. Normal shared hosting usually will not run Docker containers.

If Hostinger pulls from GitHub without Docker support, configure the two apps separately instead:

- `web-admin` as a Node.js/Next.js app
- `mobile-user` as a static Expo web export
