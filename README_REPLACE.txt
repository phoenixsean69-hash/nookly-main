NOOKLY RIDES TABLESDB HOTFIX

Why:
The first backend scripts used Appwrite's deprecated Collections/Attributes/Documents API.
This hotfix uses the current TablesDB API and matches these API key scopes:
- databases.read
- tables.read / tables.write
- columns.read / columns.write
- indexes.read / indexes.write
- rows.read / rows.write

Replace these two project files completely:
- scripts/setup-rides-backend.mjs
- scripts/seed-rides-backend.mjs

Then run:
node scripts/setup-rides-backend.mjs
