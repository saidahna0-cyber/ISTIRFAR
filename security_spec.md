# Security Specification — حملة الاستغفار

## 1. Data Invariants
1. **Participant Identity & Ownership**: A `participants/{participantId}` document can only be created atomically alongside a matching `participantSecrets/{participantId}` document and a `+1` increment to `campaignStats/global.totalParticipants`. Visitors cannot read `participantSecrets`, and cannot update any `participants/{participantId}` document unless they atomically update `participantSecrets/{participantId}` and create an `istighfarLogs/{logId}` entry containing the matching `secretToken` (`proofToken`).
2. **Restricted Deltas & Anti-Tampering**: Visitors can only increment `totalIstighfar` by `[1, 10, 33, 100]` or undo their exact previous non-zero action (`-lastLogDelta`, clearing `lastLogDelta` to `0` and `lastLogId` to `'undone'`). Arbitrary numbers, negative totals, and double-undos are strictly blocked.
3. **Atomic Stats Integrity**: `campaignStats/global` cannot be mutated directly with arbitrary counts; every count change must match the exact `count` of a newly created `istighfarLogs/{logId}` in the same atomic write, and every participant count increase must link to `participantSecrets` and `istighfarLogs`.
4. **Rate Limiting**: `participantSecrets/{participantId}.lastActionAt` must strictly equal `request.time` and be at least `250ms` after `existing().lastActionAt` to block rapid automated script bursts.
5. **PII & Admin Isolation**: `istighfarLogs`, `suspiciousEvents`, `admins`, and non-public `participants` (`isPublic == false`) are readable only by verified Admins (`request.auth.token.email_verified == true` and bootstrapped admin email or `admins/{uid}`). `participantSecrets` is unreadable by all clients.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Direct Global Stats Inflation**: `updateDoc(doc(db, 'campaignStats', 'global'), { totalIstighfar: 999999 })` -> Denied (delta not in allowed set, missing atomic `istighfarLogs`).
2. **Direct Participant Count Forgery**: `updateDoc(doc(db, 'participants', 'victim_1'), { totalIstighfar: 50000 })` without secret proof -> Denied (`getAfter` on `participantSecrets` and `istighfarLogs` fails).
3. **Wrong Secret Token Proof**: Creating `istighfarLogs/log_1` with `proofToken: "wrong_token"` -> Denied (`proofToken != existing().secretToken`).
4. **Reading Another User's Secret Token**: `getDoc(doc(db, 'participantSecrets', 'victim_1'))` -> Denied (`allow read: if false`).
5. **Double Undo Exploit**: Sending `delta: -100` twice in a row when `lastLogDelta` is already `0` / `lastLogId == 'undone'` -> Denied.
6. **Negative Total Balance**: Sending an undo larger than `totalIstighfar` -> Denied (`incoming().totalIstighfar >= 0` & `delta == -existing().lastLogDelta`).
7. **Shadow / Ghost Field Injection**: Creating or updating a participant with `{ ..., isAdmin: true, role: 'admin' }` -> Denied (`keys().hasOnly(...)` and `affectedKeys().hasOnly(...)`).
8. **Client-Spoofed Timestamp**: Creating `participants/p1` with a past/future `createdAt` instead of `request.time` -> Denied (`incoming().createdAt == request.time`).
9. **Resource Poisoning (1MB ID / Display Name)**: Creating a participant with a 2KB `participantId` or 5KB `displayName` -> Denied (`isValidId` regex + `.size() <= 50`).
10. **Unverified Admin Email Spoof**: Accessing `istighfarLogs` or `campaignSettings` write with `email_verified: false` -> Denied (`request.auth.token.email_verified == true`).
11. **Scraping Private Participants**: `getDocs(collection(db, 'participants'))` without `where('isPublic', '==', true)` -> Denied (`allow list: if resource.data.isPublic == true || isAdmin()`).
12. **Visitor Modifying Daily Campaign Message**: `updateDoc(doc(db, 'campaignSettings', 'public'), { dailyMessage: 'hacked' })` as non-admin -> Denied (`isAdmin()` required).
