# Security Specification: Hardware Store Accounting & Moderation Rules

## 1. Data Invariants
1. **Default-Deny Safety Net**: Every path not explicitly matched under `/databases/{database}/documents` returns `PERMISSION_DENIED`.
2. **Verified Super Admin Authority**: Only the bootstrapped verified owner (`mohammedmamo2003@gmail.com` with `email_verified == true`) or a UID registered in `/admins/{uid}` is recognized as `isAdmin()`.
3. **Access Request Integrity**:
   - Creating a document in `/access_requests/{requestId}` requires a signed-in user (or valid request ID matching `^[a-zA-Z0-9_\-]+$`), mandatory fields (`id`, `email`, `fullName`, `requestedRole`, `requestedRoleArabic`, `status`, `date`, `time`, `timestamp`), strict string size bounds, and initial `status == 'pending'`.
   - Applicants cannot self-approve, self-assign roles, or read other applicants' requests.
   - Only `isAdmin()` can `list` all requests or `update`/`delete` request moderation state (`approved`, `rejected`, `banned`, `restricted`, `assignedRole`, `assignedPermissions`, `restrictionNote`, `isReadOnly`).
4. **User Profile RBAC & Ban Enforcement**:
   - Non-admin users cannot escalate their `role`, `permissions`, `isActive`, or `accessStatus` fields on `/users/{userId}`.
   - Banned or inactive users (`isActive == false` or `accessStatus == 'banned'` or `accessStatus == 'rejected'`) are rejected from reading or writing store collections.
5. **Store Collections Continuity**:
   - Store collections (`products`, `sales`, `purchases`, `expenses`, `customers`, `suppliers`, `cash_transactions`, `customer_payments`, `supplier_payments`, `inventory_adjustments`, `audit_logs`, `store_settings`) enforce valid document IDs (`isValidId`) and active staff/admin status (`isAdmin() || isActiveStaff()`), supporting Deflate L9 compressed binary envelopes (`_c == true`) as well as standard documents.

## 2. "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated store read**: Anonymous client reading `/products/prod-1` -> DENIED (`request.auth == null`).
2. **Unauthenticated access request read**: Anonymous client reading `/access_requests/req-1` -> DENIED (`PII protection`).
3. **Self-approval on access request creation**: Signed-in non-admin creating `/access_requests/req-2` with `status: 'approved'` -> DENIED (`status` must equal `'pending'`).
4. **Pre-assigning admin role on access request creation**: Signed-in applicant creating `/access_requests/req-3` with `assignedRole: 'admin'` -> DENIED (`hasOnly` / disallowed admin fields on create).
5. **Non-admin updating request status**: Applicant updating `/access_requests/req-1` to `status: 'approved'` -> DENIED (`update` requires `isAdmin()`).
6. **Non-admin listing all access requests**: Non-admin running collection query on `/access_requests` without `uid == request.auth.uid` -> DENIED (`Query Enforcer`).
7. **Privilege escalation on `/users/{uid}`**: Staff updating own `/users/{uid}` document setting `role: 'admin'` or `accessStatus: 'approved'` -> DENIED (`affectedKeys` / `isAdmin()` guard).
8. **Reading another staff member's PII on `/users/{otherUid}`**: Non-admin running `get(/users/otherUid)` -> DENIED (`isOwner || isAdmin()`).
9. **Spoofed admin email without `email_verified`**: User with unverified email matching admin email attempting admin update -> DENIED (`email_verified == true` required).
10. **Banned user writing sale invoice**: User with `/users/{uid}.accessStatus == 'banned'` writing to `/sales/sale-1` -> DENIED (`isActiveStaff()` rejects banned accounts).
11. **ID poisoning attack**: Writing document with 500-char ID or invalid characters (`../../etc/passwd`) -> DENIED (`isValidId`).
12. **Shadow / Ghost field injection on `/access_requests`**: Creating request with arbitrary 50KB `extraJunk` field -> DENIED (`keys().hasOnly(...)` + `.size()` enforcement).
