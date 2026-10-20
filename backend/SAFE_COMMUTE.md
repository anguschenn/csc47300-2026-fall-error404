# SafeCommute setup

SafeCommute uses the existing Supabase login and PostgreSQL connection. The new
API lives in `app/api/v1/commute_trips.py`; models and schemas follow the existing
backend structure. The frontend page is `frontend/src/pages/SafeCommutePage.tsx`.

From the `backend` directory, with the existing `.env` configured, run once:

```powershell
.\venv\Scripts\python.exe -m app.scripts.setup_safe_commute
```

This creates only `commute_trips` and `commute_trip_members`. Existing `stations`
and `profiles` tables must already exist. Repeating the command is safe; it does
not delete or recreate existing tables. Row level security blocks direct access
through Supabase's public client. Use the backend's existing privileged database
connection (table owner or a role with BYPASSRLS); all HTTP access is checked by
the existing Supabase bearer-token dependency.

Start the backend and frontend as usual:

```powershell
# Terminal 1, from backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# Terminal 2, from frontend
npm.cmd run dev
```

Sign in and open the SafeCommute tab. Select a train line, then two different
stations served by that line and a future
meetup window, then publish. The creator automatically joins the trip. Other
signed-in users see the published trip and can join or leave. The creator may
also leave and rejoin; the card still identifies them as the original creator.
Names are resolved from public profiles; the client cannot set another creator
or add someone else as a participant. Cards show times in New York time; form
times use the device's local time zone and are sent to the API as UTC instants.

Changing the train line clears both station selections. The API also checks that
both stations serve the chosen line. Published cards show a colored subway bullet
and the chosen line alongside the station names. Station membership uses the
existing station data; it does not guarantee a particular train's stopping pattern
or service at the requested time.

For an existing database, run the setup command again before restarting FastAPI.
It adds the nullable `train_line` and `cancelled_at` columns to `commute_trips`. Earlier trips
remain visible with a line-not-specified note; no line is guessed for them.

Each trip's participants form its commute group. The feed refreshes every 15
seconds and offers a manual refresh button. Status tabs divide trips into:

- **Upcoming:** the meetup window has not started.
- **Meeting now:** the window has started but has not ended.
- **Completed:** the window has ended.
- **Cancelled:** the creator cancelled the trip; this takes priority over its time.

The filter box combines status, train line, departure station, and **My trips**.
My trips includes trips the current user created or joined, even when the creator
has left their own trip. Line and departure options come from the trips in the
selected status and ownership scope. Completed and cancelled records are retained.

Creators can edit upcoming trips using **Edit trip**, which fills the existing
form. Changes preserve all participants. Creators can cancel upcoming or meeting
trips after confirming in the card. Cancellation preserves the trip and group,
and closes joining/leaving. Completed trips cannot be edited or cancelled.
The API enforces creator ownership for both operations. No notification messages
are sent; other riders see changes when their feed refreshes.

Run the isolated API tests without modifying the configured database:

```powershell
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```

From `frontend`, check status boundaries and combined filters with:

```powershell
node --test tests/commuteTrips.test.mjs
```

Manual check: publish as one user, join as a second user in another browser,
refresh the first user's feed, then leave as the second user. Confirm the member
list updates and the button switches between Join trip and Leave trip. Sign out
and confirm the tab disappears and `/safe-commute` redirects to the map.
