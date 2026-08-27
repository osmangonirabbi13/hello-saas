# Phase 1 architecture

The workspace separates the root-level `frontend` Next.js application, `backend/api` Express API, `backend/worker` BullMQ worker, and shared `packages`. API requests flow through authentication, server-side tenant resolution, permission enforcement, validation, controller, service, and repository boundaries. Controllers never query Prisma.

The access token identifies only a user and login session. The active business is stored on `LoginSession` and accepted only after the repository verifies the session, user, business, and active `BusinessMembership` agree.
