# Security Specification for BOQ Management Platform

## 1. Data Invariants
- **Identity Invariant**: Only authenticated users with verified credentials can write data. User profile records (`users/{userId}`) must have `uid` matching `request.auth.uid`.
- **Role Invariant**: Non-admin users cannot elevate their own role to 'admin' or alter their role during creation or update. The bootstrap admin email `mahmoudkowatly@gmail.com` is granted administrative access.
- **Admin Marker Invariant**: Documents in `/admins/{userId}` can only be created or modified by verified administrators.
- **Project Ownership Invariant**: Projects created in `/projects/{projectId}` must set `ownerId` to `request.auth.uid`. A project cannot be modified or deleted by unauthorized non-owners unless the requester is an admin.
- **Boundary Limits**: Document IDs, user names, and project titles must adhere to size limits and safe character sets (`^[a-zA-Z0-9_\\-]+$`).

## 2. The "Dirty Dozen" Payloads (Adversarial Tests)
1. **Self-Elevating Admin on Registration**: An unprivileged user attempts to register with `{ uid: "evil_user", role: "admin" }` to hijack permissions.
2. **Role Tampering on User Profile Update**: A regular estimator attempts to update their user record `{ role: "admin" }`.
3. **Admin Marker Forgery**: A non-admin attempts to create a document in `/admins/attacker_uid` directly.
4. **Project Spoofing (Owner Forgery)**: An attacker creates a project setting `ownerId: "victim_admin"`.
5. **Project ID Poisoning**: An attacker creates a document with a 2KB junk string ID or SQL/NoSQL injection string.
6. **Immutable Field Tampering**: An attacker updates a project changing `ownerId: "attacker_id"`.
7. **Ghost Field Injection (Shadow Update)**: Updating a user with ghost fields like `{ isSuperUser: true, bypassRules: true }`.
8. **Unverified Email Privilege Escalation**: An attacker sets custom email claiming to be `mahmoudkowatly@gmail.com` with `email_verified: false`.
9. **Project Hijacking by Viewer**: A viewer attempts to update an estimate calculation or delete a project owned by another engineer.
10. **Denial of Wallet Payload**: Submitting a 5MB payload in project description or invalid nested structures.
11. **Blanket Query Scraping**: Querying `/projects` or `/users` without scoping to authorized ownership/permissions.
12. **Unauthenticated Write**: An unauthenticated client sends write requests to `/projects/{id}` or `/users/{id}`.

## 3. Test Runner Design
All 12 dirty payloads are designed to return `PERMISSION_DENIED` under the hardened `firestore.rules`.
