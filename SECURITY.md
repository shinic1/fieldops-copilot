# Security

## Reporting

Please report a suspected vulnerability privately through GitHub Security
Advisories instead of opening a public issue.

## Data handling

- Incident data in this repository and its demo scenarios is synthetic.
- The application has no server-side incident database.
- Offline reports are stored only in the browser and are deleted after
  synchronization or reset.
- Model requests use `store: false`.
- `OPENAI_API_KEY` is read only from a server-side environment variable or
  Cloudflare Worker secret.

Never commit `.env` files, production transcripts, or credentials. The tracked
`.env.example` contains placeholders only.
