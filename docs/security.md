# Phase 1 security

Passwords use Argon2id. Access tokens are short-lived HS256 JWTs; refresh tokens are opaque random secrets stored only as SHA-256 hashes and rotated on use. Reuse of the immediately previous refresh token revokes all user sessions. Refresh cookies are HTTP-only, SameSite Strict, path-limited, and Secure when configured.

Protected requests derive tenant context exclusively from the authenticated session and verified membership. Client-provided business identifiers are ignored. Permission checks remain mandatory in the API even when navigation is hidden in the client.
