# ForgeFlow Security Specification & Invariants

## Data Invariants
1. An inventory item must have a valid non-empty SKU, name, unit cost >= 0, and belong to the authenticated owner.
2. A production project must have a valid code, title, client name, batch size > 0, sale price >= 0, and belong to the authenticated owner.
3. Users can only list, read, modify, and delete their own items and projects (`ownerId == request.auth.uid`).
4. Timestamps and ownerId cannot be tampered with across updates.

## Dirty Dozen Attack Payloads
1. Attempting to create an inventory item with an arbitrary ownerId (Identity Spoofing) -> BLOCKED.
2. Attempting to list items belonging to other users without scoping to ownerId -> BLOCKED.
3. Injecting 2MB payload into the item title -> BLOCKED by maxLength <= 150.
4. Overwriting ownerId on update -> BLOCKED by immutability check.
5. Setting negative unitCost or negative batchSize -> BLOCKED by type & boundary check.
6. Skipping authentication on read/write -> BLOCKED by default deny.
7. Injecting special script tags into document ID -> BLOCKED by isValidId regex guard.
8. Writing ghost fields not declared in schema -> BLOCKED by hasOnly key validation.
9. Attempting to update project without valid status enum -> BLOCKED.
10. Attempting to delete items owned by another tenant -> BLOCKED.
11. Blank unauthenticated list read -> BLOCKED.
12. Attempting to overwrite createdAt timestamp -> BLOCKED.
