# Zion-Catering-Services--Server
# Zion Catering Services Server

## Run locally

1. Install Node.js 18 or newer.
2. Install the server dependencies:

   ```powershell
   npm install
   ```

3. Create the environment file from the template:

   ```powershell
   Copy-Item .env.example .env
   ```

   Update `DB_USER`, `DB_PASSWORD`, and the other database values if your local
   MySQL setup differs. The server always loads this root `.env` file, even
   when started from the `server` directory.

4. Create and seed the MySQL database using
   [`server/database/schema.sql`](server/database/schema.sql) and
   [`server/database/seed.sql`](server/database/seed.sql).

5. Start the API from the repository root:

   ```powershell
   npm start
   ```

   The API is available at `http://localhost:4000`. Verify the database
   connection with `http://localhost:4000/health`; a successful response
   includes `"database":"mysql-connected"`.