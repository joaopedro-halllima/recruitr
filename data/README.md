Place school CSV files here for import, for example:

- `eastern_colleges_cc_hd2024.csv`

Run import:

```bash
cd api
python -m app.import_schools --csv ../data/eastern_colleges_cc_hd2024.csv
```

You can also place sample athlete media here (for bulk post import), for example:

- `sample_media/*.mp4`
- `sample_media/*.jpg`

Run media import (auto-assigns files across athlete users, creates posts + media_assets):

```bash
cd api
python -m app.import_sample_media --input-dir ../data/sample_media
```

Preview assignment without writing:

```bash
cd api
python -m app.import_sample_media --input-dir ../data/sample_media --dry-run
```

Optional metadata manifest (to control athlete assignment, caption/title, sport, tags):

```bash
cd api
python -m app.import_sample_media \
  --input-dir ../data/sample_media \
  --manifest ../data/sample_media_manifest.csv
```

CSV manifest columns:

- `filename` (required, basename only)
- `athlete_user_id` (optional)
- `athlete_email` (optional)
- `caption` or `title` (optional)
- `sport` (optional)
- `tags` (optional, comma or pipe separated)

Example:

```csv
filename,athlete_email,caption,sport,tags
clip_001.mp4,athlete1@synthetic.recruitr.test,Left-foot finish from top of box,soccer,"soccer,forward,classof2028"
photo_014.jpg,athlete2@synthetic.recruitr.test,Training session still,soccer,"soccer,training"
```

Template file: `data/sample_media_manifest.template.csv`
