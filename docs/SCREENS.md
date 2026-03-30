# Screen Inventory

This mapping documents all primary screens and routes in the standard web application.

## 1. Primary App Entry (Dashboard/Landing)
- **URL Path:** `/`
- **Component:** `Index.tsx`
- **Security Framework:** Public / Protected Hybrid. Conditionally renders content if the user is authenticated.
- **Core Purpose:** The main gateway into the application. For authenticated users, it serves as the primary dashboard displaying subjects, progress streaks, and navigation into study tools/Mentat scenarios.

## 2. Authentication Gateway
- **URL Paths:** `/signup`, `/register`, `/login`
- **Component:** `AuthPage.tsx`
- **Security Framework:** Public
- **Core Purpose:** Universal authentication interface wrapping the Supabase Auth UI. Handles email, password, and social logins.

## 3. Password Management
- **URL Path:** `/auth/update-password`
- **Component:** `UpdatePassword.tsx`
- **Security Framework:** Protected (requires active auth session or valid password reset recovery token).
- **Core Purpose:** Interface for users to set a new password during the recovery flow.

## 4. Study Vault
- **URL Path:** `/study-vault`
- **Component:** `StudyVault.tsx`
- **Security Framework:** Protected (assumed).
- **Core Purpose:** An interactive repository for students to browse their past quizzes, generated flashcards, review study metrics, and organise their learning artifacts.

## 5. Admin Backfill Utility
- **URL Path:** `/admin-backfill`
- **Component:** `AdminBackfill.tsx`
- **Security Framework:** Protected. Only accessible to authenticated administrators.
- **Core Purpose:** Internal tooling providing a UI to trigger data alignment or schema backfills (such as migrating string lists to normalized tags).

## 6. 404 Route
- **URL Path:** `*` (Catch-all)
- **Component:** `NotFound.tsx`
- **Security Framework:** Public
- **Core Purpose:** Displays a helpful error state and navigation recovery options when a user hits an unmapped route.

---
### Landing Page Structure
- **Component:** `Landing.tsx`
- **Status:** Active Marketing Gateway. This is the primary unauthenticated entry point focusing on features and conversion. Navigates directly to `/?view=home` for returning authenticated users.
