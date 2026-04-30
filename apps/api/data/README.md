# `apps/api/data/`

Runtime-loaded binary data files. **Not committed to git** (`.mmdb` is gitignored at the repo root).

## `GeoLite2-City.mmdb` — required for visitor enrichment

The Live Chat module enriches every visitor with country / city / timezone / ISP using MaxMind's offline GeoLite2-City database. The file is loaded once at boot by `EnrichmentService` (`apps/api/src/common/visitor-enrichment/geoip.service.ts`).

If the file is missing, enrichment falls back to nulls and a warning is logged on boot — the API still starts.

### Download

1. Create a free MaxMind account: https://www.maxmind.com/en/geolite2/signup
2. Generate a license key in your account settings.
3. Download `GeoLite2-City.mmdb.tar.gz` (the binary `.mmdb`, not the CSV variant) from the "Download Files" page.
4. Extract and place `GeoLite2-City.mmdb` in this directory.

```sh
tar -xzf GeoLite2-City.tar.gz
cp GeoLite2-City_*/GeoLite2-City.mmdb apps/api/data/GeoLite2-City.mmdb
```

### Refresh cadence

MaxMind updates the database twice a week. Refresh quarterly at minimum; sooner if visitor location accuracy starts drifting. Same procedure as the initial download.

### Coolify deployment

The `data/` directory is mounted as a persistent volume on Coolify. Upload the `.mmdb` once via the file manager (or `scp`) and it survives redeploys. If you ever wipe the volume, repeat the steps above.
