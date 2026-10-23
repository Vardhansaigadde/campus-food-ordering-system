# Campus Food Pre-Order System

Students order food from campus canteens ahead of time. Each order gets an Order ID (for example `MC-127`), an OTP and a QR code. At the counter the student shows the QR code or reads out the ID and OTP, then pays in cash. Canteen staff see live orders on their own screen and mark each one collected. This replaces the paper order book.

**Stack:**
- Backend: Spring Boot 4.1 microservices (Java 21), Spring Cloud Gateway, Eureka, OpenFeign, Resilience4j, MySQL, JWT
- Frontend: React 19, Vite, Tailwind, installable as a PWA

## Architecture

```
React (5173) ──/api──▶ API Gateway (8080) ──lb://──▶ Auth (8081)          → auth_db
                         │  JWT check, CORS,    ├──▶ Restaurant (8082)    → restaurant_db
                         │  rate limiting       ├──▶ Order (8083 [+8093]) → order_db
                         ▼                      └──▶ Notification (8084)  → notification_db
                   Eureka registry (8761)              (WebSocket live updates)
```

| Service | Port | Database | Responsibility |
|---|---|---|---|
| eureka-server | 8761 | – | Service registry |
| api-gateway | 8080 | – | Single entry point: routing, JWT validation, CORS, rate limiting |
| auth-service | 8081 | auth_db | Register and login, JWT, roles, blocking users |
| restaurant-service | 8082 | restaurant_db | Canteens, menus, daily availability and stock, open/busy/closed, favourites |
| order-service | 8083 | order_db | Orders, pre-order slots, OTP/QR pickup, queue position, no-shows |
| notification-service | 8084 | notification_db | Live notifications (WebSocket), announcements, audit log |

The browser only talks to the gateway. In development, Vite proxies `/api/*` to `localhost:8080`. The services call each other through Eureka using OpenFeign, with Resilience4j fallbacks. Each database is created automatically on first start.

## Requirements

- JDK 21
- Node.js 20 or newer
- MySQL 8 running on `localhost:3306`
- Python 3, only for the seed and test scripts

## Build and run (Windows)

```bat
build-all.bat          :: builds the 6 JARs and runs npm install (add "test" to also run the unit tests)
start-all.bat          :: asks for the MySQL password, then starts everything in separate windows
start-all.bat scale    :: also starts a 2nd Order Service on 8093 to show load balancing
```

Give the services about a minute to register, then open:

- Website: http://localhost:5173 (phones on the same Wi-Fi can use `http://<this-PC-IP>:5173`)
- Eureka dashboard: http://localhost:8761

On a fresh database, load the demo data once:

```bat
python scripts\seed_demo.py
```

To run the end-to-end API test against the running system:

```bat
python scripts\e2e_api_test.py
```

## Deploying for real use (free)

Production runs on one free Oracle Cloud server with Docker Compose. Caddy serves the website and gets free HTTPS on a DuckDNS address. See [docs/DEPLOY-ORACLE.md](docs/DEPLOY-ORACLE.md).

## Configuration

Every secret has a development default in `application.yml`. Override each one with an environment variable. **In production, set every variable below. Do not rely on the defaults.**

| Variable | Used by | Purpose |
|---|---|---|
| `DB_HOST`, `DB_PORT` | auth, restaurant, order, notification | MySQL location (defaults: `localhost`, `3306`) |
| `DB_USERNAME`, `DB_PASSWORD` | same | MySQL login. Use a dedicated user, not root. |
| `JWT_SECRET` | gateway, auth | Signs login tokens. Use a long random string. |
| `GATEWAY_KEY` | all services | Proves a request came through the gateway |
| `INTERNAL_KEY` | business services | Authenticates service-to-service calls |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | auth | The admin account created on first start |
| `EUREKA_URL` | all clients | Registry address (default: `http://localhost:8761/eureka`) |
| `PORT` | order-service | Lets you run a second instance (8093) |

The order rules are set under `app.order` in `backend/order-service/src/main/resources/application.yml`:
- `max-active-orders`: 3
- `max-quantity-per-dish`: 7
- `no-show-hours`: 3
- `otp-max-attempts`: 5

## Roles and pages

| Role | Where | What they can do |
|---|---|---|
| Student | `/restaurants`, `/cart`, `/orders`, `/favourites`, `/spending`, `/account` | Browse today's menu, order from several canteens, see the pickup pass (QR, ID and OTP) and their queue position |
| Restaurant staff | `/kitchen`: live board, `verify`, `prep`, `menu`, `summary`, `settings` | Manage their own canteen only: dishes, daily stock, the open/busy/closed toggle, verifying pickups, the cash summary |
| Admin | Hidden path (see below). It is not linked anywhere in the UI. | Dashboard and charts, canteens and their dishes, all orders, CSV export, user blocking, announcements, audit log |

Students cannot open staff or admin pages, and they cannot call those APIs. The gateway and each service both check the role.

The admin login page is at `/admin-2406` (`ADMIN_BASE` in the frontend). Hiding the URL is not the security control. Admin APIs need an ADMIN JWT whatever the URL is, so a strong `ADMIN_PASSWORD` is what protects the admin area.

## Demo logins (seed data only)

These are created by `seed_demo.py` and the development defaults. **Change or remove them before real use.**

| Role | Email | Password |
|---|---|---|
| Student | student@campusfood.test | student123 |
| Main Canteen (MC) | maincanteen@campusfood.test | canteen123 |
| Food Court (FC) | foodcourt@campusfood.test | canteen123 |
| Juice Corner (JS) | juicecorner@campusfood.test | canteen123 |
| Admin | admin@campusfood.local | Admin@123 |

## API docs (Swagger)

Each business service exposes its own Swagger UI:

- Auth: http://localhost:8081/swagger-ui.html
- Restaurant: http://localhost:8082/swagger-ui.html
- Order: http://localhost:8083/swagger-ui.html
- Notification: http://localhost:8084/swagger-ui.html

## Project layout

```
backend/         6 Spring Boot services (each one builds with its own mvnw)
frontend/        React + Vite app
scripts/         seed_demo.py (demo data), e2e_api_test.py (API test)
design-system/   UI design tokens and rules (campus-food/MASTER.md)
docs/            presentation/build.py builds the project PPT
build-all.bat    build everything
start-all.bat    start everything
```
