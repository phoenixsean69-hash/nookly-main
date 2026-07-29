NOOKLY RIDES — FREE PLAN HOTFIX

Problem fixed:
Appwrite Free Plan does not allow encrypted string columns.

What changed:
- driverAccessCodeHash is now created as a normal string column.
- The actual driver access code must still be hashed before being stored.
- No plain-text driver access code should ever be saved.

Installation:
1. Extract this ZIP into the root of your Nookly project.
2. Allow it to replace:
   scripts/setup-rides-backend.mjs
3. Keep the same PowerShell window open so APPWRITE_API_KEY remains loaded.
4. Run:
   node scripts/setup-rides-backend.mjs

The setup script is resumable and will continue from the tables and columns
that were already created.
